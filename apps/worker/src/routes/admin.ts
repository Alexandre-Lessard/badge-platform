import { Hono } from "hono";
import { z } from "zod";
import { eq, and, desc, asc, sql, count, sum, inArray, isNull, isNotNull, or, like } from "drizzle-orm";
import { getDb } from "../db/client.js";
import {
  orders,
  orderItems,
  items,
  users,
  products,
  theftReports,
  newsletterSubscribers,
  stickerCodes,
} from "../db/schema.js";
import { requireAdmin } from "../middleware/auth.js";
import { verifyToken } from "../utils/tokens.js";
import { getRequestsPerMinute } from "../utils/request-counter.js";
import {
  ORDER_NOT_FOUND,
  ORDER_LINE_NOT_FOUND,
  ORDER_NOT_PAID,
  PRODUCT_NOT_FOUND,
  INVALID_RANGE,
  INVALID_BADGE_FORMAT,
  CODES_ALREADY_EXIST,
  CODES_HAVE_CLAIMS,
  CODES_NOT_REGISTERED,
  PRODUCT_SLUGS,
  CODES_PER_SHEET,
} from "@rnbp/shared";
import { AppError } from "../utils/errors.js";
import { expandRange } from "../utils/badge-sequence.js";
import type { AppEnv } from "../context.js";

export const adminRoutes = new Hono<AppEnv>();

// ── List items (with search & status filter) ───────────────────

adminRoutes.get("/admin/items", requireAdmin, async (c) => {
  const db = getDb();
  const status = c.req.query("status");
  const q = c.req.query("q");
  const page = c.req.query("page") ?? "1";
  const limit = c.req.query("limit") ?? "25";

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
  const offset = (pageNum - 1) * limitNum;

  const conditions: ReturnType<typeof eq>[] = [];

  if (status && status !== "all") {
    conditions.push(eq(items.status, status as "active" | "stolen" | "transferred"));
  }

  if (q && q.trim()) {
    // SQLite's LIKE is already case-insensitive for ASCII, so it stands in
    // for Postgres ILIKE here.
    const search = `%${q.trim()}%`;
    conditions.push(
      or(
        like(items.name, search),
        like(items.serialNumber, search),
        like(items.badgeCode, search),
      )!,
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const allItems = await db
    .select({
      id: items.id,
      name: items.name,
      category: items.category,
      status: items.status,
      badgeCode: items.badgeCode,
      serialNumber: items.serialNumber,
      createdAt: items.createdAt,
      ownerName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
      ownerEmail: users.email,
    })
    .from(items)
    .leftJoin(users, eq(items.ownerId, users.id))
    .where(where)
    .orderBy(desc(items.createdAt))
    .limit(limitNum)
    .offset(offset);

  const [{ total }] = await db.select({ total: count() }).from(items).where(where);

  return c.json({
    items: allItems,
    pagination: { page: pageNum, limit: limitNum, total },
  });
});

// ── Recover item (admin) ─────────────────────────────────────────

adminRoutes.patch("/admin/items/:id/recover", requireAdmin, async (c) => {
  const id = c.req.param("id");
  const db = getDb();

  const [item] = await db
    .select({ status: items.status })
    .from(items)
    .where(eq(items.id, id))
    .limit(1);

  if (!item) throw new AppError(404, "ITEM_NOT_FOUND", "Item not found");
  if (item.status !== "stolen") {
    throw new AppError(400, "ITEM_NOT_STOLEN", "Item is not marked as stolen");
  }

  const now = new Date();
  const [updatedRows] = await db.batch([
    db.update(items).set({ status: "active", updatedAt: now }).where(eq(items.id, id)).returning(),
    db
      .update(theftReports)
      .set({ status: "resolved", updatedAt: now })
      .where(and(eq(theftReports.itemId, id), eq(theftReports.status, "pending"))),
  ]);

  return c.json({ item: updatedRows[0] });
});

// ── List orders ────────────────────────────────────────────────

adminRoutes.get("/admin/orders", requireAdmin, async (c) => {
  const db = getDb();
  const status = c.req.query("status");

  const allOrders = await db
    .select()
    .from(orders)
    .where(
      status ? eq(orders.status, status as "pending" | "paid" | "shipped" | "cancelled") : undefined,
    )
    .orderBy(desc(orders.createdAt));

  // For each order, fetch order items with item info
  const result = await Promise.all(
    allOrders.map(async (order) => {
      const oi = await db
        .select({
          id: orderItems.id,
          itemId: orderItems.itemId,
          badgeCode: orderItems.badgeCode,
          productType: orderItems.productType,
          quantity: orderItems.quantity,
          itemName: items.name,
          itemCategory: items.category,
          itemBrand: items.brand,
          itemModel: items.model,
        })
        .from(orderItems)
        .leftJoin(items, eq(orderItems.itemId, items.id))
        .where(eq(orderItems.orderId, order.id));

      return { ...order, items: oi };
    }),
  );

  return c.json({ orders: result });
});

// ── List clients (registered users) ────────────────────────────

adminRoutes.get("/admin/clients", requireAdmin, async (c) => {
  const db = getDb();
  const page = c.req.query("page") ?? "1";
  const limit = c.req.query("limit") ?? "50";
  const q = c.req.query("q");

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const offset = (pageNum - 1) * limitNum;

  const search = q && q.trim() ? `%${q.trim()}%` : null;
  const where = search
    ? or(
        like(users.email, search),
        like(users.firstName, search),
        like(users.lastName, search),
        like(users.clientNumber, search),
      )
    : undefined;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        clientNumber: users.clientNumber,
        emailVerified: users.emailVerified,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(limitNum)
      .offset(offset),
    db.select({ total: count() }).from(users).where(where),
  ]);

  return c.json({ clients: rows, total, page: pageNum, limit: limitNum });
});

