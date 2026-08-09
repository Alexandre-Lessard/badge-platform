import { Hono } from "hono";
import { eq, and, isNull, or, sql, inArray, asc } from "drizzle-orm";
import { z } from "zod";
import { createItemSchema, updateItemSchema, archiveItemSchema } from "@rnbp/shared";
import { getDb } from "../db/client.js";
import { items, itemPhotos, itemDocuments, theftReports } from "../db/schema.js";
import { requireVerifiedEmail } from "../middleware/auth.js";
import { ITEM_NOT_FOUND, ITEM_ALREADY_STOLEN, ITEM_NOT_STOLEN } from "@rnbp/shared";
import { AppError, forbidden } from "../utils/errors.js";
import { isR2Configured, deleteFromR2, extractR2Key } from "../utils/r2.js";
import { pickPrimaryPhotoUrl, sortPhotosForDisplay } from "../utils/item-photos.js";
import type { AppEnv } from "../context.js";

const uuidSchema = z.string().uuid("Invalid identifier");

export const itemRoutes = new Hono<AppEnv>();

// ── List user's items ────────────────────────────────────────────

itemRoutes.get("/items", requireVerifiedEmail, async (c) => {
  const db = getDb();
  const archived = c.req.query("archived");

  const conditions =
    archived === "true"
      ? eq(items.ownerId, c.var.userId!)
      : and(eq(items.ownerId, c.var.userId!), isNull(items.archivedAt));

  const userItems = await db.select().from(items).where(conditions).orderBy(items.createdAt);

  // Fetch primary photo for each item (for thumbnail display)
  const itemIds = userItems.map((i) => i.id);
  const photos =
    itemIds.length > 0
      ? await db
          .select({
            itemId: itemPhotos.itemId,
            url: itemPhotos.url,
            isPrimary: itemPhotos.isPrimary,
          })
          .from(itemPhotos)
          .where(inArray(itemPhotos.itemId, itemIds))
          .orderBy(asc(itemPhotos.createdAt))
      : [];

  const photosByItem = new Map<string, Array<{ url: string; isPrimary: boolean }>>();
  for (const p of photos) {
    const current = photosByItem.get(p.itemId) ?? [];
    current.push({ url: p.url, isPrimary: p.isPrimary });
    photosByItem.set(p.itemId, current);
  }

  const result = userItems.map((item) => ({
    ...item,
    primaryPhotoUrl: pickPrimaryPhotoUrl(photosByItem.get(item.id) ?? []),
  }));

  return c.json({ items: result });
});

// ── Create item ──────────────────────────────────────────────────

itemRoutes.post("/items", requireVerifiedEmail, async (c) => {
  const body = createItemSchema.parse(await c.req.json());
  const db = getDb();

  const [item] = await db
    .insert(items)
    .values({
      ownerId: c.var.userId!,
      name: body.name,
      description: body.description ?? null,
      category: body.category,
      brand: body.brand ?? null,
      model: body.model ?? null,
      year: body.year ?? null,
      serialNumber: body.serialNumber ?? null,
      trackerId: body.trackerId ?? null,
      estimatedValue: body.estimatedValue ?? null,
      purchaseDate: body.purchaseDate ? new Date(body.purchaseDate) : null,
      isInsured: body.isInsured ?? false,
      insurerId: body.insurerId ?? null,
      insurerName: body.insurerName ?? null,
    })
    .returning();

  return c.json({ item }, 201);
});

// ── Get item by ID ───────────────────────────────────────────────

itemRoutes.get("/items/:id", requireVerifiedEmail, async (c) => {
  const id = c.req.param("id");
  uuidSchema.parse(id);
  const db = getDb();

  const [item] = await db.select().from(items).where(eq(items.id, id)).limit(1);

  if (!item) throw new AppError(404, ITEM_NOT_FOUND, "Item not found");
  if (item.ownerId !== c.var.userId!) throw forbidden();

  const rawPhotos = await db
    .select()
    .from(itemPhotos)
    .where(eq(itemPhotos.itemId, id))
    .orderBy(asc(itemPhotos.createdAt));

  const photos = sortPhotosForDisplay(rawPhotos);

  const documents = await db
    .select()
    .from(itemDocuments)
    .where(eq(itemDocuments.itemId, id))
    .orderBy(asc(itemDocuments.createdAt));

  return c.json({ item: { ...item, photos, documents } });
});

// ── Update item ──────────────────────────────────────────────────

itemRoutes.patch("/items/:id", requireVerifiedEmail, async (c) => {
  const id = c.req.param("id");
  uuidSchema.parse(id);
  const body = updateItemSchema.parse(await c.req.json());
  const db = getDb();

  const [existing] = await db
    .select({ ownerId: items.ownerId })
    .from(items)
    .where(eq(items.id, id))
    .limit(1);

  if (!existing) throw new AppError(404, ITEM_NOT_FOUND, "Item not found");
  if (existing.ownerId !== c.var.userId!) throw forbidden();

  const [updated] = await db
    .update(items)
    .set({
      ...body,
      purchaseDate: body.purchaseDate ? new Date(body.purchaseDate) : undefined,
      updatedAt: new Date(),
    })
    .where(eq(items.id, id))
    .returning();

  return c.json({ item: updated });
});

// ── Archive item ─────────────────────────────────────────────────

