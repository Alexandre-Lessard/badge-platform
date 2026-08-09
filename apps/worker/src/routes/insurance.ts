import { Hono } from "hono";
import { insuranceRequestSchema, INSURERS } from "@badge/shared";
import { getDb } from "../db/client.js";
import { insuranceRequests } from "../db/schema.js";
import { requireVerifiedEmail } from "../middleware/auth.js";
import type { AppEnv } from "../context.js";

export const insuranceRoutes = new Hono<AppEnv>();

// ── Submit insurance request ─────────────────────────────────────

insuranceRoutes.post("/insurance/request", requireVerifiedEmail, async (c) => {
  const body = insuranceRequestSchema.parse(await c.req.json());
  const db = getDb();

  // Look up insurer name for DB storage (use FR as canonical name)
  const insurer = INSURERS.find((i) => i.id === body.insurerId);
  const insurerName = insurer ? insurer.fr : body.insurerId;

  const [req] = await db
    .insert(insuranceRequests)
    .values({
      userId: c.var.userId!,
      insurerName,
      messageContent: body.messageContent,
    })
    .returning();

  return c.json({ request: req }, 201);
});

// ── List insurers ────────────────────────────────────────────────

insuranceRoutes.get("/insurance/insurers", (c) => c.json({ insurers: INSURERS }));