// ── Order detail ──────────────────────────────────────────────

adminRoutes.get("/admin/orders/:id", requireAdmin, async (c) => {
  const id = c.req.param("id");
  const db = getDb();

  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);

  if (!order) throw new AppError(404, ORDER_NOT_FOUND, "Order not found");

  // Fetch the user if present
  let customer = null;
  if (order.userId) {
    const [u] = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        clientNumber: users.clientNumber,
      })
      .from(users)
      .where(eq(users.id, order.userId))
      .limit(1);
    customer = u || null;
  }

  const oi = await db
    .select({
      id: orderItems.id,
      itemId: orderItems.itemId,
      badgeCode: orderItems.badgeCode,
      productType: orderItems.productType,
      quantity: orderItems.quantity,
      unitPriceCents: orderItems.unitPriceCents,
      itemName: items.name,
      itemCategory: items.category,
      itemBrand: items.brand,
      itemModel: items.model,
      itemBadgeCode: items.badgeCode,
      productSlug: products.slug,
      productNameFr: products.nameFr,
      productNameEn: products.nameEn,
      customMechanic: products.customMechanic,
    })
    .from(orderItems)
    .leftJoin(items, eq(orderItems.itemId, items.id))
    .leftJoin(products, eq(orderItems.productId, products.id))
    .where(eq(orderItems.orderId, id));

  // Fetch sticker codes per order line in a single query.
  const oiIds = oi.map((o) => o.id);
  const codeRows = oiIds.length
    ? await db
        .select({
          code: stickerCodes.code,
          orderItemId: stickerCodes.orderItemId,
          claimedAt: stickerCodes.claimedAt,
        })
        .from(stickerCodes)
        .where(inArray(stickerCodes.orderItemId, oiIds))
    : [];

  const codesByLine = new Map<string, { code: string; claimedAt: Date | null }[]>();
  for (const row of codeRows) {
    const arr = codesByLine.get(row.orderItemId) ?? [];
    arr.push({ code: row.code, claimedAt: row.claimedAt });
    codesByLine.set(row.orderItemId, arr);
  }

  const enriched = oi.map((line) => ({
    ...line,
    codes: (codesByLine.get(line.id) ?? []).sort((a, b) => a.code.localeCompare(b.code)),
  }));

  return c.json({ order: { ...order, customer, items: enriched } });
});

// ── Register sticker codes for an order line (shipment prep) ─────

const codeRangeSchema = z.object({
  firstCode: z.string().min(1),
  lastCode: z.string().min(1),
});
const prepCodesSchema = z.object({
  ranges: z.array(codeRangeSchema).min(1).max(50),
});

