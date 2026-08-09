import type { FastifyInstance } from "fastify";
import { eq, asc } from "drizzle-orm";
import { z } from "zod";
import sharp from "sharp";
import { getDb } from "../db/client.js";
import { items, itemPhotos, itemDocuments } from "../db/schema.js";
import { requireVerifiedEmail } from "../middleware/auth.js";
import { getConfig } from "../config.js";
import { ITEM_NOT_FOUND } from "@badge/shared";
import { AppError, forbidden } from "../utils/errors.js";
import { validateFileType, validateFileSize } from "../utils/file-validation.js";
import { isR2Configured, uploadToR2, deleteFromR2, extractR2Key } from "../utils/r2.js";

const uuidSchema = z.string().uuid("Invalid identifier");

const MAX_PHOTOS_PER_ITEM = 5;
const MAX_DOCUMENTS_PER_ITEM = 10;
const PHOTO_MAX_WIDTH = 1920;
const PHOTO_QUALITY = 80;

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

export async function uploadRoutes(app: FastifyInstance) {
  // ── Upload photos ──────────────────────────────────────────────────

  app.post(
    "/items/:id/photos",
    { preHandler: requireVerifiedEmail },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      uuidSchema.parse(id);

      if (!isR2Configured()) {
        throw new AppError(503, "UPLOAD_NOT_CONFIGURED", "File upload is not configured");
      }

      await verifyOwnership(id, request.userId!);

      const config = getConfig();
      const db = getDb();

      // Check existing photo count
      const existingPhotos = await db
        .select({ id: itemPhotos.id })
        .from(itemPhotos)
        .where(eq(itemPhotos.itemId, id));

      const parts = request.files();
      const created: Array<{ id: string; url: string; caption: string | null; isPrimary: boolean }> = [];
      let count = existingPhotos.length;

      for await (const part of parts) {
        if (count >= MAX_PHOTOS_PER_ITEM) break;

        const buffer = await part.toBuffer();
        validateFileSize(buffer, config.MAX_FILE_SIZE);
        await validateFileType(buffer, "image");

        // Resize to max width, convert to webp
        const processed = await sharp(buffer)
          .resize(PHOTO_MAX_WIDTH, undefined, { withoutEnlargement: true })
          .webp({ quality: PHOTO_QUALITY })
          .toBuffer();

        const fileId = crypto.randomUUID();
        const key = `items/${id}/photos/${fileId}.webp`;
        const url = await uploadToR2(key, processed, "image/webp");

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

      return reply.status(201).send({
        photos: created,
        maxReached: count >= MAX_PHOTOS_PER_ITEM,
      });
    },
  );

  // ── Upload documents ───────────────────────────────────────────────

  app.post(
    "/items/:id/documents",
    { preHandler: requireVerifiedEmail },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      uuidSchema.parse(id);

      if (!isR2Configured()) {
        throw new AppError(503, "UPLOAD_NOT_CONFIGURED", "File upload is not configured");
      }

      await verifyOwnership(id, request.userId!);

      const config = getConfig();
      const db = getDb();

      const existingDocs = await db
        .select({ id: itemDocuments.id })
        .from(itemDocuments)
        .where(eq(itemDocuments.itemId, id));

      const parts = request.files();
      const created: Array<{ id: string; url: string; type: string; fileName: string }> = [];
      let count = existingDocs.length;

      for await (const part of parts) {
        if (count >= MAX_DOCUMENTS_PER_ITEM) break;
        const buffer = await part.toBuffer();
        validateFileSize(buffer, config.MAX_FILE_SIZE);
        const mime = await validateFileType(buffer, "document");

        let processed: Buffer;
        let ext: string;
        let contentType: string;

        if (mime === "application/pdf") {
          processed = buffer;
          ext = "pdf";
          contentType = "application/pdf";
        } else {
          // Resize images
          processed = await sharp(buffer)
            .resize(PHOTO_MAX_WIDTH, undefined, { withoutEnlargement: true })
            .webp({ quality: PHOTO_QUALITY })
            .toBuffer();
          ext = "webp";
          contentType = "image/webp";
        }

        const fileId = crypto.randomUUID();
        const key = `items/${id}/docs/${fileId}.${ext}`;
        const url = await uploadToR2(key, processed, contentType);

        const [doc] = await db
          .insert(itemDocuments)
          .values({
            itemId: id,
            url,
            type: mime,
            fileName: sanitizeFilename(part.filename || `document.${ext}`),
          })
          .returning();

        created.push({
          id: doc.id,
          url: doc.url,
          type: doc.type,
          fileName: doc.fileName,
        });
        count++;
      }

      return reply.status(201).send({
        documents: created,
        maxReached: count >= MAX_DOCUMENTS_PER_ITEM,
      });
    },
  );

  // ── Delete photo ───────────────────────────────────────────────────

  app.delete(
    "/items/:id/photos/:photoId",
    { preHandler: requireVerifiedEmail },
    async (request, reply) => {
      const { id, photoId } = request.params as { id: string; photoId: string };
      uuidSchema.parse(id);
      uuidSchema.parse(photoId);

      await verifyOwnership(id, request.userId!);

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

      await db.transaction(async (tx) => {
        await tx.delete(itemPhotos).where(eq(itemPhotos.id, photoId));

        if (photo.isPrimary) {
          await tx
            .update(itemPhotos)
            .set({ isPrimary: false })
            .where(eq(itemPhotos.itemId, id));

          const [nextPrimary] = await tx
            .select({ id: itemPhotos.id })
            .from(itemPhotos)
            .where(eq(itemPhotos.itemId, id))
            .orderBy(asc(itemPhotos.createdAt))
            .limit(1);

          if (nextPrimary) {
            await tx
              .update(itemPhotos)
              .set({ isPrimary: true })
              .where(eq(itemPhotos.id, nextPrimary.id));
          }
        }
      });

      return reply.status(204).send();
    },
  );

  // ── Delete document ────────────────────────────────────────────────

  app.delete(
    "/items/:id/documents/:docId",
    { preHandler: requireVerifiedEmail },
    async (request, reply) => {
      const { id, docId } = request.params as { id: string; docId: string };
      uuidSchema.parse(id);
      uuidSchema.parse(docId);

      await verifyOwnership(id, request.userId!);

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
      return reply.status(204).send();
    },
  );
}
