import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { newsletterSubscribeSchema, SUBSCRIPTION_SUCCESS } from "@rnbp/shared";
import { getDb } from "../db/client.js";
import { newsletterSubscribers } from "../db/schema.js";
import { authRateLimit } from "../middleware/auth.js";
import type { AppEnv } from "../context.js";

export const newsletterRoutes = new Hono<AppEnv>();

newsletterRoutes.post("/newsletter/subscribe", authRateLimit, async (c) => {
  const body = newsletterSubscribeSchema.parse(await c.req.json());
  const db = getDb();

  // Upsert — don't error if already subscribed
  const [existing] = await db
    .select({ id: newsletterSubscribers.id })
    .from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.email, body.email.toLowerCase()))
    .limit(1);

  if (!existing) {
    await db.insert(newsletterSubscribers).values({
      email: body.email.toLowerCase(),
    });
  }

  return c.json({
    code: SUBSCRIPTION_SUCCESS,
    message: "Subscription successful. Thank you!",
  });
});
