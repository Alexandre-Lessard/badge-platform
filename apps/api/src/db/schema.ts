import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  pgEnum,
  integer,
  index,
} from "drizzle-orm/pg-core";

// ── Enums ──────────────────────────────────────────────────────────────

// Item status transitions:
//   active → stolen      (theft report via POST /reports)
//   stolen → recovered   (item recovered — admin/future)
//   active → transferred (ownership transfer — future)
export const itemStatusEnum = pgEnum("item_status", [
  "active",
  "stolen",
  "recovered",
  "transferred",
]);

// Theft report status transitions:
//   pending → confirmed  (admin validation — future)
//   pending → dismissed  (rejected / cancelled)
//   confirmed → resolved (item recovered)
export const reportStatusEnum = pgEnum("report_status", [
  "pending",
  "confirmed",
  "resolved",
  "dismissed",
]);

// ── Users ──────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  // Optional public-facing contact email (relay destination when someone finds
  // one of the user's stolen items). Falls back to `email` if empty.
  contactEmail: varchar("contact_email", { length: 255 }),
  passwordHash: text("password_hash"),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  address1: varchar("address_1", { length: 255 }),
  address2: varchar("address_2", { length: 255 }),
  city: varchar("city", { length: 100 }),
  province: varchar("province", { length: 100 }),
  postalCode: varchar("postal_code", { length: 20 }),
  country: varchar("country", { length: 2 }),
  googleId: varchar("google_id", { length: 255 }).unique(),
  microsoftId: varchar("microsoft_id", { length: 255 }).unique(),
  facebookId: varchar("facebook_id", { length: 255 }).unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  isAdmin: boolean("is_admin").notNull().default(false),
  clientNumber: varchar("client_number", { length: 9 }).unique(),
  preferredLanguage: varchar("preferred_language", { length: 2 }).notNull().default("fr"),
  termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }),
  // Mass revocation: all tokens issued BEFORE this timestamp are rejected.
  // Updated on password reset to invalidate all sessions.
  tokenRevokedBefore: timestamp("token_revoked_before", {
    withTimezone: true,
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ── Sessions ───────────────────────────────────────────────────────────

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(), // SHA-256 of the refresh token (never stored in plaintext)
    deviceInfo: text("device_info"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)],
);

// ── Items ──────────────────────────────────────────────────────────────

export const items = pgTable(
  "items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    category: varchar("category", { length: 100 }).notNull(),
    brand: varchar("brand", { length: 100 }),
    model: varchar("model", { length: 100 }),
    year: integer("year"),
    serialNumber: varchar("serial_number", { length: 255 }),
    trackerId: varchar("tracker_id", { length: 255 }),
    estimatedValue: integer("estimated_value"),
    purchaseDate: timestamp("purchase_date", { withTimezone: true }),
    // Insurance coverage (optional, informational)
    isInsured: boolean("is_insured").notNull().default(false),
    insurerId: varchar("insurer_id", { length: 50 }),
    insurerName: varchar("insurer_name", { length: 100 }),
    status: itemStatusEnum("status").notNull().default("active"),
    // Format: BADGE-XXXXXXXX — manually assigned by admin when processing orders
    // Null = not yet assigned (pending sticker purchase)
    badgeCode: varchar("badge_code", { length: 15 }).unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    archiveReason: varchar("archive_reason", { length: 50 }),
    archiveReasonCustom: text("archive_reason_custom"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("items_owner_id_idx").on(table.ownerId),
    index("items_badge_code_idx").on(table.badgeCode),
    index("items_status_idx").on(table.status),
  ],
);

// ── Item Photos ────────────────────────────────────────────────────────

export const itemPhotos = pgTable(
  "item_photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    caption: varchar("caption", { length: 255 }),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("item_photos_item_id_idx").on(table.itemId)],
);

// ── Item Documents ─────────────────────────────────────────────────────

export const itemDocuments = pgTable(
  "item_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    type: varchar("type", { length: 50 }).notNull(),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("item_documents_item_id_idx").on(table.itemId)],
);

// ── Theft Reports ──────────────────────────────────────────────────────

