import { Hono } from "hono";
import { contactSchema, MESSAGE_SENT } from "@rnbp/shared";
import { getDb } from "../db/client.js";
import { contactMessages } from "../db/schema.js";
import { sendEmail, buildContactNotificationEmail } from "../utils/email.js";
import { authRateLimit } from "../middleware/auth.js";
import type { AppEnv } from "../context.js";

export const contactRoutes = new Hono<AppEnv>();

contactRoutes.post("/contact", authRateLimit, async (c) => {
  const body = contactSchema.parse(await c.req.json());

  // Honeypot — if filled, pretend it worked
  if (body.website) {
    return c.json({ code: MESSAGE_SENT, message: "Message sent." }, 201);
  }

  const db = getDb();

  await db.insert(contactMessages).values({
    name: body.name,
    email: body.email,
    company: body.company,
    phone: body.phone,
    type: body.type,
    message: body.message,
  });

  try {
    await sendEmail(
      buildContactNotificationEmail(
        body.name,
        body.email,
        body.company,
        body.phone,
        body.type,
        body.message,
      ),
    );
  } catch (err) {
    // Email failure is non-blocking — the message is already in DB
    console.error("Failed to send contact notification email", err);
  }

  return c.json({ code: MESSAGE_SENT, message: "Message sent." }, 201);
});