itemRoutes.post("/items/:id/archive", requireVerifiedEmail, async (c) => {
  const id = c.req.param("id");
  uuidSchema.parse(id);
  const body = archiveItemSchema.parse(await c.req.json());
  const db = getDb();

  const [existing] = await db
    .select({ ownerId: items.ownerId, status: items.status, archivedAt: items.archivedAt })
    .from(items)
    .where(eq(items.id, id))
    .limit(1);

  if (!existing) throw new AppError(404, ITEM_NOT_FOUND, "Item not found");
  if (existing.ownerId !== c.var.userId!) throw forbidden();
  if (existing.status === "stolen") {
    throw new AppError(400, ITEM_ALREADY_STOLEN, "Cannot archive a stolen item");
  }
  if (existing.archivedAt) {
    throw new AppError(400, "ITEM_ALREADY_ARCHIVED", "Item is already archived");
  }

  const [updated] = await db
    .update(items)
    .set({
      archivedAt: new Date(),
      archiveReason: body.reason,
      archiveReasonCustom: body.reason === "other" ? body.customReason ?? null : null,
      updatedAt: new Date(),
    })
    .where(eq(items.id, id))
    .returning();

  return c.json({ item: updated });
});

// ── Recover item (stolen → recovered) ────────────────────────────

itemRoutes.patch("/items/:id/recover", requireVerifiedEmail, async (c) => {
  const id = c.req.param("id");
  uuidSchema.parse(id);
  const db = getDb();

  const [existing] = await db
    .select({ ownerId: items.ownerId, status: items.status })
    .from(items)
    .where(eq(items.id, id))
    .limit(1);

  if (!existing) throw new AppError(404, ITEM_NOT_FOUND, "Item not found");
  if (existing.ownerId !== c.var.userId!) throw forbidden();
  if (existing.status !== "stolen") {
    throw new AppError(400, ITEM_NOT_STOLEN, "Item is not marked as stolen");
  }

  // Update item status + resolve theft report atomically (D1 batch)
  const now = new Date();
  const [updatedRows] = await db.batch([
    db
      .update(items)
      .set({ status: "active", updatedAt: now })
      .where(eq(items.id, id))
      .returning(),
    db
      .update(theftReports)
      .set({ status: "resolved", updatedAt: now })
      .where(and(eq(theftReports.itemId, id), eq(theftReports.status, "pending"))),
  ]);

  return c.json({ item: updatedRows[0] });
});

// ── Delete item ──────────────────────────────────────────────────

itemRoutes.delete("/items/:id", requireVerifiedEmail, async (c) => {
  const id = c.req.param("id");
  uuidSchema.parse(id);
  const db = getDb();

  const [existing] = await db
    .select({ ownerId: items.ownerId })
    .from(items)
    .where(eq(items.id, id))
    .limit(1);

  if (!existing) throw new AppError(404, ITEM_NOT_FOUND, "Item not found");
  if (existing.ownerId !== c.var.userId!) throw forbidden();

  // Clean up R2 files before DB cascade delete
  if (isR2Configured()) {
    const photos = await db
      .select({ url: itemPhotos.url })
      .from(itemPhotos)
      .where(eq(itemPhotos.itemId, id));
    const docs = await db
      .select({ url: itemDocuments.url })
      .from(itemDocuments)
      .where(eq(itemDocuments.itemId, id));
    const allUrls = [...photos, ...docs].map((f) => extractR2Key(f.url)).filter(Boolean) as string[];
    const results = await Promise.allSettled(allUrls.map((key) => deleteFromR2(key)));
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        console.warn(`Failed to delete R2 file ${allUrls[i]}: ${r.reason}`);
      }
    });
  }

  await db.delete(items).where(eq(items.id, id));

  return c.body(null, 204);
});

// ── Public unified lookup (badge code or serial number) ─────────

itemRoutes.get("/lookup", async (c) => {
  const q = c.req.query("q");
  if (!q || !q.trim()) {
    return c.json({ found: false });
  }

  const db = getDb();
  const query = q.trim().toUpperCase();
  // Normalize: strip spaces, dashes, underscores for serial number comparison
  const normalized = query.replace(/[\s\-_]/g, "");

  const [item] = await db
    .select({
      status: items.status,
      category: items.category,
      brand: items.brand,
      model: items.model,
    })
    .from(items)
    .where(
      or(
        eq(items.badgeCode, query),
        sql`upper(replace(replace(replace(${items.serialNumber}, ' ', ''), '-', ''), '_', '')) = ${normalized}`,
      ),
    )
    .limit(1);

  if (!item) {
    return c.json({ found: false });
  }

  return c.json({
    found: true,
    status: item.status,
    category: item.category,
    brand: item.brand,
    model: item.model,
  });
});

// ── Public lookup by badge code (backward compat) ────────────

itemRoutes.get("/lookup/:badgeCode", async (c) => {
  const badgeCode = c.req.param("badgeCode");
  const db = getDb();

  const [item] = await db
    .select({
      status: items.status,
      category: items.category,
      brand: items.brand,
      model: items.model,
    })
    .from(items)
    .where(eq(items.badgeCode, badgeCode.toUpperCase()))
    .limit(1);

  if (!item) {
    return c.json({ found: false });
  }

  return c.json({
    found: true,
    status: item.status,
    category: item.category,
    brand: item.brand,
    model: item.model,
  });
});
