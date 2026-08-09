import type { FastifyInstance } from "fastify";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { verifyPassword } from "../utils/password.js";
import { getConfig } from "../config.js";
import { AppError } from "../utils/errors.js";

const verifyLegacySchema = z.object({
  hash: z.string().min(1),
  password: z.string().min(1),
});

function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Argon2 verification for the Cloudflare Worker.
 *
 * argon2 is a native addon and cannot run on Workers, so during the migration
 * the Worker delegates verification of pre-migration `$argon2id$...` hashes to
 * this endpoint. It re-hashes to PBKDF2 on its side after a success, so this
 * route goes away once every account has logged in once.
 *
 * Reachable only through the Cloudflare Tunnel and gated by a shared secret.
 */
export async function internalRoutes(app: FastifyInstance) {
  app.post(
    "/internal/verify-legacy",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const config = getConfig();
      if (!config.LEGACY_VERIFY_SECRET) {
        throw new AppError(503, "NOT_CONFIGURED", "Legacy verification is not enabled");
      }

      const header = request.headers.authorization;
      if (!header?.startsWith("Bearer ") || !secretsMatch(header.slice(7), config.LEGACY_VERIFY_SECRET)) {
        throw new AppError(401, "UNAUTHORIZED", "Invalid credentials");
      }

      const body = verifyLegacySchema.parse(request.body);

      let valid = false;
      try {
        valid = await verifyPassword(body.hash, body.password);
      } catch {
        // Malformed hash — treat as a failed verification, never a 500
        valid = false;
      }

      return reply.send({ valid });
    },
  );
}
