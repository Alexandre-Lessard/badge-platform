import { z } from "zod";
import { ITEM_CATEGORIES } from "../constants/categories.js";

// Trims input and normalizes empty/undefined for PATCH-safe semantics:
// - undefined (field omitted) → undefined → Drizzle .set() skips the column
// - "" or whitespace-only     → null      → Drizzle .set() writes NULL
// - "  abc  "                 → "abc"     → Drizzle .set() writes "abc"
const optionalTrimmedString = (maxLen: number) =>
  z
    .string()
    .max(maxLen)
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      const t = v.trim();
      return t === "" ? null : t;
    });

export const createItemSchema = z.object({
  name: z.string().min(1, "Name required").max(255),
  category: z.enum(ITEM_CATEGORIES, {
    errorMap: () => ({ message: "Invalid category" }),
  }),
  brand: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  serialNumber: optionalTrimmedString(255),
  trackerId: optionalTrimmedString(255),
  estimatedValue: z.number().int().min(250, "Minimum value $250").optional(),
  purchaseDate: z.string().datetime().optional(),
  description: z.string().max(2000).optional(),
});

export const updateItemSchema = createItemSchema.partial();

export const archiveItemSchema = z.object({
  reason: z.enum(["destroyed", "lost", "discarded", "registration_error", "other"]),
  customReason: z.string().max(500).optional(),
});

export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
export type ArchiveItemInput = z.infer<typeof archiveItemSchema>;
