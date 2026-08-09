import { getConfig } from "../config.js";
import type { Bindings } from "../config.js";

// R2 access goes through the Worker's native bucket binding instead of the
// S3 SDK (@aws-sdk/client-s3 does not run on Workers, and the binding needs
// no credentials).
let bucket: R2Bucket | undefined;

export function initR2(env: Bindings) {
  bucket = env.UPLOADS;
}

function getPublicBaseUrl(): string {
  const c = getConfig();
  return (c.R2_PUBLIC_URL || "").replace(/\/+$/, "");
}

export function isR2Configured(): boolean {
  return !!bucket && !!getConfig().R2_PUBLIC_URL;
}

function getBucket(): R2Bucket {
  if (!bucket) {
    throw new Error("R2 bucket binding not initialized");
  }
  return bucket;
}

/**
 * Upload a file to R2 and return its public URL.
 */
export async function uploadToR2(
  key: string,
  body: ArrayBuffer | Uint8Array,
  contentType: string,
): Promise<string> {
  await getBucket().put(key, body, {
    httpMetadata: { contentType },
  });
  return `${getPublicBaseUrl()}/${key}`;
}

/**
 * Delete a file from R2.
 */
export async function deleteFromR2(key: string): Promise<void> {
  await getBucket().delete(key);
}

/**
 * Extract the R2 object key from a full public URL.
 */
export function extractR2Key(url: string): string | null {
  const baseUrl = getPublicBaseUrl();
  const normalizedUrl = url.trim();
  const expectedPrefix = `${baseUrl}/`;

  if (normalizedUrl.startsWith(expectedPrefix)) {
    return normalizedUrl.slice(expectedPrefix.length);
  }

  return null;
}
