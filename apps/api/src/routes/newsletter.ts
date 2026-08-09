import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { newsletterSubscribeSchema, SUBSCRIPTION_SUCCESS } from "@badge/shared";
import { getDb } from "../db/client.js";
import { newsletterSubscribers } from "../db/schema.js";

export async function newsletterRoutes(app: FastifyInstance) {
  app.post("/newsletter/subscribe", {
    config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    const body = newsletterSubscribeSchema.parse(request.body);
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

    return reply.send({
      code: SUBSCRIPTION_SUCCESS,
      message: "Subscription successful. Thank you!",
    });
  });
}
