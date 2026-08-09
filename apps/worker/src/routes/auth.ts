import { Hono } from "hono";
import { eq, and, gt } from "drizzle-orm";
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updateProfileSchema,
  type UpdateProfileInput,
} from "@badge/shared";
import { getDb } from "../db/client.js";
import { users, sessions } from "../db/schema.js";
import { hashPassword, verifyPassword, isLegacyHash } from "../utils/password.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyToken,
  hashToken,
} from "../utils/tokens.js";
import {
  EMAIL_ALREADY_EXISTS,
  INVALID_CREDENTIALS,
  REFRESH_TOKEN_REQUIRED,
  TOKEN_INVALID,
  SESSION_NOT_FOUND,
  USER_NOT_FOUND,
  TOKEN_REVOKED,
  LOGOUT_SUCCESS,
  PASSWORD_RESET_SENT,
  RESET_LINK_INVALID,
  PASSWORD_RESET_SUCCESS,
  TOKEN_REQUIRED,
  VERIFY_LINK_INVALID,
  EMAIL_VERIFIED,
  EMAIL_ALREADY_VERIFIED,
  VERIFICATION_SENT,
} from "@badge/shared";
import { AppError } from "../utils/errors.js";
import { requireAuth, authRateLimit } from "../middleware/auth.js";
import { generateClientNumber } from "../utils/client-number.js";
import {
  sendEmail,
  createSignedToken,
  verifySignedToken,
  buildVerificationEmail,
  buildResetEmail,
  buildSignupNotificationEmail,
} from "../utils/email.js";
import { getConfig } from "../config.js";
import { TOKEN_EXPIRY } from "../constants/time.js";
import { toUserDto, userSelect } from "../utils/user-dto.js";
import type { AppEnv } from "../context.js";

function normalizeOptionalText(value: string | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function normalizeCountry(value: string | undefined): string | null | undefined {
  const normalized = normalizeOptionalText(value);
  if (normalized === undefined || normalized === null) return normalized;
  return normalized.toUpperCase();
}

function hasAddressValue(body: UpdateProfileInput): boolean {
  return [body.address1, body.address2, body.city, body.province, body.postalCode]
    .some((value) => typeof value === "string" && value.trim() !== "");
}

export const authRoutes = new Hono<AppEnv>();

// ── Register ───────────────────────────────────────────────────────

authRoutes.post("/auth/register", authRateLimit, async (c) => {
  const body = registerSchema.parse(await c.req.json());
  const db = getDb();
  const passwordHash = await hashPassword(body.password);

  // D1 has no interactive transactions: rely on the UNIQUE constraint on
  // users.email to keep the check-and-insert race-free.
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, body.email.toLowerCase()))
    .limit(1);

  if (existing) {
    throw new AppError(409, EMAIL_ALREADY_EXISTS, "An account with this email already exists");
  }

  const clientNumber = await generateClientNumber();

  let user;
  try {
    [user] = await db
      .insert(users)
      .values({
        email: body.email.toLowerCase(),
        passwordHash,
        firstName: body.firstName,
        lastName: body.lastName,
        phone: body.phone ?? null,
        clientNumber,
        preferredLanguage: body.preferredLanguage ?? "fr",
        termsAcceptedAt: new Date(),
      })
      .returning(userSelect);
  } catch (err) {
    if (err instanceof Error && /UNIQUE constraint failed: users\.email/i.test(err.message)) {
      throw new AppError(409, EMAIL_ALREADY_EXISTS, "An account with this email already exists");
    }
    throw err;
  }

  const accessToken = await signAccessToken(user.id);
  const refreshToken = await signRefreshToken(user.id);

  await db.insert(sessions).values({
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    deviceInfo: c.req.header("user-agent") || null,
    expiresAt: new Date(Date.now() + TOKEN_EXPIRY.SESSION),
  });

  // Send verification email (fire & forget)
  const config = getConfig();
  const lang = (user.preferredLanguage as "fr" | "en") ?? "fr";
  const verifyTokenStr = createSignedToken(user.id, "verify-email", TOKEN_EXPIRY.EMAIL_VERIFICATION);
  const verifyUrl = `${config.FRONTEND_URL}/verify-email?token=${verifyTokenStr}`;
  c.executionCtx.waitUntil(
    sendEmail(buildVerificationEmail(user.firstName, user.email, verifyUrl, lang)).catch((err) => {
      console.error("Failed to send verification email", err);
    }),
  );

  // Notify admin of the new signup (fire & forget)
  c.executionCtx.waitUntil(
    sendEmail(
      buildSignupNotificationEmail(
        { firstName: user.firstName, lastName: user.lastName, email: user.email },
        lang,
      ),
    ).catch((err) => {
      console.error("Failed to send signup notification email", err);
    }),
  );

  return c.json({ user: toUserDto(user), accessToken, refreshToken }, 201);
});

