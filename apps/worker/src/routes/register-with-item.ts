import { Hono } from "hono";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { registerSchema, createItemSchema } from "@rnbp/shared";
import { getDb } from "../db/client.js";
import { users, items, sessions } from "../db/schema.js";
import { hashPassword } from "../utils/password.js";
import { signAccessToken, signRefreshToken, hashToken } from "../utils/tokens.js";
import { EMAIL_ALREADY_EXISTS } from "@rnbp/shared";
import { AppError } from "../utils/errors.js";
import { generateClientNumber } from "../utils/client-number.js";
import { sendEmail, createSignedToken, buildVerificationEmail } from "../utils/email.js";
import { getConfig } from "../config.js";
import { TOKEN_EXPIRY } from "../constants/time.js";
import { toUserDto, userSelect } from "../utils/user-dto.js";
import type { AppEnv } from "../context.js";

const registerWithItemSchema = z.object({
  account: registerSchema,
  item: createItemSchema,
});

export const registerWithItemRoutes = new Hono<AppEnv>();

registerWithItemRoutes.post("/auth/register-with-item", async (c) => {
  const body = registerWithItemSchema.parse(await c.req.json());
  const db = getDb();

  const passwordHash = await hashPassword(body.account.password);

  // D1 has no interactive transactions: the UNIQUE constraint on users.email
  // is what actually prevents a duplicate account under a race.
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, body.account.email.toLowerCase()))
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
        email: body.account.email.toLowerCase(),
        passwordHash,
        firstName: body.account.firstName,
        lastName: body.account.lastName,
        phone: body.account.phone ?? null,
        clientNumber,
        preferredLanguage: body.account.preferredLanguage ?? "fr",
        termsAcceptedAt: new Date(),
      })
      .returning(userSelect);
  } catch (err) {
    if (err instanceof Error && /UNIQUE constraint failed: users\.email/i.test(err.message)) {
      throw new AppError(409, EMAIL_ALREADY_EXISTS, "An account with this email already exists");
    }
    throw err;
  }

  const [item] = await db
    .insert(items)
    .values({
      ownerId: user.id,
      name: body.item.name,
      description: body.item.description ?? null,
      category: body.item.category,
      brand: body.item.brand ?? null,
      model: body.item.model ?? null,
      year: body.item.year ?? null,
      serialNumber: body.item.serialNumber ?? null,
      trackerId: body.item.trackerId ?? null,
      estimatedValue: body.item.estimatedValue ?? null,
      purchaseDate: body.item.purchaseDate ? new Date(body.item.purchaseDate) : null,
    })
    .returning();

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
  const verifyToken = createSignedToken(user.id, "verify-email", TOKEN_EXPIRY.EMAIL_VERIFICATION);
  const verifyUrl = `${config.FRONTEND_URL}/verify-email?token=${verifyToken}`;
  c.executionCtx.waitUntil(
    sendEmail(buildVerificationEmail(user.firstName, user.email, verifyUrl, lang)).catch((err) => {
      console.error("Failed to send verification email", err);
    }),
  );

  return c.json({ user: toUserDto(user), item, accessToken, refreshToken }, 201);
});
