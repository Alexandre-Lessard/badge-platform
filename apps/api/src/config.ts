import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default("0.0.0.0"),

  // Database
  DATABASE_URL: z.string().url("DATABASE_URL is required"),

  // JWT
  JWT_PRIVATE_KEY: z.string().min(1, "JWT_PRIVATE_KEY is required (base64-encoded Ed25519)"),
  JWT_PUBLIC_KEY: z.string().min(1, "JWT_PUBLIC_KEY is required (base64-encoded Ed25519)"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),

  // CORS
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:5173")
    .transform((s) => s.split(",")),

  // File uploads
  UPLOAD_DIR: z.string().default("./uploads"),
  MAX_FILE_SIZE: z.coerce.number().default(10 * 1024 * 1024), // 10MB

  // Email (Brevo)
  BREVO_API_KEY: z.string().optional(),
  FROM_EMAIL: z.string().email().default("noreply@badgeid.ca"),
  FROM_NAME: z.string().default("Badge"),

  // Frontend URL (for email links)
  FRONTEND_URL: z.string().url().default("http://localhost:5173"),

  // Stripe (boutique)
  // Note: STRIPE_PRICE_STICKER_SHEET is now stored in the products table
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // OAuth
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_CLIENT_ID: z.string().optional(),
  MICROSOFT_CLIENT_SECRET: z.string().optional(),
  FACEBOOK_CLIENT_ID: z.string().optional(),
  FACEBOOK_CLIENT_SECRET: z.string().optional(),

  // Cloudflare R2 (optional — upload disabled if not set)
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  R2_PUBLIC_URL: z.string().optional(),

  // Shared secret for POST /internal/verify-legacy, called by the Cloudflare
  // Worker to verify pre-migration argon2 hashes (see routes/internal.ts)
  LEGACY_VERIFY_SECRET: z.string().optional(),

  // Admin notifications
  ADMIN_ORDER_EMAIL: z.string().email().optional(),
  ADMIN_CONTACT_EMAIL: z.string().email().optional(),
});

export type Env = z.infer<typeof envSchema>;

let config: Env;

export function loadConfig(): Env {
  if (config) return config;

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error("Invalid environment variables:");
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exit(1);
  }

  config = result.data;
  return config;
}

export function getConfig(): Env {
  if (!config) {
    throw new Error("Config not loaded. Call loadConfig() first.");
  }
  return config;
}
