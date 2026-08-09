import type { FastifyInstance } from "fastify";
import { insuranceRequestSchema, INSURERS } from "@badge/shared";
import { getDb } from "../db/client.js";
import { insuranceRequests } from "../db/schema.js";
import { requireVerifiedEmail } from "../middleware/auth.js";

export async function insuranceRoutes(app: FastifyInstance) {
  // ── Submit insurance request ─────────────────────────────────────

  app.post(
    "/insurance/request",
    { preHandler: requireVerifiedEmail },
    async (request, reply) => {
      const body = insuranceRequestSchema.parse(request.body);
      const db = getDb();

      // Look up insurer name for DB storage (use FR as canonical name)
      const insurer = INSURERS.find((i) => i.id === body.insurerId);
      const insurerName = insurer ? insurer.fr : body.insurerId;

      const [req] = await db
        .insert(insuranceRequests)
        .values({
          userId: request.userId!,
          insurerName,
          messageContent: body.messageContent,
        })
        .returning();

      return reply.status(201).send({ request: req });
    },
  );

  // ── List insurers ────────────────────────────────────────────────

  app.get("/insurance/insurers", async (_request, reply) => {
    return reply.send({ insurers: INSURERS });
  });
}
