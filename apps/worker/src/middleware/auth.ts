import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { eq } from "drizzle-orm";
import {
  TOKEN_MISSING,
  TOKEN_INVALID,
  USER_NOT_FOUND,
  TOKEN_REVOKED,
  ADMIN_REQUIRED,
  EMAIL_NOT_VERIFIED,
} from "@badge/shared";
import { verifyToken } from "../utils/tokens.js";
import { getDb } from "../db/client.js";
import { users } from "../db/schema.js";
import { AppError } from "../utils/errors.js";
import type { AppEnv } from "../context.js";

async function authenticate(c: Context<AppEnv>): Promise<void> {
  const header = c.req.header("authorization");
  if (!header?.startsWith("Bearer ")) {
    throw new AppError(401, TOKEN_MISSING, "Missing token");
  }

  const token = header.slice(7);

  let payload;
  try {
    payload = await verifyToken(token);
  } catch {
    throw new AppError(401, TOKEN_INVALID, "Invalid or expired token");
  }

  if (payload.type !== "access") {
    throw new AppError(401, TOKEN_INVALID, "Invalid token type");
  }

  // Check user exists and token wasn't globally revoked
  const db = getDb();
  const [user] = await db
    .select({
      id: users.id,
      emailVerified: users.emailVerified,
      isAdmin: users.isAdmin,
      tokenRevokedBefore: users.tokenRevokedBefore,
    })
    .from(users)
    .where(eq(users.id, payload.sub))
    .limit(1);

  if (!user) {
    throw new AppError(401, USER_NOT_FOUND, "User not found");
  }

  if (user.tokenRevokedBefore) {
    const tokenIssuedAt = new Date(payload.iat * 1000);
    if (tokenIssuedAt < user.tokenRevokedBefore) {
      throw new AppError(401, TOKEN_REVOKED, "Token revoked. Please sign in again.");
    }
  }

  c.set("userId", user.id);
  c.set("emailVerified", user.emailVerified);
  c.set("isAdmin", user.isAdmin);
}

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  await authenticate(c);
  await next();
});

export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  await authenticate(c);
  if (!c.var.isAdmin) {
    throw new AppError(403, ADMIN_REQUIRED, "Admin access required");
  }
  await next();
});

export const requireVerifiedEmail = createMiddleware<AppEnv>(async (c, next) => {
  await authenticate(c);
  if (!c.var.emailVerified) {
    throw new AppError(403, EMAIL_NOT_VERIFIED, "Please verify your email before continuing.");
  }
  await next();
});

// Try to extract the user without blocking (optional auth)
export const tryAuth = createMiddleware<AppEnv>(async (c, next) => {
  const header = c.req.header("authorization");
  if (header?.startsWith("Bearer ")) {
    const token = header.slice(7);
    try {
      const payload = await verifyToken(token);
      if (payload.type === "access") {
        const db = getDb();
        const [user] = await db
          .select({ id: users.id, emailVerified: users.emailVerified })
          .from(users)
          .where(eq(users.id, payload.sub))
          .limit(1);

        if (user) {
          c.set("userId", user.id);
          c.set("emailVerified", user.emailVerified);
        }
      }
    } catch {
      // Silently ignore — user stays unauthenticated
    }
  }
  await next();
});

/**
 * Per-IP rate limit for sensitive endpoints, replacing @fastify/rate-limit's
 * per-route config. Uses the Workers rate limiting binding.
 */
export const authRateLimit = createMiddleware<AppEnv>(async (c, next) => {
  const ip = c.req.header("cf-connecting-ip") ?? "unknown";
  const { success } = await c.env.AUTH_RATE_LIMITER.limit({
    key: `${new URL(c.req.url).pathname}:${ip}`,
  });
  if (!success) {
    throw new AppError(429, "TOO_MANY_REQUESTS", "Too many requests. Please try again later.");
  }
  await next();
});
