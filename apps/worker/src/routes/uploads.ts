import { Hono } from "hono";
import { eq, asc } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/client.js";
import { items, itemPhotos, itemDocuments } from "../db/schema.js";
import { requireVerifiedEmail } from "../middleware/auth.js";
import { getConfig } from "../config.js";
import { ITEM_NOT_FOUND } from "@rnbp/shared";
import { AppError, forbidden } from "../utils/errors.js";
import { validateFileType, validateFileSize } from "../utils/file-validation.js";
import { isR2Configured, uploadToR2, deleteFromR2, extractR2Key } from "../utils/r2.js";
import type { AppEnv } from "../context.js";

const uuidSchema = z.string().uuid("Invalid identifier");

const MAX_PHOTOS_PER_ITEM = 5;
const MAX_DOCUMENTS_PER_ITEM = 10;

// Images arrive already resized to WebP by the browser (see
// apps/web/src/lib/image-resize.ts) — sharp is a native addon and cannot run
// on Workers, so the resize moved client-side.
const EXTENSION_BY_MIME: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/pdf": "pdf",
};

function sanitizeFilename(name: string): string {
  return name.replace(/[^\w.\-() ]/g, "_").slice(0, 200);
}

async function verifyOwnership(itemId: string, userId: string) {
  const db = getDb();
  const [item] = await db
    .select({ ownerId: items.ownerId })
    .from(items)
    .where(eq(items.id, itemId))
    .limit(1);

  if (!item) throw new AppError(404, ITEM_NOT_FOUND, "Item not found");
  if (item.ownerId !== userId) throw forbidden();
}

async function collectUploads(request: Request): Promise<File[]> {
  const form = await request.formData();
  const files: File[] = [];
  for (const value of form.values()) {
    if (value instanceof File) files.push(value);
  }
  return files;
}

export const uploadRoutes = new Hono<AppEnv>();

// ── Upload photos ──────────────────────────────────────────────────

uploadRoutes.post("/items/:id/photos", requireVerifiedEmail, async (c) => {
  const id = c.req.param("id");
  uuidSchema.parse(id);

  if (!isR2Configured()) {
    throw new AppError(503, "UPLOAD_NOT_CONFIGURED", "File upload is not configured");
  }

  await verifyOwnership(id, c.var.userId!);

  const config = getConfig();
  const db = getDb();

  // Check existing photo count
  const existingPhotos = await db
    .select({ id: itemPhotos.id })
    .from(itemPhotos)
    .where(eq(itemPhotos.itemId, id));

  const uploads = await collectUploads(c.req.raw);
  const created: Array<{ id: string; url: string; caption: string | null; isPrimary: boolean }> = [];
  let count = existingPhotos.length;

  for (const upload of uploads) {
    if (count >= MAX_PHOTOS_PER_ITEM) break;

    const buffer = Buffer.from(await upload.arrayBuffer());
    validateFileSize(buffer, config.MAX_FILE_SIZE);
    const mime = await validateFileType(buffer, "image");

    const fileId = crypto.randomUUID();
    const key = `items/${id}/photos/${fileId}.${EXTENSION_BY_MIME[mime] ?? "bin"}`;
    const url = await uploadToR2(key, buffer, mime);

    const isPrimary = count === 0;
    const [photo] = await db
      .insert(itemPhotos)
      .values({ itemId: id, url, isPrimary })
      .returning();

    created.push({
      id: photo.id,
      url: photo.url,
      caption: photo.caption,
      isPrimary: photo.isPrimary,
    });
    count++;
  }

  return c.json({ photos: created, maxReached: count >= MAX_PHOTOS_PER_ITEM }, 201);
});

// ── Upload documents ───────────────────────────────────────────────

