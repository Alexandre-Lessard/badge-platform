import type { FastifyInstance } from "fastify";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { users, sessions } from "../db/schema.js";
import {
  signAccessToken,
  signRefreshToken,
  hashToken,
} from "../utils/tokens.js";
import { OAUTH_TOKEN_INVALID, INTERNAL_ERROR } from "@rnbp/shared";
import { AppError } from "../utils/errors.js";
import { generateClientNumber } from "../utils/client-number.js";
import { getConfig } from "../config.js";
import { TOKEN_EXPIRY } from "../constants/time.js";
import {
  sendEmail,
  buildVerificationEmail,
  buildSignupNotificationEmail,
  createSignedToken as createEmailToken,
} from "../utils/email.js";
import {
  exchangeGoogleCode,
  exchangeMicrosoftCode,
  exchangeFacebookCode,
  type OAuthProfile,
} from "../utils/oauth.js";
import { toUserDto } from "../utils/user-dto.js";

// ── Schemas Zod ──────────────────────────────────────────────────────

const oauthCodeSchema = z.object({
  code: z.string().min(1),
  redirectUri: z.string().url(),
  codeVerifier: z.string().min(43),
});

const oauthCodeNoPkceSchema = z.object({
  code: z.string().min(1),
  redirectUri: z.string().url(),
});

const oauthCompleteSchema = z.object({
  token: z.string().min(1),
  email: z.string().email(),
});

// ── HMAC token for the "missing email" flow ──────────────────────────

const OAUTH_PENDING_EXPIRY = 5 * 60 * 1000; // 5 minutes

function createOAuthPendingToken(data: {
  provider: string;
  providerId: string;
  firstName: string;
  lastName: string;
}): string {
  const config = getConfig();
  const expiresAt = Date.now() + OAUTH_PENDING_EXPIRY;
  const nonce = randomBytes(16).toString("hex");
  const payload = JSON.stringify(data);
  const payloadB64 = Buffer.from(payload).toString("base64url");
  const sigData = `${payloadB64}.${expiresAt}.${nonce}.oauth-pending`;
  const signature = createHmac("sha256", config.JWT_PRIVATE_KEY)
    .update(sigData)
    .digest("hex");
  return `${payloadB64}.${expiresAt}.${nonce}.${signature}`;
}

function verifyOAuthPendingToken(token: string): {
  provider: string;
  providerId: string;
  firstName: string;
  lastName: string;
} | null {
  const config = getConfig();
  const parts = token.split(".");
  if (parts.length !== 4) return null;

  const [payloadB64, expiresAtStr, nonce, signature] = parts;
  const expiresAt = Number(expiresAtStr);

  if (isNaN(expiresAt) || Date.now() > expiresAt) return null;

  const sigData = `${payloadB64}.${expiresAt}.${nonce}.oauth-pending`;
  const expected = createHmac("sha256", config.JWT_PRIVATE_KEY)
    .update(sigData)
    .digest("hex");

  // Timing-safe comparison
  const a = Buffer.from(signature!, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    return JSON.parse(Buffer.from(payloadB64!, "base64url").toString());
  } catch {
    return null;
  }
}

// ── Common OAuth logic ───────────────────────────────────────────────

type OAuthProvider = "google" | "microsoft" | "facebook";

const providerIdColumn = {
  google: "googleId",
  microsoft: "microsoftId",
  facebook: "facebookId",
} as const;

