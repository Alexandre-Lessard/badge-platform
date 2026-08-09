import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { registerSchema, createItemSchema } from "@badge/shared";
import { getDb } from "../db/client.js";
import { users, items, sessions } from "../db/schema.js";
import { hashPassword } from "../utils/password.js";
import { signAccessToken, signRefreshToken, hashToken } from "../utils/tokens.js";
import { EMAIL_ALREADY_EXISTS } from "@badge/shared";
import { AppError } from "../utils/errors.js";
import { generateClientNumber } from "../utils/client-number.js";
import {
  sendEmail,
  createSignedToken,
  buildVerificationEmail,
} from "../utils/email.js";
import { getConfig } from "../config.js";
import { TOKEN_EXPIRY } from "../constants/time.js";
import { toUserDto, userSelect } from "../utils/user-dto.js";

const registerWithItemSchema = z.object({
  account: registerSchema,
  item: createItemSchema,
});

export async function registerWithItemRoutes(app: FastifyInstance) {
  app.post("/auth/register-with-item", async (request, reply) => {
    const body = registerWithItemSchema.parse(request.body);
    const db = getDb();

    const passwordHash = await hashPassword(body.account.password);

    // Atomic transaction: check uniqueness + create user + item (prevents TOCTOU)
    const result = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, body.account.email.toLowerCase()))
        .limit(1);

      if (existing) {
        throw new AppError(409, EMAIL_ALREADY_EXISTS, "An account with this email already exists");
      }

      const clientNumber = await generateClientNumber(tx);

      const [user] = await tx
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

      const [item] = await tx
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
          purchaseDate: body.item.purchaseDate
            ? new Date(body.item.purchaseDate)
            : null,
        })
        .returning();

      return { user, item };
    });

    const accessToken = await signAccessToken(result.user.id);
    const refreshToken = await signRefreshToken(result.user.id);

    await db.insert(sessions).values({
      userId: result.user.id,
      tokenHash: hashToken(refreshToken),
      deviceInfo: request.headers["user-agent"] || null,
      expiresAt: new Date(Date.now() + TOKEN_EXPIRY.SESSION),
    });

    // Send verification email (fire & forget)
    const config = getConfig();
    const lang = (result.user.preferredLanguage as "fr" | "en") ?? "fr";
    const verifyToken = createSignedToken(result.user.id, "verify-email", TOKEN_EXPIRY.EMAIL_VERIFICATION);
    const verifyUrl = `${config.FRONTEND_URL}/verify-email?token=${verifyToken}`;
    sendEmail(buildVerificationEmail(result.user.firstName, result.user.email, verifyUrl, lang)).catch((err) => {
      app.log.error(err, "Failed to send verification email");
    });

    return reply.status(201).send({
      user: toUserDto(result.user),
      item: result.item,
      accessToken,
      refreshToken,
    });
  });
}
