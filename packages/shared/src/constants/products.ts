/**
 * Product slugs used across backend and frontend.
 * Single source of truth — never hardcode the literal string.
 */
export const PRODUCT_SLUGS = {
  STICKER_SHEET: "sticker-sheet",
  DOOR_STICKER: "door-sticker",
} as const;

export type ProductSlug = (typeof PRODUCT_SLUGS)[keyof typeof PRODUCT_SLUGS];

/** Number of unique RNBP codes per sticker sheet. */
export const CODES_PER_SHEET = 10;
