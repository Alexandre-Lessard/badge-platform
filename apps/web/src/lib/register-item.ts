import { ITEM_CATEGORIES, createItemSchema, type CreateItemInput } from "@rnbp/shared";

export type ItemFormData = {
  name: string;
  category: string;
  brand: string;
  model: string;
  year: string;
  serialNumber: string;
  trackerId: string;
  estimatedValue: string;
  description: string;
};

const WHOLE_NUMBER_PATTERN = /^\d+$/;

function normalizeOptionalText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function parseOptionalWholeNumber(value: string): number | string | undefined {
  const trimmed = value.trim();
  if (trimmed === "") {
    return undefined;
  }

  return WHOLE_NUMBER_PATTERN.test(trimmed)
    ? Number(trimmed)
    : trimmed;
}

export function isKnownItemCategory(category: string): boolean {
  return ITEM_CATEGORIES.includes(category as (typeof ITEM_CATEGORIES)[number]);
}

export function isWholeNumberString(value: string): boolean {
  const trimmed = value.trim();
  return trimmed === "" || WHOLE_NUMBER_PATTERN.test(trimmed);
}

export function isValidRegistrationYear(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === "") {
    return true;
  }

  if (!WHOLE_NUMBER_PATTERN.test(trimmed)) {
    return false;
  }

  const year = Number(trimmed);
  const maxYear = new Date().getFullYear() + 1;

  return year >= 1900 && year <= maxYear;
}

export function isValidEstimatedValue(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === "") {
    return true;
  }

  if (!WHOLE_NUMBER_PATTERN.test(trimmed)) {
    return false;
  }

  return Number(trimmed) >= 250;
}

export function sanitizeItemDraft(draft: unknown, fallback: ItemFormData): ItemFormData {
  if (!draft || typeof draft !== "object") {
    return fallback;
  }

  const data = draft as Partial<Record<keyof ItemFormData, unknown>>;

  return {
    name: typeof data.name === "string" ? data.name : fallback.name,
    category: typeof data.category === "string" && isKnownItemCategory(data.category)
      ? data.category
      : fallback.category,
    brand: typeof data.brand === "string" ? data.brand : fallback.brand,
    model: typeof data.model === "string" ? data.model : fallback.model,
    year: typeof data.year === "string" ? data.year : fallback.year,
    serialNumber: typeof data.serialNumber === "string" ? data.serialNumber : fallback.serialNumber,
    trackerId: typeof data.trackerId === "string" ? data.trackerId : fallback.trackerId,
    estimatedValue: typeof data.estimatedValue === "string" ? data.estimatedValue : fallback.estimatedValue,
    description: typeof data.description === "string" ? data.description : fallback.description,
  };
}

export function buildCreateItemInput(itemData: ItemFormData):
  | { data: CreateItemInput; error: null }
  | { data: null; error: string } {
  const parsed = createItemSchema.safeParse({
    name: itemData.name.trim(),
    category: itemData.category.trim(),
    brand: normalizeOptionalText(itemData.brand),
    model: normalizeOptionalText(itemData.model),
    year: parseOptionalWholeNumber(itemData.year),
    serialNumber: normalizeOptionalText(itemData.serialNumber),
    trackerId: normalizeOptionalText(itemData.trackerId),
    estimatedValue: parseOptionalWholeNumber(itemData.estimatedValue),
    description: normalizeOptionalText(itemData.description),
  });

  if (!parsed.success) {
    return {
      data: null,
      error: parsed.error.issues.map((issue) => issue.message).join(", "),
    };
  }

  return {
    data: parsed.data,
    error: null,
  };
}