uploadRoutes.post("/items/:id/documents", requireVerifiedEmail, async (c) => {
  const id = c.req.param("id");
  uuidSchema.parse(id);

  if (!isR2Configured()) {
    throw new AppError(503, "UPLOAD_NOT_CONFIGURED", "File upload is not configured");
  }

  await verifyOwnership(id, c.var.userId!);

  const config = getConfig();
  const db = getDb();

  const existingDocs = await db
    .select({ id: itemDocuments.id })
    .from(itemDocuments)
    .where(eq(itemDocuments.itemId, id));

  const uploads = await collectUploads(c.req.raw);
  const created: Array<{ id: string; url: string; type: string; fileName: string }> = [];
  let count = existingDocs.length;

  for (const upload of uploads) {
    if (count >= MAX_DOCUMENTS_PER_ITEM) break;

    const buffer = Buffer.from(await upload.arrayBuffer());
    validateFileSize(buffer, config.MAX_FILE_SIZE);
    const mime = await validateFileType(buffer, "document");

    const ext = EXTENSION_BY_MIME[mime] ?? "bin";
    const fileId = crypto.randomUUID();
    const key = `items/${id}/docs/${fileId}.${ext}`;
    const url = await uploadToR2(key, buffer, mime);

    const [doc] = await db
      .insert(itemDocuments)
      .values({
        itemId: id,
        url,
        type: mime,
        fileName: sanitizeFilename(upload.name || `document.${ext}`),
      })
      .returning();

    created.push({ id: doc.id, url: doc.url, type: doc.type, fileName: doc.fileName });
    count++;
  }

  return c.json({ documents: created, maxReached: count >= MAX_DOCUMENTS_PER_ITEM }, 201);
});

// ── Delete photo ───────────────────────────────────────────────────

uploadRoutes.delete("/items/:id/photos/:photoId", requireVerifiedEmail, async (c) => {
  const id = c.req.param("id");
  const photoId = c.req.param("photoId");
  uuidSchema.parse(id);
  uuidSchema.parse(photoId);

  await verifyOwnership(id, c.var.userId!);

  const db = getDb();
  const [photo] = await db
    .select()
    .from(itemPhotos)
    .where(eq(itemPhotos.id, photoId))
    .limit(1);

  if (!photo || photo.itemId !== id) {
    throw new AppError(404, "PHOTO_NOT_FOUND", "Photo not found");
  }

  // Delete from R2
  const key = extractR2Key(photo.url);
  if (key) {
    try {
      await deleteFromR2(key);
    } catch {
      // Non-blocking — file may already be gone
    }
  }

  await db.delete(itemPhotos).where(eq(itemPhotos.id, photoId));

  if (photo.isPrimary) {
    const [nextPrimary] = await db
      .select({ id: itemPhotos.id })
      .from(itemPhotos)
      .where(eq(itemPhotos.itemId, id))
      .orderBy(asc(itemPhotos.createdAt))
      .limit(1);

    if (nextPrimary) {
      await db
        .update(itemPhotos)
        .set({ isPrimary: true })
        .where(eq(itemPhotos.id, nextPrimary.id));
    }
  }

  return c.body(null, 204);
});

// ── Delete document ────────────────────────────────────────────────

uploadRoutes.delete("/items/:id/documents/:docId", requireVerifiedEmail, async (c) => {
  const id = c.req.param("id");
  const docId = c.req.param("docId");
  uuidSchema.parse(id);
  uuidSchema.parse(docId);

  await verifyOwnership(id, c.var.userId!);

  const db = getDb();
  const [doc] = await db
    .select()
    .from(itemDocuments)
    .where(eq(itemDocuments.id, docId))
    .limit(1);

  if (!doc || doc.itemId !== id) {
    throw new AppError(404, "DOCUMENT_NOT_FOUND", "Document not found");
  }

  const key = extractR2Key(doc.url);
  if (key) {
    try {
      await deleteFromR2(key);
    } catch {
      // Non-blocking
    }
  }

  await db.delete(itemDocuments).where(eq(itemDocuments.id, docId));
  return c.body(null, 204);
});
