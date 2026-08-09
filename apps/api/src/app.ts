import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import rawBody from "fastify-raw-body";
import { getConfig } from "./config.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { itemRoutes } from "./routes/items.js";
import { registerWithItemRoutes } from "./routes/register-with-item.js";
import { reportRoutes } from "./routes/reports.js";
import { newsletterRoutes } from "./routes/newsletter.js";
import { insuranceRoutes } from "./routes/insurance.js";
import { contactRoutes } from "./routes/contact.js";
import { shopRoutes } from "./routes/shop.js";
import { stickerCodesRoutes } from "./routes/sticker-codes.js";
import { adminRoutes } from "./routes/admin.js";
import { oauthRoutes } from "./routes/oauth.js";
import { uploadRoutes } from "./routes/uploads.js";
import { internalRoutes } from "./routes/internal.js";
import { errorHandler } from "./middleware/error-handler.js";
import { securityHeaders } from "./middleware/security-headers.js";
import { incrementRequestCount } from "./utils/request-counter.js";

export async function buildApp() {
  const config = getConfig();

  const app = Fastify({
    logger: {
      level: config.NODE_ENV === "production" ? "info" : "debug",
      transport:
        config.NODE_ENV !== "production"
          ? { target: "pino-pretty", options: { translateTime: "HH:MM:ss" } }
          : undefined,
    },
  });

  // Error handler
  app.setErrorHandler(errorHandler);

  // CORS
  await app.register(cors, {
    origin: config.CORS_ORIGINS,
    credentials: true,
    methods: ["GET", "HEAD", "PUT", "POST", "DELETE", "PATCH"],
  });

  // Security headers
  await app.register(securityHeaders);

  // Multipart (for file uploads — NOT global to avoid Stripe rawBody conflict)
  await app.register(multipart, {
    limits: { fileSize: config.MAX_FILE_SIZE, files: 5 },
  });

  // Raw body (pour webhook Stripe)
  await app.register(rawBody, { global: false, runFirst: true });

  // Rate limiting (global baseline)
  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });

  // Request counter for admin metrics
  app.addHook("onRequest", async () => {
    incrementRequestCount();
  });

  // Routes
  await app.register(healthRoutes, { prefix: "/api" });
  await app.register(authRoutes, { prefix: "/api" });
  await app.register(itemRoutes, { prefix: "/api" });
  await app.register(registerWithItemRoutes, { prefix: "/api" });
  await app.register(reportRoutes, { prefix: "/api" });
  await app.register(newsletterRoutes, { prefix: "/api" });
  await app.register(insuranceRoutes, { prefix: "/api" });
  await app.register(contactRoutes, { prefix: "/api" });
  await app.register(shopRoutes, { prefix: "/api" });
  await app.register(stickerCodesRoutes, { prefix: "/api" });
  await app.register(uploadRoutes, { prefix: "/api" });
  await app.register(adminRoutes, { prefix: "/api" });
  await app.register(oauthRoutes, { prefix: "/api" });
  await app.register(internalRoutes, { prefix: "/api" });

  return app;
}
