import { Hono } from "hono";
import { cors } from "hono/cors";
import { ZodError } from "zod";
import { TOO_MANY_REQUESTS, INTERNAL_ERROR } from "@badge/shared";
import { initConfig, getConfig, type Bindings } from "./config.js";
import { initDb } from "./db/client.js";
import { initR2 } from "./utils/r2.js";
import { AppError } from "./utils/errors.js";
import { incrementRequestCount } from "./utils/request-counter.js";
import type { AppEnv } from "./context.js";
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
import { uploadRoutes } from "./routes/uploads.js";
import { adminRoutes } from "./routes/admin.js";
import { oauthRoutes } from "./routes/oauth.js";

const app = new Hono<AppEnv>().basePath("/api");

// Bind config/DB/R2 to the isolate on the first request
app.use("*", async (c, next) => {
  initConfig(c.env);
  initDb(c.env);
  initR2(c.env);
  incrementRequestCount();
  await next();
});

// Global rate limit (per client IP)
app.use("*", async (c, next) => {
  const ip = c.req.header("cf-connecting-ip") ?? "unknown";
  const { success } = await c.env.GLOBAL_RATE_LIMITER.limit({ key: ip });
  if (!success) {
    throw new AppError(429, TOO_MANY_REQUESTS, "Too many requests. Please try again later.");
  }
  await next();
});

// CORS
app.use("*", (c, next) =>
  cors({
    origin: getConfig().CORS_ORIGINS,
    credentials: true,
    allowMethods: ["GET", "HEAD", "PUT", "POST", "DELETE", "PATCH"],
  })(c, next),
);

// Security headers
app.use("*", async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("X-XSS-Protection", "0");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
});

// Error handler (mirrors apps/api middleware/error-handler.ts)
app.onError((error, c) => {
  if (error instanceof AppError) {
    return c.json(
      { error: { code: error.code, message: error.message } },
      error.statusCode as 400,
    );
  }

  if (error instanceof ZodError) {
    const messages = error.issues.map((i) => i.message);
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: messages.join(", "),
          details: error.issues,
        },
      },
      400,
    );
  }

  console.error(error);
  return c.json({ error: { code: INTERNAL_ERROR, message: "Internal server error" } }, 500);
});

app.notFound((c) => c.json({ error: { code: "NOT_FOUND", message: "Route not found" } }, 404));

// Routes (same order and prefix as apps/api/src/app.ts)
app.route("/", healthRoutes);
app.route("/", authRoutes);
app.route("/", itemRoutes);
app.route("/", registerWithItemRoutes);
app.route("/", reportRoutes);
app.route("/", newsletterRoutes);
app.route("/", insuranceRoutes);
app.route("/", contactRoutes);
app.route("/", shopRoutes);
app.route("/", stickerCodesRoutes);
app.route("/", uploadRoutes);
app.route("/", adminRoutes);
app.route("/", oauthRoutes);

export default app;
