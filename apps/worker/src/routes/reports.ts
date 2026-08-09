import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { createReportSchema } from "@rnbp/shared";
import { getDb } from "../db/client.js";
import { theftReports, items } from "../db/schema.js";
import { requireAuth, requireVerifiedEmail } from "../middleware/auth.js";
import { ITEM_NOT_FOUND, ITEM_ALREADY_STOLEN } from "@rnbp/shared";
import { AppError, forbidden } from "../utils/errors.js";
import type { AppEnv } from "../context.js";

export const reportRoutes = new Hono<AppEnv>();

// ── Create theft report ──────────────────────────────────────────

reportRoutes.post("/reports", requireVerifiedEmail, async (c) => {
  const body = createReportSchema.parse(await c.req.json());
  const db = getDb();

  // Verify item exists and belongs to user
  const [item] = await db
    .select({ ownerId: items.ownerId, status: items.status })
    .from(items)
    .where(eq(items.id, body.itemId))
    .limit(1);

  if (!item) throw new AppError(404, ITEM_NOT_FOUND, "Item not found");
  if (item.ownerId !== c.var.userId!) throw forbidden();
  if (item.status === "stolen") {
    throw new AppError(400, ITEM_ALREADY_STOLEN, "This item is already reported as stolen");
  }

  // Create report and update item status atomically (D1 batch)
  const [reportRows] = await db.batch([
    db
      .insert(theftReports)
      .values({
        itemId: body.itemId,
        reporterId: c.var.userId!,
        policeReportNumber: body.policeReportNumber ?? null,
        theftDate: body.theftDate ? new Date(body.theftDate) : null,
        theftLocation: body.theftLocation ?? null,
        description: body.description ?? null,
      })
      .returning(),
    db
      .update(items)
      .set({ status: "stolen", updatedAt: new Date() })
      .where(eq(items.id, body.itemId)),
  ]);

  return c.json({ report: reportRows[0] }, 201);
});

// ── List user's reports ──────────────────────────────────────────

reportRoutes.get("/reports", requireAuth, async (c) => {
  const db = getDb();

  const reports = await db
    .select()
    .from(theftReports)
    .where(eq(theftReports.reporterId, c.var.userId!))
    .orderBy(theftReports.createdAt);

  return c.json({ reports });
});
