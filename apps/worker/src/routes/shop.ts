import { Hono } from "hono";
import { z } from "zod";
import { eq, and, asc, isNull, inArray } from "drizzle-orm";
import Stripe from "stripe";
import { getDb } from "../db/client.js";
import { orders, orderItems, items, users, products, stickerCodes } from "../db/schema.js";
import { getConfig } from "../config.js";
import { requireVerifiedEmail } from "../middleware/auth.js";
import {
  sendEmail,
  buildOrderNotificationEmail,
  buildOrderConfirmationEmail,
} from "../utils/email.js";
import { ITEMS_NOT_OWNED, PRODUCT_NOT_FOUND, PRODUCT_INACTIVE } from "@badge/shared";
import { AppError } from "../utils/errors.js";
import type { AppEnv } from "../context.js";

const checkoutSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().min(1).max(50),
        itemId: z.string().uuid().optional(),
      }),
    )
    .min(1)
    .max(20),
  email: z.string().email().optional(),
});

function getStripe(): Stripe {
  const config = getConfig();
  if (!config.STRIPE_SECRET_KEY) {
    throw new Error("Stripe is not configured");
  }
  // The Workers runtime has no Node http stack — Stripe must use fetch.
  return new Stripe(config.STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient(),
  });
}

export const shopRoutes = new Hono<AppEnv>();

// ── List active products ──────────────────────────────────────

shopRoutes.get("/shop/products", async (c) => {
  const db = getDb();
  const activeProducts = await db
    .select()
    .from(products)
    .where(eq(products.isActive, true))
    .orderBy(asc(products.sortOrder));

  return c.json({ products: activeProducts });
});

// ── Shop availability ──────────────────────────────────────────

shopRoutes.get("/shop/status", (c) => c.json({ available: !!getConfig().STRIPE_SECRET_KEY }));

// ── Create checkout session ──────────────────────────────────────

shopRoutes.post("/shop/checkout", requireVerifiedEmail, async (c) => {
  const config = getConfig();
  if (!config.STRIPE_SECRET_KEY) {
    return c.json({ error: "shop_unavailable" }, 503);
  }

  const body = checkoutSchema.parse(await c.req.json());
  const stripe = getStripe();
  const db = getDb();

  // Fetch all requested products from DB
  const productIds = [...new Set(body.items.map((i) => i.productId))];
  const dbProducts = await db.select().from(products).where(inArray(products.id, productIds));

  const productMap = new Map(dbProducts.map((p) => [p.id, p]));

  // Validate all products exist and are active
  for (const item of body.items) {
    const product = productMap.get(item.productId);
    if (!product) {
      throw new AppError(400, PRODUCT_NOT_FOUND, `Product ${item.productId} not found`);
    }
    if (!product.isActive) {
      throw new AppError(400, PRODUCT_INACTIVE, `Product ${product.slug} is not available`);
    }
    if (!product.stripePriceId) {
      throw new AppError(
        400,
        PRODUCT_INACTIVE,
        `Product ${product.slug} has no Stripe price configured`,
      );
    }
  }

  // Validate item ownership for products that require an item
  const itemsRequiringItem = body.items.filter((i) => productMap.get(i.productId)!.requiresItem);

  if (itemsRequiringItem.length > 0) {
    // All requiresItem products must have an itemId
    for (const item of itemsRequiringItem) {
      if (!item.itemId) {
        const product = productMap.get(item.productId)!;
        throw new AppError(
          400,
          ITEMS_NOT_OWNED,
          `Product ${product.slug} requires an item to be specified`,
        );
      }
    }

    const itemIds = itemsRequiringItem.map((i) => i.itemId!);
    const ownedItems = await db
      .select({ id: items.id })
      .from(items)
      .where(and(inArray(items.id, itemIds), eq(items.ownerId, c.var.userId!)));

    const ownedIds = new Set(ownedItems.map((i) => i.id));
    for (const itemId of itemIds) {
      if (!ownedIds.has(itemId)) {
        throw new AppError(403, ITEMS_NOT_OWNED, "One or more items do not belong to you");
      }
    }
  }

  // Email: body > JWT user > null
  let email = body.email;
  if (!email && c.var.userId) {
    const [user] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, c.var.userId))
      .limit(1);
    email = user?.email;
  }

  // Create order in DB first
  const [order] = await db
    .insert(orders)
    .values({
      email: email || "pending@checkout.stripe.com",
      userId: c.var.userId || null,
      totalAmountCents: 0, // Updated by webhook
      status: "pending",
    })
    .returning();

  // Insert order_items
  await db.insert(orderItems).values(
    body.items.map((item) => {
      const product = productMap.get(item.productId)!;
      return {
        orderId: order.id,
        itemId: item.itemId || null,
        productId: item.productId,
        productType: product.slug,
        quantity: item.quantity,
        unitPriceCents: product.priceCents,
      };
    }),
  );

  // Group by stripePriceId for Stripe line_items
  const priceQuantities = new Map<string, number>();
  for (const item of body.items) {
    const product = productMap.get(item.productId)!;
    const priceId = product.stripePriceId!;
    priceQuantities.set(priceId, (priceQuantities.get(priceId) || 0) + item.quantity);
  }

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
  for (const [priceId, quantity] of priceQuantities) {
    lineItems.push({ price: priceId, quantity });
  }

  // Create Stripe Checkout session
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: lineItems,
    automatic_tax: { enabled: true },
    shipping_address_collection: {
      allowed_countries: ["CA"],
    },
    ...(email ? { customer_email: email } : {}),
    success_url: `${config.FRONTEND_URL}/shop/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${config.FRONTEND_URL}/shop`,
    metadata: {
      orderId: order.id,
    },
  });

  // Store the session ID
  await db.update(orders).set({ stripeSessionId: session.id }).where(eq(orders.id, order.id));

  return c.json({ url: session.url });
});