export const theftReports = pgTable(
  "theft_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    reporterId: uuid("reporter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    policeReportNumber: varchar("police_report_number", { length: 100 }),
    theftDate: timestamp("theft_date", { withTimezone: true }),
    theftLocation: varchar("theft_location", { length: 500 }),
    description: text("description"),
    status: reportStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("theft_reports_item_id_idx").on(table.itemId),
    index("theft_reports_reporter_id_idx").on(table.reporterId),
  ],
);

// ── Insurance Requests ─────────────────────────────────────────────────

export const insuranceRequests = pgTable("insurance_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  insurerName: varchar("insurer_name", { length: 100 }).notNull(),
  messageContent: text("message_content").notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(), // When the email was sent to the insurer
  createdAt: timestamp("created_at", { withTimezone: true }) // When the request was created (may differ if deferred send)
    .notNull()
    .defaultNow(),
});

// ── Partners ───────────────────────────────────────────────────────────

export const partnerTypeEnum = pgEnum("partner_type", [
  "insurer",
  "retailer",
  "security",
  "other",
]);

export const partners = pgTable("partners", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyName: varchar("company_name", { length: 255 }).notNull(),
  type: partnerTypeEnum("type").notNull(),
  contactEmail: varchar("contact_email", { length: 255 }),
  contactPhone: varchar("contact_phone", { length: 20 }),
  website: varchar("website", { length: 500 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ── Contact Messages ──────────────────────────────────────────────────

export const contactMessages = pgTable("contact_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  company: varchar("company", { length: 255 }),
  phone: varchar("phone", { length: 20 }),
  type: partnerTypeEnum("type").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ── Newsletter Subscribers ─────────────────────────────────────────────

export const newsletterSubscribers = pgTable("newsletter_subscribers", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ── Orders (Boutique Stripe) ──────────────────────────────────────────

export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "paid",
  "shipped",
  "cancelled",
]);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    stripeSessionId: varchar("stripe_session_id", { length: 255 }).unique(),
    stripePaymentIntentId: varchar("stripe_payment_intent_id", {
      length: 255,
    }),
    totalAmountCents: integer("total_amount_cents").notNull(),
    status: orderStatusEnum("status").notNull().default("pending"),
    shippingName: varchar("shipping_name", { length: 255 }),
    shippingAddress: text("shipping_address"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("orders_user_id_idx").on(table.userId),
    index("orders_stripe_session_id_idx").on(table.stripeSessionId),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    itemId: uuid("item_id").references(() => items.id, {
      onDelete: "set null",
    }),
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    badgeCode: varchar("badge_code", { length: 15 }),
    productType: varchar("product_type", { length: 50 }).notNull(),
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

export const stickerCodes = pgTable(
  "sticker_codes",
  {
    code: varchar("code", { length: 15 }).primaryKey(), // BADGE-XXXXXXXX
    orderItemId: uuid("order_item_id")
      .notNull()
      .references(() => orderItems.id, { onDelete: "restrict" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    assignedItemId: uuid("assigned_item_id").references(() => items.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
  },
  (table) => [
    index("sticker_codes_user_id_idx").on(table.userId),
    index("sticker_codes_order_item_id_idx").on(table.orderItemId),
    index("sticker_codes_assigned_item_id_idx").on(table.assignedItemId),
  ],
);

// ── Products ──────────────────────────────────────────────────────────

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: varchar("slug", { length: 100 }).notNull().unique(),
    nameFr: varchar("name_fr", { length: 255 }).notNull(),
    nameEn: varchar("name_en", { length: 255 }).notNull(),
    descriptionFr: text("description_fr"),
    descriptionEn: text("description_en"),
    featuresFr: text("features_fr").array(),
    featuresEn: text("features_en").array(),
    priceCents: integer("price_cents").notNull(),
    stripePriceId: varchar("stripe_price_id", { length: 255 }),
    imageUrls: text("image_urls")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    isActive: boolean("is_active").notNull().default(true),
    requiresItem: boolean("requires_item").notNull().default(false),
    customMechanic: varchar("custom_mechanic", { length: 50 }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("products_slug_idx").on(table.slug),
    index("products_sort_order_idx").on(table.sortOrder),
  ],
);
