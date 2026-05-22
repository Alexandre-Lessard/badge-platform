import { z } from "zod";

export const BADGE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const BADGE_CODE_REGEX = /^BADGE-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/;

export const badgeCodeSchema = z
  .string()
  .regex(BADGE_CODE_REGEX, "INVALID_BADGE_FORMAT");

export function normalizeBadgeCode(input: string): string {
  return input.replace(/\s+/g, "").toUpperCase();
}
