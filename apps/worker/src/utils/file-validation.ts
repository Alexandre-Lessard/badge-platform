import { fileTypeFromBuffer } from "file-type";
import { FILE_TYPE_UNKNOWN, FILE_TYPE_NOT_ALLOWED, FILE_TOO_LARGE } from "@rnbp/shared";
import { AppError } from "./errors.js";

const ALLOWED_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const ALLOWED_DOC_MIMES = new Set([
  ...ALLOWED_IMAGE_MIMES,
  "application/pdf",
]);

/**
 * Validate file by checking magic bytes (not just Content-Type header).
 * Returns the detected MIME type.
 */
export async function validateFileType(
  buffer: Buffer,
  allowedSet: "image" | "document",
): Promise<string> {
  const result = await fileTypeFromBuffer(buffer);

  if (!result) {
    throw new AppError(400, FILE_TYPE_UNKNOWN, "Unrecognized file type");
  }

  const allowed =
    allowedSet === "image" ? ALLOWED_IMAGE_MIMES : ALLOWED_DOC_MIMES;

  if (!allowed.has(result.mime)) {
    throw new AppError(
      400,
      FILE_TYPE_NOT_ALLOWED,
      `File type not allowed: ${result.mime}. Accepted: ${[...allowed].join(", ")}`,
    );
  }

  return result.mime;
}

/**
 * Validate file size.
 */
export function validateFileSize(
  buffer: Buffer,
  maxSizeBytes: number,
): void {
  if (buffer.length > maxSizeBytes) {
    const maxMB = Math.round(maxSizeBytes / (1024 * 1024));
    throw new AppError(400, FILE_TOO_LARGE, `File too large. Maximum size: ${maxMB} MB`);
  }
}