// ── Login ──────────────────────────────────────────────────────────

authRoutes.post("/auth/login", authRateLimit, async (c) => {
  const body = loginSchema.parse(await c.req.json());
  const db = getDb();

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, body.email.toLowerCase()))
    .limit(1);

  if (!user) {
    throw new AppError(401, INVALID_CREDENTIALS, "Invalid email or password");
  }

  if (!user.passwordHash) {
    throw new AppError(401, "SOCIAL_ACCOUNT", "This account uses social login");
  }

  const valid = await verifyPassword(user.passwordHash, body.password);
  if (!valid) {
    throw new AppError(401, INVALID_CREDENTIALS, "Invalid email or password");
  }

  // Migrate argon2 hashes to PBKDF2 on first successful login, so the legacy
  // verification server can eventually be retired.
  if (isLegacyHash(user.passwordHash)) {
    const upgraded = await hashPassword(body.password);
    await db
      .update(users)
      .set({ passwordHash: upgraded, updatedAt: new Date() })
      .where(eq(users.id, user.id));
  }

  const accessToken = await signAccessToken(user.id);
  const refreshToken = await signRefreshToken(user.id);

  await db.insert(sessions).values({
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    deviceInfo: c.req.header("user-agent") || null,
    expiresAt: new Date(Date.now() + TOKEN_EXPIRY.SESSION),
  });

  return c.json({ user: toUserDto(user), accessToken, refreshToken });
});

// ── Refresh ────────────────────────────────────────────────────────

authRoutes.post("/auth/refresh", async (c) => {
  const { refreshToken } = (await c.req.json().catch(() => ({}))) as { refreshToken?: string };
  if (!refreshToken) {
    throw new AppError(400, REFRESH_TOKEN_REQUIRED, "Refresh token required");
  }

  let payload;
  try {
    payload = await verifyToken(refreshToken);
  } catch {
    throw new AppError(401, TOKEN_INVALID, "Invalid or expired refresh token");
  }

  if (payload.type !== "refresh") {
    throw new AppError(401, TOKEN_INVALID, "Invalid token type");
  }

  const db = getDb();
  const tokenH = hashToken(refreshToken);

  const [session] = await db
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.tokenHash, tokenH),
        eq(sessions.userId, payload.sub),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!session) {
    throw new AppError(401, SESSION_NOT_FOUND, "Session not found or expired");
  }

  await db.delete(sessions).where(eq(sessions.id, session.id));

  const [user] = await db
    .select()
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

  const newAccessToken = await signAccessToken(user.id);
  const newRefreshToken = await signRefreshToken(user.id);

  await db.insert(sessions).values({
    userId: user.id,
    tokenHash: hashToken(newRefreshToken),
    deviceInfo: c.req.header("user-agent") || null,
    expiresAt: new Date(Date.now() + TOKEN_EXPIRY.SESSION),
  });

  return c.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
});

// ── Logout ─────────────────────────────────────────────────────────

authRoutes.post("/auth/logout", requireAuth, async (c) => {
  const { refreshToken } = (await c.req.json().catch(() => ({}))) as { refreshToken?: string };
  const db = getDb();

  if (refreshToken) {
    await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(refreshToken)));
  } else {
    await db.delete(sessions).where(eq(sessions.userId, c.var.userId!));
  }

  return c.json({ code: LOGOUT_SUCCESS, message: "Logged out successfully" });
});

// ── Me ─────────────────────────────────────────────────────────────

authRoutes.get("/auth/me", requireAuth, async (c) => {
  const db = getDb();
  const [user] = await db
    .select(userSelect)
    .from(users)
    .where(eq(users.id, c.var.userId!))
    .limit(1);

  if (!user) {
    throw new AppError(401, USER_NOT_FOUND, "User not found");
  }

  return c.json({ user: toUserDto(user) });
});

// ── Update Profile ─────────────────────────────────────────────────