// ── Stripe webhook ───────────────────────────────────────────────

shopRoutes.post("/shop/webhook", async (c) => {
  const config = getConfig();
  if (!config.STRIPE_WEBHOOK_SECRET || !config.STRIPE_SECRET_KEY) {
    return c.json({ error: "Stripe not configured" }, 503);
  }

  const stripe = getStripe();
  const signature = c.req.header("stripe-signature") ?? "";
  const rawBody = await c.req.text();

  let event: Stripe.Event;
  try {
    // Async variant: signature verification uses WebCrypto on Workers.
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      config.STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    return c.json({ error: "Invalid signature" }, 400);
  }

  const db = getDb();

  if (event.type === "checkout.session.completed") {
    const eventSession = event.data.object as Stripe.Checkout.Session;
    const orderId = eventSession.metadata?.orderId;

    if (orderId) {
      // Re-fetch the full session from the API to get shipping_details + line_items
      const session = await stripe.checkout.sessions.retrieve(eventSession.id, {
        expand: ["line_items", "total_details.breakdown"],
      });

      const collected = (session as any).collected_information as
        | { shipping_details?: { name?: string; address?: Record<string, unknown> } }
        | undefined;
      const shipping = collected?.shipping_details;
      const shippingAddr = shipping?.address ? JSON.stringify(shipping.address) : null;

      // Get line item details for the email
      const lineItems = session.line_items?.data ?? [];
      const productLines = lineItems.map((li) => ({
        name: li.description || "Product",
        quantity: li.quantity || 0,
        amountCents: li.amount_subtotal || 0,
      }));

      // Taxes
      const taxAmountCents = session.total_details?.amount_tax || 0;

      // Idempotent: only update if pending
      const updated = await db
        .update(orders)
        .set({
          status: "paid",
          stripePaymentIntentId:
            typeof session.payment_intent === "string" ? session.payment_intent : null,
          email: session.customer_details?.email || undefined,
          totalAmountCents: session.amount_total || 0,
          shippingName: shipping?.name || null,
          shippingAddress: shippingAddr,
          updatedAt: new Date(),
        })
        .where(and(eq(orders.id, orderId), eq(orders.status, "pending")))
        .returning({ id: orders.id });

      // Send admin notification only if the order was updated (not a duplicate)
      if (updated.length > 0) {
        const orderLines = await db
          .select({ quantity: orderItems.quantity })
          .from(orderItems)
          .where(eq(orderItems.orderId, orderId));
        const totalQty = orderLines.reduce((sum, i) => sum + i.quantity, 0);

        c.executionCtx.waitUntil(
          sendEmail(
            buildOrderNotificationEmail({
              orderId,
              email: session.customer_details?.email || "unknown",
              totalAmountCents: session.amount_total || 0,
              taxAmountCents,
              quantity: totalQty,
              productLines,
              shippingName: shipping?.name || null,
              shippingAddress: shippingAddr,
            }),
          ).catch((err) => console.error("[shop] Admin notification failed:", err)),
        );

        // Send order confirmation to client
        const customerEmail = session.customer_details?.email;
        if (customerEmail) {
          // Determine language from user's preferredLanguage, fallback to "fr"
          const [orderRow] = await db
            .select({ userId: orders.userId })
            .from(orders)
            .where(eq(orders.id, orderId))
            .limit(1);

          let lang: "fr" | "en" = "fr";
          if (orderRow?.userId) {
            const [user] = await db
              .select({ preferredLanguage: users.preferredLanguage })
              .from(users)
              .where(eq(users.id, orderRow.userId))
              .limit(1);
            if (user?.preferredLanguage === "en") lang = "en";
          }

          c.executionCtx.waitUntil(
            sendEmail(
              buildOrderConfirmationEmail(
                {
                  orderId,
                  email: customerEmail,
                  totalAmountCents: session.amount_total || 0,
                  taxAmountCents,
                  productLines,
                  shippingName: shipping?.name || null,
                  shippingAddress: shippingAddr,
                },
                lang,
              ),
            ).catch((err) => console.error("[shop] Client confirmation failed:", err)),
          );
        }
      }
    }
  }

  if (event.type === "checkout.session.expired") {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId;

    if (orderId) {
      const updated = await db
        .update(orders)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(and(eq(orders.id, orderId), eq(orders.status, "pending")))
        .returning({ id: orders.id });

      if (updated.length > 0) {
        // Hard-delete any unclaimed codes the admin may have registered for
        // this order line — protects against the (rare) case where prep
        // happened before the session expired or was cancelled. Claimed
        // codes are left alone (customer has the physical autocollant).
        const lines = await db
          .select({ id: orderItems.id })
          .from(orderItems)
          .where(eq(orderItems.orderId, orderId));

        if (lines.length > 0) {
          await db
            .delete(stickerCodes)
            .where(
              and(
                inArray(
                  stickerCodes.orderItemId,
                  lines.map((l) => l.id),
                ),
                isNull(stickerCodes.claimedAt),
              ),
            );
        }
      }
    }
  }

  return c.json({ received: true });
});