async function handleOAuthLogin(
  provider: OAuthProvider,
  profile: OAuthProfile,
  deviceInfo: string | null,
) {
  const db = getDb();
  const idCol = providerIdColumn[provider];

  // No email from provider — return a pending token
  if (!profile.email) {
    const pendingToken = createOAuthPendingToken({
      provider,
      providerId: profile.providerId,
      firstName: profile.firstName,
      lastName: profile.lastName,
    });
    return {
      needsEmail: true as const,
      pendingToken,
    };
  }

  const email = profile.email.toLowerCase();

  // Look up by providerId
  const [byProvider] = await db
    .select()
    .from(users)
    .where(eq(users[idCol], profile.providerId))
    .limit(1);

  let user = byProvider;

  if (!user) {
    // Look up by email
    const [byEmail] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (byEmail) {
      // Link provider to existing account
      await db
        .update(users)
        .set({
          [idCol]: profile.providerId,
          emailVerified: true,
          updatedAt: new Date(),
        })
        .where(eq(users.id, byEmail.id));
      user = { ...byEmail, [idCol]: profile.providerId, emailVerified: true };
    } else {
      // Create new account
      const clientNumber = await generateClientNumber();
      const [created] = await db
        .insert(users)
        .values({
          email,
          passwordHash: null,
          firstName: profile.firstName,
          lastName: profile.lastName,
          emailVerified: profile.emailVerified,
          clientNumber,
          termsAcceptedAt: new Date(),
          [idCol]: profile.providerId,
        })
        .returning();
      user = created;

      // Notify admin of the new signup (fire & forget)
      const signupLang = (created.preferredLanguage as "fr" | "en") ?? "fr";
      sendEmail(
        buildSignupNotificationEmail(
          {
            firstName: created.firstName,
            lastName: created.lastName,
            email: created.email,
            provider,
          },
          signupLang,
        ),
      ).catch(() => {
        /* non-blocking: signup notification is best-effort */
      });
    }
  }

  // Issue tokens
  const accessToken = await signAccessToken(user!.id);
  const refreshToken = await signRefreshToken(user!.id);

  await db.insert(sessions).values({
    userId: user!.id,
    tokenHash: hashToken(refreshToken),
    deviceInfo,
    expiresAt: new Date(Date.now() + TOKEN_EXPIRY.SESSION),
  });

  return {
    needsEmail: false as const,
    user: toUserDto(user!),
    accessToken,
    refreshToken,
  };
}

// ── Routes ───────────────────────────────────────────────────────────

export async function oauthRoutes(app: FastifyInstance) {
  // POST /auth/google
  app.post(
    "/auth/google",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const body = oauthCodeSchema.parse(request.body);
      const profile = await exchangeGoogleCode(
        body.code,
        body.redirectUri,
        body.codeVerifier,
      );

      const result = await handleOAuthLogin(
        "google",
        profile,
        request.headers["user-agent"] || null,
      );

      if (result.needsEmail) {
        return reply.send({
          needsEmail: true,
          pendingToken: result.pendingToken,
        });
      }

      return reply.send({
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
    },
  );

  // POST /auth/microsoft
  app.post(
    "/auth/microsoft",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const body = oauthCodeSchema.parse(request.body);
      const profile = await exchangeMicrosoftCode(
        body.code,
        body.redirectUri,
        body.codeVerifier,
      );

      const result = await handleOAuthLogin(
        "microsoft",
        profile,
        request.headers["user-agent"] || null,
      );

      if (result.needsEmail) {
        return reply.send({
          needsEmail: true,
          pendingToken: result.pendingToken,
        });
      }

      return reply.send({
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
    },
  );

  // POST /auth/facebook (no PKCE)
  app.post(
    "/auth/facebook",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const body = oauthCodeNoPkceSchema.parse(request.body);
      const profile = await exchangeFacebookCode(
        body.code,
        body.redirectUri,
      );

      const result = await handleOAuthLogin(
        "facebook",
        profile,
        request.headers["user-agent"] || null,
      );

      if (result.needsEmail) {
        return reply.send({
          needsEmail: true,
          pendingToken: result.pendingToken,
        });
      }

      return reply.send({
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
    },
  );

  // POST /auth/oauth-complete (missing email flow)
  app.post(
    "/auth/oauth-complete",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const body = oauthCompleteSchema.parse(request.body);

      const pending = verifyOAuthPendingToken(body.token);
      if (!pending) {
        throw new AppError(400, OAUTH_TOKEN_INVALID, "Invalid or expired OAuth token");
      }

      const provider = pending.provider as OAuthProvider;
      const profile: OAuthProfile = {
        providerId: pending.providerId,
        email: body.email,
        firstName: pending.firstName,
        lastName: pending.lastName,
        emailVerified: false, // Manually entered email — not verified
      };

      const result = await handleOAuthLogin(
        provider,
        profile,
        request.headers["user-agent"] || null,
      );

      if (result.needsEmail) {
        throw new AppError(400, INTERNAL_ERROR, "Unexpected error");
      }

      // Send verification email (manually entered email)
      const config = getConfig();
      const lang = (result.user.preferredLanguage as "fr" | "en") ?? "fr";
      const verifyTokenStr = createEmailToken(
        result.user.id,
        "verify-email",
        TOKEN_EXPIRY.EMAIL_VERIFICATION,
      );
      const verifyUrl = `${config.FRONTEND_URL}/verify-email?token=${verifyTokenStr}`;
      sendEmail(
        buildVerificationEmail(result.user.firstName, result.user.email, verifyUrl, lang),
      ).catch((err) => {
        app.log.error(err, "Failed to send verification email after OAuth complete");
      });

      return reply.send({
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
    },
  );
}
