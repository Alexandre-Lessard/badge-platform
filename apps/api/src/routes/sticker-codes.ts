import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, and, isNull } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { stickerCodes, items } from "../db/schema.js";
import { requireVerifiedEmail, tryAuth } from "../middleware/auth.js";
import {
  badgeCodeSchema,
  normalizeBadgeCode,
  INVALID_BADGE_FORMAT,
  BADGE_CODE_UNKNOWN,
  BADGE_CODE_NOT_YOURS,
  BADGE_CODE_ALREADY_USED,
  BADGE_CODE_VOIDED,
  ITEM_NOT_FOUND,
  ITEM_ALREADY_STOLEN,
} from "@badge/shared";
import { AppError, forbidden } from "../utils/errors.js";

const uuidSchema = z.string().uuid("Invalid identifier");
const claimBodySchema = z.object({ itemId: uuidSchema });

export async function stickerCodesRoutes(app: FastifyInstance) {
  // ── Claim a code (assign to one of the caller's items) ──────────────

  app.post(
    "/sticker-codes/:code/claim",
    {
      preHandler: requireVerifiedEmail,
      config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      const rawCode = (request.params as { code: string }).code;
      const code = normalizeBadgeCode(rawCode);

      const parsed = badgeCodeSchema.safeParse(code);
      if (!parsed.success) {
        throw new AppError(400, INVALID_BADGE_FORMAT, "Invalid badge code format");
      }

      const { itemId } = claimBodySchema.parse(request.body);
      const db = getDb();

      const [stickerCode] = await db
        .select()
        .from(stickerCodes)
        .where(eq(stickerCodes.code, code))
        .limit(1);

      if (!stickerCode) {
        throw new AppError(404, BADGE_CODE_UNKNOWN, "Unknown badge code");
      }
      if (stickerCode.voidedAt) {
        throw new AppError(410, BADGE_CODE_VOIDED, "This code is no longer valid");
      }
      if (stickerCode.userId !== request.userId!) {
        throw new AppError(403, BADGE_CODE_NOT_YOURS, "This code was not purchased on your account");
      }

      if (stickerCode.assignedItemId === itemId) {
        return reply.send({ success: true, code, itemId, alreadyClaimed: true });
      }
      if (stickerCode.assignedItemId !== null) {
        throw new AppError(
          409,
          BADGE_CODE_ALREADY_USED,
          "This code is already assigned to another of your items",
        );
      }

      const [item] = await db
        .select({
          ownerId: items.ownerId,
          status: items.status,
          badgeCode: items.badgeCode,
        })
        .from(items)
        .where(eq(items.id, itemId))
        .limit(1);

      if (!item) {
        throw new AppError(404, ITEM_NOT_FOUND, "Item not found");
      }
      if (item.ownerId !== request.userId!) {
        throw forbidden();
      }
      if (item.status === "stolen") {
        throw new AppError(400, ITEM_ALREADY_STOLEN, "Cannot assign a code to a stolen item");
      }

      await db.transaction(async (tx) => {
        // If the target item already had a code, free the previous one.
        if (item.badgeCode) {
          await tx
            .update(stickerCodes)
            .set({ assignedItemId: null, claimedAt: null })
            .where(eq(stickerCodes.assignedItemId, itemId));
        }

        // Conditional UPDATE: only succeeds if the code is still unassigned.
        // Guards against a race where two tabs claim the same code at once.
        const claimed = await tx
          .update(stickerCodes)
          .set({ assignedItemId: itemId, claimedAt: new Date() })
          .where(and(eq(stickerCodes.code, code), isNull(stickerCodes.assignedItemId)))
          .returning({ code: stickerCodes.code });

        if (claimed.length === 0) {
          throw new AppError(
            409,
            BADGE_CODE_ALREADY_USED,
            "This code was just claimed by another request",
          );
        }

        await tx
          .update(items)
          .set({ badgeCode: code, updatedAt: new Date() })
          .where(eq(items.id, itemId));
      });

      return reply.send({ success: true, code, itemId });
    },
  );

  // ── Scan a code (public, auth-optional) ─────────────────────────────
  //
  // Backs the QR scanner landing page at /c/:code. Returns a single
  // context-aware payload so the SPA can render the right view without
  // a second round-trip: anonymous scanner gets the public item view,
  // the code's owner gets a claim affordance, the item's owner gets
  // a private view with a direct link.

  app.get(
    "/sticker-codes/:code/scan",
    {
      preHandler: tryAuth,
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      const rawCode = (request.params as { code: string }).code;
      const code = normalizeBadgeCode(rawCode);

      if (!badgeCodeSchema.safeParse(code).success) {
        return reply.send({ format: "invalid" as const });
      }

      const db = getDb();
      const currentUserId = request.userId ?? null;

      const [row] = await db
        .select({
          code: stickerCodes.code,
          userId: stickerCodes.userId,
          assignedItemId: stickerCodes.assignedItemId,
          voidedAt: stickerCodes.voidedAt,
        })
        .from(stickerCodes)
        .where(eq(stickerCodes.code, code))
        .limit(1);

      if (!row) {
        return reply.send({ format: "valid" as const, exists: false });
      }

      if (row.voidedAt) {
        return reply.send({ format: "valid" as const, exists: true, voided: true });
      }

      const ownedByMe = currentUserId !== null && row.userId === currentUserId;

      // Code not yet assigned to any item
      if (!row.assignedItemId) {
        return reply.send({
          format: "valid" as const,
          exists: true,
          ownedByMe,
          assignableByMe: ownedByMe,
        });
      }

      const [item] = await db
        .select({
          id: items.id,
          ownerId: items.ownerId,
          status: items.status,
          category: items.category,
          brand: items.brand,
          model: items.model,
        })
        .from(items)
        .where(eq(items.id, row.assignedItemId))
        .limit(1);

      // Defensive: assigned_item_id should always resolve, but the FK is
      // `ON DELETE SET NULL` so a race could in theory leave a dangling row.
      if (!item) {
        return reply.send({
          format: "valid" as const,
          exists: true,
          ownedByMe,
          assignableByMe: ownedByMe,
        });
      }

      const isYours = currentUserId !== null && item.ownerId === currentUserId;

      return reply.send({
        format: "valid" as const,
        exists: true,
        ownedByMe,
        item: {
          found: true as const,
          status: item.status,
          category: item.category,
          brand: item.brand,
          model: item.model,
          isYours,
          ...(isYours ? { itemId: item.id } : {}),
        },
      });
    },
  );
}
