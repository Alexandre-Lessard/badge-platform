import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

// D1/SQLite port of apps/api/src/db/schema.ts (Postgres).
// Conversions: uuid → text (crypto.randomUUID() default), timestamp →
// integer(mode: "timestamp_ms"), boolean → integer(mode: "boolean"),
// pg enums → text with runtime validation, text[] → text(mode: "json").

const uuidPk = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const timestamps = () => ({
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Item status transitions:
//   active → stolen      (theft report via POST /reports)
//   stolen → recovered   (item recovered — admin/future)
//   active → transferred (ownership transfer — future)
export const ITEM_STATUSES = ["active", "stolen", "recovered", "transferred"] as const;
export const REPORT_STATUSES = ["pending", "confirmed", "resolved", "dismissed"] as const;
export const PARTNER_TYPES = ["insurer", "retailer", "security", "other"] as const;
export const ORDER_STATUSES = ["pending", "paid", "shipped", "cancelled"] as const;

// ── Users ──────────────────────────────────────────────────────────────

export const users = sqliteTable("users", {
  id: uuidPk(),
  email: text("email").notNull().unique(),
  // Optional public-facing contact email (relay destination when someone finds
  // one of the user's stolen items). Falls back to `email` if empty.
  contactEmail: text("contact_email"),
  passwordHash: text("password_hash"),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phone: text("phone"),
  address1: text("address_1"),
  address2: text("address_2"),
  city: text("city"),
  province: text("province"),
  postalCode: text("postal_code"),
  country: text("country"),
  googleId: text("google_id").unique(),
  microsoftId: text("microsoft_id").unique(),
  facebookId: text("facebook_id").unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
  clientNumber: text("client_number").unique(),
  preferredLanguage: text("preferred_language").notNull().default("fr"),
  termsAcceptedAt: integer("terms_accepted_at", { mode: "timestamp_ms" }),
  // Mass revocation: all tokens issued BEFORE this timestamp are rejected.
  // Updated on password reset to invalidate all sessions.
  tokenRevokedBefore: integer("token_revoked_before", { mode: "timestamp_ms" }),
  ...timestamps(),
});

// ── Sessions ───────────────────────────────────────────────────────────

export const sessions = sqliteTable(
  "sessions",
  {
    id: uuidPk(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(), // SHA-256 of the refresh token (never stored in plaintext)
    deviceInfo: text("device_info"),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)],
);

// ── Items ──────────────────────────────────────────────────────────────

export const items = sqliteTable(
  "items",
  {
    id: uuidPk(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    category: text("category").notNull(),
    brand: text("brand"),
    model: text("model"),
    year: integer("year"),
    serialNumber: text("serial_number"),
    trackerId: text("tracker_id"),
    estimatedValue: integer("estimated_value"),
    purchaseDate: integer("purchase_date", { mode: "timestamp_ms" }),
    // Insurance coverage (optional, informational)
    isInsured: integer("is_insured", { mode: "boolean" }).notNull().default(false),
    insurerId: text("insurer_id"),
    insurerName: text("insurer_name"),
    status: text("status", { enum: ITEM_STATUSES }).notNull().default("active"),
    // Format: BADGE-XXXXXXXX — manually assigned by admin when processing orders
    // Null = not yet assigned (pending sticker purchase)
    badgeCode: text("badge_code").unique(),
    archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
    archiveReason: text("archive_reason"),
    archiveReasonCustom: text("archive_reason_custom"),
    ...timestamps(),
  },
  (table) => [
    index("items_owner_id_idx").on(table.ownerId),
    index("items_badge_code_idx").on(table.badgeCode),
    index("items_status_idx").on(table.status),
  ],
);

// ── Item Photos ────────────────────────────────────────────────────────

export const itemPhotos = sqliteTable(
  "item_photos",
  {
    id: uuidPk(),
    itemId: text("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    caption: text("caption"),
    isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [index("item_photos_item_id_idx").on(table.itemId)],
);

// ── Item Documents ─────────────────────────────────────────────────────

export const itemDocuments = sqliteTable(
  "item_documents",
  {
    id: uuidPk(),
    itemId: text("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    type: text("type").notNull(),
    fileName: text("file_name").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [index("item_documents_item_id_idx").on(table.itemId)],
);

// ── Theft Reports ──────────────────────────────────────────────────────

export const theftReports = sqliteTable(
  "theft_reports",
  {
    id: uuidPk(),
    itemId: text("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    reporterId: text("reporter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    policeReportNumber: text("police_report_number"),
    theftDate: integer("theft_date", { mode: "timestamp_ms" }),
    theftLocation: text("theft_location"),
    description: text("description"),
    status: text("status", { enum: REPORT_STATUSES }).notNull().default("pending"),
    ...timestamps(),
  },
  (table) => [
    index("theft_reports_item_id_idx").on(table.itemId),
    index("theft_reports_reporter_id_idx").on(table.reporterId),
  ],
);

// ── Insurance Requests ─────────────────────────────────────────────────

export const insuranceRequests = sqliteTable("insurance_requests", {
  id: uuidPk(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  insurerName: text("insurer_name").notNull(),
  messageContent: text("message_content").notNull(),
  sentAt: integer("sent_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()), // When the email was sent to the insurer
  createdAt: integer("created_at", { mode: "timestamp_ms" }) // When the request was created (may differ if deferred send)
    .notNull()
    .$defaultFn(() => new Date()),
});

// ── Partners ───────────────────────────────────────────────────────────

export const partners = sqliteTable("partners", {
  id: uuidPk(),
  companyName: text("company_name").notNull(),
  type: text("type", { enum: PARTNER_TYPES }).notNull(),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  website: text("website"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  ...timestamps(),
});

// ── Contact Messages ──────────────────────────────────────────────────

export const contactMessages = sqliteTable("contact_messages", {
  id: uuidPk(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  company: text("company"),
  phone: text("phone"),
  type: text("type", { enum: PARTNER_TYPES }).notNull(),
  message: text("message").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ── Newsletter Subscribers ─────────────────────────────────────────────

export const newsletterSubscribers = sqliteTable("newsletter_subscribers", {
  id: uuidPk(),
  email: text("email").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ── Orders (Boutique Stripe) ──────────────────────────────────────────

export const orders = sqliteTable(
  "orders",
  {
    id: uuidPk(),
    email: text("email").notNull(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    stripeSessionId: text("stripe_session_id").unique(),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    totalAmountCents: integer("total_amount_cents").notNull(),
    status: text("status", { enum: ORDER_STATUSES }).notNull().default("pending"),
    shippingName: text("shipping_name"),
    shippingAddress: text("shipping_address"),
    ...timestamps(),
  },
  (table) => [
    index("orders_user_id_idx").on(table.userId),
    index("orders_stripe_session_id_idx").on(table.stripeSessionId),
  ],
);

export const orderItems = sqliteTable(
  "order_items",
  {
    id: uuidPk(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    itemId: text("item_id").references(() => items.id, { onDelete: "set null" }),
    productId: text("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    badgeCode: text("badge_code"),
    productType: text("product_type").notNull(),
    quantity: integer("quantity").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
  },
  (table) => [
    index("order_items_order_id_idx").on(table.orderId),
    index("order_items_item_id_idx").on(table.itemId),
  ],
);

// ── Sticker codes ──────────────────────────────────────────────────────
//
// Source of truth for badge codes sold to a customer. Each row represents
// one printed code from a sticker sheet. The code is "claimed" when the
// customer assigns it to one of their items via the self-service UI.
//
// items.badgeCode is kept in sync on claim/unclaim — it remains the
// fast denormalized field used by the public /lookup endpoint.

export const stickerCodes = sqliteTable(
  "sticker_codes",
  {
    code: text("code").primaryKey(), // BADGE-XXXXXXXX
    orderItemId: text("order_item_id")
      .notNull()
      .references(() => orderItems.id, { onDelete: "restrict" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    assignedItemId: text("assigned_item_id").references(() => items.id, {
      onDelete: "set null",
    }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    claimedAt: integer("claimed_at", { mode: "timestamp_ms" }),
    voidedAt: integer("voided_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("sticker_codes_user_id_idx").on(table.userId),
    index("sticker_codes_order_item_id_idx").on(table.orderItemId),
    index("sticker_codes_assigned_item_id_idx").on(table.assignedItemId),
  ],
);

// ── Products ──────────────────────────────────────────────────────────

export const products = sqliteTable(
  "products",
  {
    id: uuidPk(),
    slug: text("slug").notNull().unique(),
    nameFr: text("name_fr").notNull(),
    nameEn: text("name_en").notNull(),
    descriptionFr: text("description_fr"),
    descriptionEn: text("description_en"),
    featuresFr: text("features_fr", { mode: "json" }).$type<string[]>(),
    featuresEn: text("features_en", { mode: "json" }).$type<string[]>(),
    priceCents: integer("price_cents").notNull(),
    stripePriceId: text("stripe_price_id"),
    imageUrls: text("image_urls", { mode: "json" }).$type<string[]>().notNull().default([]),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    requiresItem: integer("requires_item", { mode: "boolean" }).notNull().default(false),
    customMechanic: text("custom_mechanic"),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps(),
  },
  (table) => [
    index("products_slug_idx").on(table.slug),
    index("products_sort_order_idx").on(table.sortOrder),
  ],
);