adminRoutes.post("/admin/orders/:id/items/:orderItemId/codes", requireAdmin, async (c) => {
  const id = c.req.param("id");
  const orderItemId = c.req.param("orderItemId");
  const { ranges } = prepCodesSchema.parse(await c.req.json());
  const db = getDb();

  const [oi] = await db
    .select({
      orderItemId: orderItems.id,
      quantity: orderItems.quantity,
      orderUserId: orders.userId,
      productSlug: products.slug,
    })
    .from(orderItems)
    .leftJoin(orders, eq(orderItems.orderId, orders.id))
    .leftJoin(products, eq(orderItems.productId, products.id))
    .where(and(eq(orderItems.id, orderItemId), eq(orderItems.orderId, id)))
    .limit(1);

  if (!oi) throw new AppError(404, ORDER_LINE_NOT_FOUND, "Order line not found");
  if (oi.productSlug !== PRODUCT_SLUGS.STICKER_SHEET) {
    throw new AppError(
      400,
      INVALID_RANGE,
      "Codes can only be registered for sticker-sheet products",
    );
  }
  if (!oi.orderUserId) {
    throw new AppError(400, ORDER_NOT_FOUND, "Order has no associated user");
  }

  const allCodes: string[] = [];
  for (let i = 0; i < ranges.length; i++) {
    const range = ranges[i];
    let codes: string[];
    try {
      codes = expandRange(range.firstCode, range.lastCode);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "INVALID_RANGE";
      if (msg === "INVALID_BADGE_FORMAT") {
        throw new AppError(400, INVALID_BADGE_FORMAT, `Range ${i + 1} has invalid code format`);
      }
      throw new AppError(
        400,
        INVALID_RANGE,
        `Range ${i + 1} is invalid (must contain exactly ${CODES_PER_SHEET} codes)`,
      );
    }
    if (codes.length !== CODES_PER_SHEET) {
      throw new AppError(
        400,
        INVALID_RANGE,
        `Range ${i + 1} must contain exactly ${CODES_PER_SHEET} codes (got ${codes.length})`,
      );
    }
    allCodes.push(...codes);
  }

  const expectedTotal = oi.quantity * CODES_PER_SHEET;
  if (allCodes.length !== expectedTotal) {
    throw new AppError(
      400,
      INVALID_RANGE,
      `Expected ${expectedTotal} codes total (${oi.quantity} sheets × ${CODES_PER_SHEET}), got ${allCodes.length}`,
    );
  }

  const existing = await db
    .select({ code: stickerCodes.code })
    .from(stickerCodes)
    .where(inArray(stickerCodes.code, allCodes));

  if (existing.length > 0) {
    throw new AppError(
      409,
      CODES_ALREADY_EXIST,
      `Some codes already exist: ${existing.map((e) => e.code).join(", ")}`,
    );
  }

  await db.insert(stickerCodes).values(
    allCodes.map((code) => ({
      code,
      orderItemId: oi.orderItemId,
      userId: oi.orderUserId!,
    })),
  );

  return c.json({ codes: allCodes }, 201);
});

// ── Reset registered codes (admin correction before ship) ───────
//
// Hard-delete the registered codes for an order line. Used when the
// admin realises they entered the wrong first/last codes during prep
// (typo, off-by-one, scanned the wrong sheet). Refused if the customer
// has already claimed at least one code — at that point the codes are
// physically in the customer's hands and removing them would break the
// public lookup. For the refund/cancel case the webhook still uses the
// soft-delete `voided_at` mechanism (codes stay in DB but unusable).

adminRoutes.delete("/admin/orders/:id/items/:orderItemId/codes", requireAdmin, async (c) => {
  const id = c.req.param("id");
  const orderItemId = c.req.param("orderItemId");
  const db = getDb();

  const [oi] = await db
    .select({ id: orderItems.id })
    .from(orderItems)
    .where(and(eq(orderItems.id, orderItemId), eq(orderItems.orderId, id)))
    .limit(1);

  if (!oi) throw new AppError(404, ORDER_LINE_NOT_FOUND, "Order line not found");

  const [claimed] = await db
    .select({ code: stickerCodes.code })
    .from(stickerCodes)
    .where(and(eq(stickerCodes.orderItemId, orderItemId), isNotNull(stickerCodes.claimedAt)))
    .limit(1);

  if (claimed) {
    throw new AppError(
      409,
      CODES_HAVE_CLAIMS,
      "Cannot reset codes after the customer has claimed at least one",
    );
  }

  const deleted = await db
    .delete(stickerCodes)
    .where(eq(stickerCodes.orderItemId, orderItemId))
    .returning({ code: stickerCodes.code });

  return c.json({ deletedCount: deleted.length });
});

