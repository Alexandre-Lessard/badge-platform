import type { FastifyReply, FastifyRequest } from "fastify";
import { verifyToken } from "../utils/tokens.js";
import { getDb } from "../db/client.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import {
  TOKEN_MISSING,
  TOKEN_INVALID,
  USER_NOT_FOUND,
  TOKEN_REVOKED,
  ADMIN_REQUIRED,
  EMAIL_NOT_VERIFIED,
} from "@badge/shared";
import { AppError } from "../utils/errors.js";

declare module "fastify" {
  interface FastifyRequest {
    userId?: string;
    emailVerified?: boolean;
    isAdmin?: boolean;
  }
}

export async function requireAuth(
  request: FastifyRequest,
  _reply: FastifyReply,
) {
  const header = request.headers.authorization;
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

  request.userId = user.id;
  request.emailVerified = user.emailVerified;
  request.isAdmin = user.isAdmin;
}

export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  await requireAuth(request, reply);
  if (!request.isAdmin) {
    throw new AppError(403, ADMIN_REQUIRED, "Admin access required");
  }
}

// Try to extract the user without blocking (optional auth)
export async function tryAuth(
  request: FastifyRequest,
  _reply: FastifyReply,
) {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) return;

  const token = header.slice(7);
  try {
    const payload = await verifyToken(token);
    if (payload.type !== "access") return;

    const db = getDb();
    const [user] = await db
      .select({ id: users.id, emailVerified: users.emailVerified })
      .from(users)
      .where(eq(users.id, payload.sub))
      .limit(1);

    if (user) {
      request.userId = user.id;
      request.emailVerified = user.emailVerified;
    }
  } catch {
    // Silently ignore — user stays unauthenticated
  }
}

export async function requireVerifiedEmail(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  await requireAuth(request, reply);
  if (!request.emailVerified) {
    throw new AppError(403, EMAIL_NOT_VERIFIED, "Please verify your email before continuing.");
  }
}
