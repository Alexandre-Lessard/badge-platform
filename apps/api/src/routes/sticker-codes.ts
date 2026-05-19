import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, and, isNull } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { stickerCodes, items } from "../db/schema.js";
import { requireVerifiedEmail } from "../middleware/auth.js";
import {
  rnbpNumberSchema,
  normalizeRnbpCode,
  INVALID_RNBP_FORMAT,
  RNBP_CODE_UNKNOWN,
  RNBP_CODE_NOT_YOURS,
  RNBP_CODE_ALREADY_USED,
  RNBP_CODE_VOIDED,
  ITEM_NOT_FOUND,
  ITEM_ALREADY_STOLEN,
} from "@rnbp/shared";
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
      const code = normalizeRnbpCode(rawCode);

      const parsed = rnbpNumberSchema.safeParse(code);
      if (!parsed.success) {
        throw new AppError(400, INVALID_RNBP_FORMAT, "Invalid RNBP code format");
      }

      const { itemId } = claimBodySchema.parse(request.body);
      const db = getDb();

      const [stickerCode] = await db
        .select()
        .from(stickerCodes)
        .where(eq(stickerCodes.code, code))
        .limit(1);

      if (!stickerCode) {
        throw new AppError(404, RNBP_CODE_UNKNOWN, "Unknown RNBP code");
      }
      if (stickerCode.voidedAt) {
        throw new AppError(410, RNBP_CODE_VOIDED, "This code is no longer valid");
      }
      if (stickerCode.userId !== request.userId!) {
        throw new AppError(403, RNBP_CODE_NOT_YOURS, "This code was not purchased on your account");
      }

      if (stickerCode.assignedItemId === itemId) {
        return reply.send({ success: true, code, itemId, alreadyClaimed: true });
      }
      if (stickerCode.assignedItemId !== null) {
        throw new AppError(
          409,
          RNBP_CODE_ALREADY_USED,
          "This code is already assigned to another of your items",
        );
      }

      const [item] = await db
        .select({
          ownerId: items.ownerId,
          status: items.status,
          rnbpNumber: items.rnbpNumber,
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
        if (item.rnbpNumber) {
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
            RNBP_CODE_ALREADY_USED,
            "This code was just claimed by another request",
          );
        }

        await tx
          .update(items)
          .set({ rnbpNumber: code, updatedAt: new Date() })
          .where(eq(items.id, itemId));
      });

      return reply.send({ success: true, code, itemId });
    },
  );
}
