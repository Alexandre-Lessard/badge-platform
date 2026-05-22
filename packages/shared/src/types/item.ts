import type { ItemCategory } from "../constants/categories.js";
import type { ItemStatus } from "../constants/item-status.js";

export type Item = {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  category: ItemCategory;
  brand: string | null;
  model: string | null;
  year: number | null;
  serialNumber: string | null;
  trackerId: string | null;
  estimatedValue: number | null;
  purchaseDate: string | null;
  status: ItemStatus;
  badgeCode: string | null;
  archivedAt: string | null;
  archiveReason: string | null;
  archiveReasonCustom: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ItemPhoto = {
  id: string;
  itemId: string;
  url: string;
  caption: string | null;
  isPrimary: boolean;
};

export type ItemDocument = {
  id: string;
  itemId: string;
  url: string;
  type: string;
  fileName: string;
};

export type ItemWithFiles = Item & {
  photos: ItemPhoto[];
  documents: ItemDocument[];
};

export type LookupResult = {
  found: boolean;
  status?: ItemStatus;
  category?: ItemCategory;
  brand?: string | null;
  model?: string | null;
};
