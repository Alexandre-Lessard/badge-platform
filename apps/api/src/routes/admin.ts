import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, and, desc, asc, sql, count, sum, inArray, isNull, isNotNull, or, ilike } from "drizzle-orm";
import os from "node:os";
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
  INVALID_RNBP_FORMAT,
  CODES_ALREADY_EXIST,
  CODES_HAVE_CLAIMS,
  CODES_NOT_REGISTERED,
  PRODUCT_SLUGS,
  CODES_PER_SHEET,
} from "@rnbp/shared";
import { AppError } from "../utils/errors.js";
import { expandRange } from "../utils/rnbp-sequence.js";

export async function adminRoutes(app: FastifyInstance) {
  // ── List items (with search & status filter) ───────────────────

  app.get(
    "/admin/items",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const db = getDb();
      const { status, q, page = "1", limit = "25" } = request.query as {
        status?: string;
        q?: string;
        page?: string;
        limit?: string;
      };

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
      const offset = (pageNum - 1) * limitNum;

      const conditions: ReturnType<typeof eq>[] = [];

      if (status && status !== "all") {
        conditions.push(eq(items.status, status as "active" | "stolen" | "transferred"));
      }

      if (q && q.trim()) {
        const search = `%${q.trim()}%`;
        conditions.push(
          or(
            ilike(items.name, search),
            ilike(items.serialNumber, search),
            ilike(items.rnbpNumber, search),
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
          rnbpNumber: items.rnbpNumber,
          serialNumber: items.serialNumber,
          createdAt: items.createdAt,
          ownerName: sql<string>`concat(${users.firstName}, ' ', ${users.lastName})`,
          ownerEmail: users.email,
        })
        .from(items)
        .leftJoin(users, eq(items.ownerId, users.id))
        .where(where)
        .orderBy(desc(items.createdAt))
        .limit(limitNum)
        .offset(offset);

      const [{ total }] = await db
        .select({ total: count() })
        .from(items)
        .where(where);

      return reply.send({
        items: allItems,
        pagination: { page: pageNum, limit: limitNum, total },
      });
    },
  );

  // ── Recover item (admin) ─────────────────────────────────────────

  app.patch(
    "/admin/items/:id/recover",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { id } = request.params as { id: string };
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

      const [updated] = await db.transaction(async (tx) => {
        const [u] = await tx
          .update(items)
          .set({ status: "active", updatedAt: new Date() })
          .where(eq(items.id, id))
          .returning();

        await tx
          .update(theftReports)
          .set({ status: "resolved", updatedAt: new Date() })
          .where(and(eq(theftReports.itemId, id), eq(theftReports.status, "pending")));

        return [u];
      });

      return reply.send({ item: updated });
    },
  );

  // ── List orders ────────────────────────────────────────────────

  app.get(
    "/admin/orders",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const db = getDb();
      const { status } = request.query as { status?: string };

      const allOrders = await db
        .select()
        .from(orders)
        .where(
          status
            ? eq(orders.status, status as "pending" | "paid" | "shipped" | "cancelled")
            : undefined,
        )
        .orderBy(desc(orders.createdAt));

      // For each order, fetch order items with item info
      const result = await Promise.all(
        allOrders.map(async (order) => {
          const oi = await db
            .select({
              id: orderItems.id,
              itemId: orderItems.itemId,
              rnbpNumber: orderItems.rnbpNumber,
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

      return reply.send({ orders: result });
    },
  );

  // ── Order detail ──────────────────────────────────────────────

  app.get(
    "/admin/orders/:id",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const db = getDb();

      const [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, id))
        .limit(1);

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
          rnbpNumber: orderItems.rnbpNumber,
          productType: orderItems.productType,
          quantity: orderItems.quantity,
          unitPriceCents: orderItems.unitPriceCents,
          itemName: items.name,
          itemCategory: items.category,
          itemBrand: items.brand,
          itemModel: items.model,
          itemRnbpNumber: items.rnbpNumber,
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

      const codesByLine = new Map<
        string,
        { code: string; claimedAt: Date | null }[]
      >();
      for (const row of codeRows) {
        const arr = codesByLine.get(row.orderItemId) ?? [];
        arr.push({ code: row.code, claimedAt: row.claimedAt });
        codesByLine.set(row.orderItemId, arr);
      }

      const enriched = oi.map((line) => ({
        ...line,
        codes: (codesByLine.get(line.id) ?? []).sort((a, b) => a.code.localeCompare(b.code)),
      }));

      return reply.send({ order: { ...order, customer, items: enriched } });
    },
  );

  // ── Register sticker codes for an order line (shipment prep) ─────

  const codeRangeSchema = z.object({
    firstCode: z.string().min(1),
    lastCode: z.string().min(1),
  });
  const prepCodesSchema = z.object({
    ranges: z.array(codeRangeSchema).min(1).max(50),
  });

  app.post(
    "/admin/orders/:id/items/:orderItemId/codes",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { id, orderItemId } = request.params as {
        id: string;
        orderItemId: string;
      };
      const { ranges } = prepCodesSchema.parse(request.body);
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
          if (msg === "INVALID_RNBP_FORMAT") {
            throw new AppError(
              400,
              INVALID_RNBP_FORMAT,
              `Range ${i + 1} has invalid code format`,
            );
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

      return reply.status(201).send({ codes: allCodes });
    },
  );

  // ── Reset registered codes (admin correction before ship) ───────
  //
  // Hard-delete the registered codes for an order line. Used when the
  // admin realises they entered the wrong first/last codes during prep
  // (typo, off-by-one, scanned the wrong sheet). Refused if the customer
  // has already claimed at least one code — at that point the codes are
  // physically in the customer's hands and removing them would break the
  // public lookup. For the refund/cancel case the webhook still uses the
  // soft-delete `voided_at` mechanism (codes stay in DB but unusable).

  app.delete(
    "/admin/orders/:id/items/:orderItemId/codes",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { id, orderItemId } = request.params as {
        id: string;
        orderItemId: string;
      };
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
        .where(
          and(
            eq(stickerCodes.orderItemId, orderItemId),
            isNotNull(stickerCodes.claimedAt),
          ),
        )
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

      return reply.send({ deletedCount: deleted.length });
    },
  );

  // ── Mark as shipped ───────────────────────────────────────────

  app.patch(
    "/admin/orders/:id/ship",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const db = getDb();

      const [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, id))
        .limit(1);

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
        .where(
          and(eq(orderItems.orderId, id), eq(products.slug, PRODUCT_SLUGS.STICKER_SHEET)),
        );

      for (const line of stickerLines) {
        const [{ value: codeCount }] = await db
          .select({ value: count() })
          .from(stickerCodes)
          .where(
            and(
              eq(stickerCodes.orderItemId, line.orderItemId),
              isNull(stickerCodes.voidedAt),
            ),
          );
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

      return reply.send({ order: updated });
    },
  );

  // ── List all products ───────────────────────────────────────────

  app.get(
    "/admin/products",
    { preHandler: requireAdmin },
    async (_request, reply) => {
      const db = getDb();
      const allProducts = await db
        .select()
        .from(products)
        .orderBy(asc(products.sortOrder));

      return reply.send({ products: allProducts });
    },
  );

  // ── Product detail ──────────────────────────────────────────────

  app.get(
    "/admin/products/:id",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const db = getDb();

      const [product] = await db
        .select()
        .from(products)
        .where(eq(products.id, id))
        .limit(1);

      if (!product) {
        throw new AppError(404, PRODUCT_NOT_FOUND, "Product not found");
      }

      return reply.send({ product });
    },
  );

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

  app.post(
    "/admin/products",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const body = createProductSchema.parse(request.body);
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

      return reply.status(201).send({ product });
    },
  );

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

  app.patch(
    "/admin/products/:id",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = updateProductSchema.parse(request.body);
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

      return reply.send({ product: updated });
    },
  );

  // ── Aggregated stats ────────────────────────────────────────────

  app.get(
    "/admin/stats",
    { preHandler: requireAdmin },
    async (_request, reply) => {
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
        db
          .select({ verifiedUsers: count() })
          .from(users)
          .where(eq(users.emailVerified, true)),
        db.select({ totalItems: count() }).from(items),
        db
          .select({
            totalEstimatedValue: sum(items.estimatedValue),
          })
          .from(items),
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
          .where(
            inArray(theftReports.status, ["pending", "confirmed"]),
          ),
        db.select({ newsletterCount: count() }).from(newsletterSubscribers),
        db
          .select({
            category: items.category,
            count: count(),
          })
          .from(items)
          .groupBy(items.category),
        db
          .select({
            status: items.status,
            count: count(),
          })
          .from(items)
          .groupBy(items.status),
      ]);

      return reply.send({
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
    },
  );

  // ── Chart time series ───────────────────────────────────────────

  const periodSchema = z.enum(["day", "week", "month"]).default("day");

  app.get(
    "/admin/stats/charts",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { period } = request.query as { period?: string };
      const validPeriod = periodSchema.parse(period);

      const db = getDb();

      // Determine how far back to look
      const daysBack = validPeriod === "day" ? 30 : validPeriod === "week" ? 90 : 365;
      const since = new Date();
      since.setDate(since.getDate() - daysBack);

      const sinceStr = since.toISOString();

      const [registrations, itemSeries, revenue] = await Promise.all([
        db.execute(sql.raw(`
          SELECT date_trunc('${validPeriod}', created_at) AS date, COUNT(*)::int AS count
          FROM users
          WHERE created_at >= '${sinceStr}'
          GROUP BY 1 ORDER BY 1
        `)),
        db.execute(sql.raw(`
          SELECT date_trunc('${validPeriod}', created_at) AS date, COUNT(*)::int AS count
          FROM items
          WHERE created_at >= '${sinceStr}'
          GROUP BY 1 ORDER BY 1
        `)),
        db.execute(sql.raw(`
          SELECT date_trunc('${validPeriod}', created_at) AS date,
                 COALESCE(SUM(total_amount_cents), 0)::int AS amount
          FROM orders
          WHERE created_at >= '${sinceStr}'
            AND status IN ('paid', 'shipped')
          GROUP BY 1 ORDER BY 1
        `)),
      ]);

      return reply.send({
        registrations,
        items: itemSeries,
        revenue,
      });
    },
  );

  // ── Live metrics (SSE) ──────────────────────────────────────────

  // Shared metrics cache — one collection interval for all connections
  let metricsCache: Record<string, unknown> = {};
  let metricsInterval: ReturnType<typeof setInterval> | null = null;
  let sseConnectionCount = 0;

  async function collectMetrics() {
    const db = getDb();

    let dbSize = 0;
    let dbConnections = 0;
    try {
      const [sizeResult, connResult] = await Promise.all([
        db.execute(sql`SELECT pg_database_size(current_database()) AS size`),
        db.execute(sql`SELECT COUNT(*)::int AS count FROM pg_stat_activity`),
      ]);
      dbSize = Number((sizeResult as any)[0]?.size) || 0;
      dbConnections = Number((connResult as any)[0]?.count) || 0;
    } catch {
      // DB queries may fail transiently; keep previous values
    }

    const mem = process.memoryUsage();

    metricsCache = {
      cpu: os.loadavg()[0],
      cpuCount: os.cpus().length,
      memTotal: os.totalmem(),
      memFree: os.freemem(),
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      rss: mem.rss,
      external: mem.external,
      uptime: process.uptime(),
      osUptime: os.uptime(),
      dbSize,
      dbConnections,
      reqPerMin: getRequestsPerMinute(),
    };
  }

  function startMetricsCollection() {
    if (metricsInterval) return;
    // Collect immediately, then every 2s
    collectMetrics();
    metricsInterval = setInterval(collectMetrics, 1000);
  }

  function stopMetricsCollection() {
    if (metricsInterval && sseConnectionCount <= 0) {
      clearInterval(metricsInterval);
      metricsInterval = null;
    }
  }

  app.get("/admin/metrics/live", async (request, reply) => {
    // Auth via query param
    const { token } = request.query as { token?: string };
    if (!token) {
      return reply.status(401).send({ error: "Missing token" });
    }

    let payload;
    try {
      payload = await verifyToken(token);
    } catch {
      return reply.status(401).send({ error: "Invalid or expired token" });
    }

    if (payload.type !== "access") {
      return reply.status(401).send({ error: "Invalid token type" });
    }

    // Verify the user is admin
    const db = getDb();
    const [user] = await db
      .select({ id: users.id, isAdmin: users.isAdmin })
      .from(users)
      .where(eq(users.id, payload.sub))
      .limit(1);

    if (!user || !user.isAdmin) {
      return reply.status(403).send({ error: "Admin access required" });
    }

    // SSE headers (manually include CORS since reply.raw bypasses Fastify CORS plugin)
    const origin = request.headers.origin || "*";
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
    });

    sseConnectionCount++;
    startMetricsCollection();

    // Send initial data immediately
    reply.raw.write(`data: ${JSON.stringify(metricsCache)}\n\n`);

    // Write cached metrics every 2 seconds to this connection
    const writeInterval = setInterval(() => {
      try {
        reply.raw.write(`data: ${JSON.stringify(metricsCache)}\n\n`);
      } catch {
        clearInterval(writeInterval);
      }
    }, 1000);

    // Clean up on disconnect
    request.raw.on("close", () => {
      clearInterval(writeInterval);
      sseConnectionCount--;
      stopMetricsCollection();
    });
  });

  // ── Activity feed ───────────────────────────────────────────────

  app.get(
    "/admin/activity",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { limit: limitParam } = request.query as { limit?: string };
      const feedLimit = Math.min(Math.max(Number(limitParam) || 20, 1), 100);

      const db = getDb();

      const [recentUsers, recentItems, recentOrders, recentThefts] =
        await Promise.all([
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
            .select({
              id: items.id,
              name: items.name,
              createdAt: items.createdAt,
            })
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
            .select({
              id: theftReports.id,
              itemId: theftReports.itemId,
              createdAt: theftReports.createdAt,
            })
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

      return reply.send({ activity });
    },
  );
}
