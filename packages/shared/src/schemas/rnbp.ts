import { z } from "zod";

/**
 * RNBP code format: "RNBP-XXXXXXXX" where X is in the ambiguity-free
 * base-32 alphabet (excludes 0, 1, I, L, O).
 */
export const RNBP_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const RNBP_REGEX = /^RNBP-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/;

export const rnbpNumberSchema = z
  .string()
  .regex(RNBP_REGEX, "INVALID_RNBP_FORMAT");

/** Strict normalization: strip whitespace, uppercase. */
export function normalizeRnbpCode(input: string): string {
  return input.replace(/\s+/g, "").toUpperCase();
}