// ── Mark as shipped ───────────────────────────────────────────

adminRoutes.patch("/admin/orders/:id/ship", requireAdmin, async (c) => {
  const id = c.req.param("id");
  const db = getDb();

  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);

  if (!order) throw new AppError(404, ORDER_NOT_FOUND, "Order not found");
  if (order.status !== "paid") {
    throw new AppError(400, ORDER_NOT_PAID, "Only paid orders can be shipped");
  }

  // Sticker-sheet products require their codes to be registered (POST /codes)
  // before shipping, so the admin has physically grouped the printed codes with
  // the parcel. Other products (e.g. door stickers) ship without precondition.
  const stickerLines = await db
    .select({
      orderItemId: orderItems.id,
      quantity: orderItems.quantity,
    })
    .from(orderItems)
    .leftJoin(products, eq(orderItems.productId, products.id))
    .where(and(eq(orderItems.orderId, id), eq(products.slug, PRODUCT_SLUGS.STICKER_SHEET)));

  for (const line of stickerLines) {
    const [{ value: codeCount }] = await db
      .select({ value: count() })
      .from(stickerCodes)
      .where(and(eq(stickerCodes.orderItemId, line.orderItemId), isNull(stickerCodes.voidedAt)));
    const expected = line.quantity * CODES_PER_SHEET;
    if (Number(codeCount) !== expected) {
      throw new AppError(
        400,
        CODES_NOT_REGISTERED,
        `Order line needs ${expected} codes registered (has ${codeCount}). Prepare the shipment first.`,
      );
    }
  }

  const [updated] = await db
    .update(orders)
    .set({ status: "shipped", updatedAt: new Date() })
    .where(eq(orders.id, id))
    .returning();

  return c.json({ order: updated });
});

// ── List all products ───────────────────────────────────────────

adminRoutes.get("/admin/products", requireAdmin, async (c) => {
  const db = getDb();
  const allProducts = await db.select().from(products).orderBy(asc(products.sortOrder));

  return c.json({ products: allProducts });
});

// ── Product detail ──────────────────────────────────────────────

adminRoutes.get("/admin/products/:id", requireAdmin, async (c) => {
  const id = c.req.param("id");
  const db = getDb();

  const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1);

  if (!product) {
    throw new AppError(404, PRODUCT_NOT_FOUND, "Product not found");
  }

  return c.json({ product });
});

// ── Create product ──────────────────────────────────────────────