authRoutes.patch("/auth/profile", requireAuth, async (c) => {
  const body = updateProfileSchema.parse(await c.req.json());
  const db = getDb();

  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (body.firstName !== undefined) updates.firstName = body.firstName.trim();
  if (body.lastName !== undefined) updates.lastName = body.lastName.trim();

  if (body.contactEmail !== undefined) {
    const normalizedContactEmail = normalizeOptionalText(body.contactEmail);
    updates.contactEmail = normalizedContactEmail ? normalizedContactEmail.toLowerCase() : null;
  }

  const normalizedPhone = normalizeOptionalText(body.phone);
  if (normalizedPhone !== undefined) updates.phone = normalizedPhone;

  const normalizedAddress1 = normalizeOptionalText(body.address1);
  if (normalizedAddress1 !== undefined) updates.address1 = normalizedAddress1;

  const normalizedAddress2 = normalizeOptionalText(body.address2);
  if (normalizedAddress2 !== undefined) updates.address2 = normalizedAddress2;

  const normalizedCity = normalizeOptionalText(body.city);
  if (normalizedCity !== undefined) updates.city = normalizedCity;

  const normalizedProvince = normalizeOptionalText(body.province);
  if (normalizedProvince !== undefined) updates.province = normalizedProvince;

  const normalizedPostalCode = normalizeOptionalText(body.postalCode);
  if (normalizedPostalCode !== undefined) updates.postalCode = normalizedPostalCode;

  const normalizedCountry = normalizeCountry(body.country);
  if (normalizedCountry !== undefined) {
    updates.country = normalizedCountry;
  } else if (hasAddressValue(body)) {
    updates.country = "CA";
  }

  if (body.preferredLanguage) {
    updates.preferredLanguage = body.preferredLanguage;
  }

  await db.update(users).set(updates).where(eq(users.id, c.var.userId!));

  return c.json({ success: true });
});

// ── Forgot Password ────────────────────────────────────────────────

authRoutes.post("/auth/forgot-password", authRateLimit, async (c) => {
  const body = forgotPasswordSchema.parse(await c.req.json());
  const db = getDb();
  const config = getConfig();

  const [user] = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      preferredLanguage: users.preferredLanguage,
    })
    .from(users)
    .where(eq(users.email, body.email.toLowerCase()))
    .limit(1);

  if (user) {
    const lang = (user.preferredLanguage as "fr" | "en") ?? "fr";
    const token = createSignedToken(user.id, "reset-password", TOKEN_EXPIRY.PASSWORD_RESET);
    const resetUrl = `${config.FRONTEND_URL}/reinitialiser-mot-de-passe?token=${token}`;
    c.executionCtx.waitUntil(
      sendEmail(buildResetEmail(user.firstName, body.email.toLowerCase(), resetUrl, lang)).catch(
        (err) => {
          console.error("Failed to send password reset email", err);
        },
      ),
    );
  }

  return c.json({
    code: PASSWORD_RESET_SENT,
    message: "If an account exists with this email, a reset email has been sent.",
  });
});

// ── Reset Password ─────────────────────────────────────────────────

authRoutes.post("/auth/reset-password", authRateLimit, async (c) => {
  const body = resetPasswordSchema.parse(await c.req.json());

  const userId = verifySignedToken(body.token, "reset-password");
  if (!userId) {
    throw new AppError(400, RESET_LINK_INVALID, "Invalid or expired reset link");
  }

  const db = getDb();
  const passwordHash = await hashPassword(body.password);

  await db
    .update(users)
    .set({ passwordHash, tokenRevokedBefore: new Date(), updatedAt: new Date() })
    .where(eq(users.id, userId));

  await db.delete(sessions).where(eq(sessions.userId, userId));

  return c.json({
    code: PASSWORD_RESET_SUCCESS,
    message: "Password reset successfully. Please sign in again.",
  });
});

// ── Verify Email ──────────────────────────────────────────────────

authRoutes.post("/auth/verify-email", async (c) => {
  const { token } = (await c.req.json().catch(() => ({}))) as { token?: string };
  if (!token) {
    throw new AppError(400, TOKEN_REQUIRED, "Token required");
  }

  const userId = verifySignedToken(token, "verify-email");
  if (!userId) {
    throw new AppError(400, VERIFY_LINK_INVALID, "Invalid or expired verification link");
  }

  const db = getDb();
  await db
    .update(users)
    .set({ emailVerified: true, updatedAt: new Date() })
    .where(eq(users.id, userId));

  return c.json({ code: EMAIL_VERIFIED, message: "Email verified successfully." });
});

// ── Resend Verification Email ─────────────────────────────────────

authRoutes.post("/auth/resend-verification", requireAuth, authRateLimit, async (c) => {
  const db = getDb();
  const config = getConfig();

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      emailVerified: users.emailVerified,
      preferredLanguage: users.preferredLanguage,
    })
    .from(users)
    .where(eq(users.id, c.var.userId!))
    .limit(1);

  if (!user) {
    throw new AppError(401, USER_NOT_FOUND, "User not found");
  }

  if (user.emailVerified) {
    return c.json({ code: EMAIL_ALREADY_VERIFIED, message: "Email already verified." });
  }

  const lang = (user.preferredLanguage as "fr" | "en") ?? "fr";
  const token = createSignedToken(user.id, "verify-email", TOKEN_EXPIRY.EMAIL_VERIFICATION);
  const verifyUrl = `${config.FRONTEND_URL}/verify-email?token=${token}`;
  await sendEmail(buildVerificationEmail(user.firstName, user.email, verifyUrl, lang));

  return c.json({ code: VERIFICATION_SENT, message: "Verification email sent." });
});