const createProductSchema = z.object({
  slug: z.string().min(1).max(100),
  nameFr: z.string().min(1).max(255),
  nameEn: z.string().min(1).max(255),
  descriptionFr: z.string().optional(),
  descriptionEn: z.string().optional(),
  featuresFr: z.array(z.string()).optional(),
  featuresEn: z.array(z.string()).optional(),
  priceCents: z.number().int().min(0),
  stripePriceId: z.string().optional(),
  imageUrls: z.array(z.string().max(500)).max(10).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

adminRoutes.post("/admin/products", requireAdmin, async (c) => {
  const body = createProductSchema.parse(await c.req.json());
  const db = getDb();

  const [product] = await db
    .insert(products)
    .values({
      ...body,
      // Force these values — not user-configurable on creation
      customMechanic: null,
      requiresItem: false,
    })
    .returning();

  return c.json({ product }, 201);
});

// ── Update product ──────────────────────────────────────────────

const updateProductSchema = z.object({
  slug: z.string().min(1).max(100).optional(),
  nameFr: z.string().min(1).max(255).optional(),
  nameEn: z.string().min(1).max(255).optional(),
  descriptionFr: z.string().nullable().optional(),
  descriptionEn: z.string().nullable().optional(),
  featuresFr: z.array(z.string()).nullable().optional(),
  featuresEn: z.array(z.string()).nullable().optional(),
  priceCents: z.number().int().min(0).optional(),
  stripePriceId: z.string().nullable().optional(),
  imageUrls: z.array(z.string().max(500)).max(10).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

adminRoutes.patch("/admin/products/:id", requireAdmin, async (c) => {
  const id = c.req.param("id");
  const body = updateProductSchema.parse(await c.req.json());
  const db = getDb();

  // Verify product exists
  const [existing] = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.id, id))
    .limit(1);

  if (!existing) {
    throw new AppError(404, PRODUCT_NOT_FOUND, "Product not found");
  }

  // customMechanic and requiresItem are not modifiable
  const [updated] = await db
    .update(products)
    .set({
      ...body,
      updatedAt: new Date(),
    })
    .where(eq(products.id, id))
    .returning();

  return c.json({ product: updated });
});

// ── Aggregated stats ────────────────────────────────────────────

adminRoutes.get("/admin/stats", requireAdmin, async (c) => {
  const db = getDb();

  const paidShipped = ["paid", "shipped"] as const;

  const [
    [{ totalUsers }],
    [{ verifiedUsers }],
    [{ totalItems }],
    [{ totalEstimatedValue }],
    [{ totalOrders }],
    [{ totalRevenue }],
    [{ activeTheftReports }],
    [{ newsletterCount }],
    itemsByCategory,
    itemsByStatus,
  ] = await Promise.all([
    db.select({ totalUsers: count() }).from(users),
    db.select({ verifiedUsers: count() }).from(users).where(eq(users.emailVerified, true)),
    db.select({ totalItems: count() }).from(items),
    db.select({ totalEstimatedValue: sum(items.estimatedValue) }).from(items),
    db
      .select({ totalOrders: count() })
      .from(orders)
      .where(inArray(orders.status, [...paidShipped])),
    db
      .select({ totalRevenue: sum(orders.totalAmountCents) })
      .from(orders)
      .where(inArray(orders.status, [...paidShipped])),
    db
      .select({ activeTheftReports: count() })
      .from(theftReports)
      .where(inArray(theftReports.status, ["pending", "confirmed"])),
    db.select({ newsletterCount: count() }).from(newsletterSubscribers),
    db.select({ category: items.category, count: count() }).from(items).groupBy(items.category),
    db.select({ status: items.status, count: count() }).from(items).groupBy(items.status),
  ]);

  return c.json({
    totalUsers,
    verifiedUsers,
    totalItems,
    totalEstimatedValue: Number(totalEstimatedValue) || 0,
    totalOrders,
    totalRevenue: Number(totalRevenue) || 0,
    activeTheftReports,
    newsletterSubscribers: newsletterCount,
    itemsByCategory,
    itemsByStatus,
  });
});

// ── Chart time series ───────────────────────────────────────────

const periodSchema = z.enum(["day", "week", "month"]).default("day");

// SQLite equivalents of Postgres date_trunc. Timestamps are stored as
// epoch milliseconds, so they are divided before 'unixepoch' conversion.
// Every bucket resolves to a date string new Date() can parse.
const BUCKET_EXPR = {
  day: "date(created_at / 1000, 'unixepoch')",
  week: "date(created_at / 1000, 'unixepoch', 'weekday 0', '-6 days')",
  month: "strftime('%Y-%m-01', created_at / 1000, 'unixepoch')",
} as const;

adminRoutes.get("/admin/stats/charts", requireAdmin, async (c) => {
  const validPeriod = periodSchema.parse(c.req.query("period"));

  const db = getDb();

  // Determine how far back to look
  const daysBack = validPeriod === "day" ? 30 : validPeriod === "week" ? 90 : 365;
  const since = new Date();
  since.setDate(since.getDate() - daysBack);

  const sinceMs = since.getTime();
  const bucket = BUCKET_EXPR[validPeriod];

  const [registrations, itemSeries, revenue] = await Promise.all([
    db.all(
      sql.raw(
        `SELECT ${bucket} AS date, COUNT(*) AS count
         FROM users
         WHERE created_at >= ${sinceMs}
         GROUP BY 1 ORDER BY 1`,
      ),
    ),
    db.all(
      sql.raw(
        `SELECT ${bucket} AS date, COUNT(*) AS count
         FROM items
         WHERE created_at >= ${sinceMs}
         GROUP BY 1 ORDER BY 1`,
      ),
    ),
    db.all(
      sql.raw(
        `SELECT ${bucket} AS date, COALESCE(SUM(total_amount_cents), 0) AS amount
         FROM orders
         WHERE created_at >= ${sinceMs}
           AND status IN ('paid', 'shipped')
         GROUP BY 1 ORDER BY 1`,
      ),
    ),
  ]);

  return c.json({
    registrations,
    items: itemSeries,
    revenue,
  });
});

// ── Live metrics (SSE) ──────────────────────────────────────────
//
// Serverless has no host to measure: the OS/process gauges the Fastify
// version reported (loadavg, freemem, heap, uptime) do not exist here.
// What remains meaningful is the data in D1 plus the request counter of
// the isolate serving this stream, so that is what is emitted. The stream
// closes after MAX_STREAM_MS and EventSource reconnects on its own.

const METRICS_INTERVAL_MS = 2000;
const MAX_STREAM_MS = 2 * 60 * 1000;

async function collectMetrics(): Promise<Record<string, unknown>> {
  const db = getDb();

  let dbRows = 0;
  try {
    const [{ total }] = await db
      .select({ total: count() })
      .from(items);
    dbRows = Number(total) || 0;
  } catch {
    // Transient D1 errors keep the previous value
  }

  return {
    platform: "workers",
    dbRows,
    reqPerMin: getRequestsPerMinute(),
    timestamp: Date.now(),
  };
}

adminRoutes.get("/admin/metrics/live", async (c) => {
  // Auth via query param (EventSource cannot set headers)
  const token = c.req.query("token");
  if (!token) {
    return c.json({ error: "Missing token" }, 401);
  }

  let payload;
  try {
    payload = await verifyToken(token);
  } catch {
    return c.json({ error: "Invalid or expired token" }, 401);
  }

  if (payload.type !== "access") {
    return c.json({ error: "Invalid token type" }, 401);
  }

  // Verify the user is admin
  const db = getDb();
  const [user] = await db
    .select({ id: users.id, isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, payload.sub))
    .limit(1);

  if (!user || !user.isAdmin) {
    return c.json({ error: "Admin access required" }, 403);
  }

  const encoder = new TextEncoder();
  const startedAt = Date.now();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        while (Date.now() - startedAt < MAX_STREAM_MS) {
          const metrics = await collectMetrics();
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(metrics)}\n\n`));
          await new Promise((resolve) => setTimeout(resolve, METRICS_INTERVAL_MS));
        }
      } catch {
        // Client disconnected — closing below is enough
      } finally {
        controller.close();
      }
    },
  });

  const origin = c.req.header("origin") || "*";
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
    },
  });
});

// ── Activity feed ───────────────────────────────────────────────

adminRoutes.get("/admin/activity", requireAdmin, async (c) => {
  const limitParam = c.req.query("limit");
  const feedLimit = Math.min(Math.max(Number(limitParam) || 20, 1), 100);

  const db = getDb();

  const [recentUsers, recentItems, recentOrders, recentThefts] = await Promise.all([
    db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(feedLimit),
    db
      .select({ id: items.id, name: items.name, createdAt: items.createdAt })
      .from(items)
      .orderBy(desc(items.createdAt))
      .limit(feedLimit),
    db
      .select({
        id: orders.id,
        email: orders.email,
        totalAmountCents: orders.totalAmountCents,
        updatedAt: orders.updatedAt,
      })
      .from(orders)
      .where(inArray(orders.status, ["paid", "shipped"]))
      .orderBy(desc(orders.updatedAt))
      .limit(feedLimit),
    db
      .select({ id: theftReports.id, itemId: theftReports.itemId, createdAt: theftReports.createdAt })
      .from(theftReports)
      .orderBy(desc(theftReports.createdAt))
      .limit(feedLimit),
  ]);

  // Merge into a single sorted array
  const activity = [
    ...recentUsers.map((u) => ({
      type: "user" as const,
      date: u.createdAt.toISOString(),
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
    })),
    ...recentItems.map((i) => ({
      type: "item" as const,
      date: i.createdAt.toISOString(),
      id: i.id,
      name: i.name,
    })),
    ...recentOrders.map((o) => ({
      type: "order" as const,
      date: o.updatedAt.toISOString(),
      id: o.id,
      email: o.email,
      totalAmountCents: o.totalAmountCents,
    })),
    ...recentThefts.map((t) => ({
      type: "theft" as const,
      date: t.createdAt.toISOString(),
      id: t.id,
      itemId: t.itemId,
    })),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, feedLimit);

  return c.json({ activity });
});
