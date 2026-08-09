import { z } from "zod";

// Worker bindings (wrangler.jsonc) + secrets (wrangler secret put).
export type Bindings = {
  DB: D1Database;
  UPLOADS: R2Bucket;
  GLOBAL_RATE_LIMITER: RateLimit;
  AUTH_RATE_LIMITER: RateLimit;
} & Record<string, unknown>;

export const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "staging", "production", "test"])
    .default("staging"),

  // JWT (secrets)
  JWT_PRIVATE_KEY: z.string().min(1, "JWT_PRIVATE_KEY is required (base64-encoded Ed25519)"),
  JWT_PUBLIC_KEY: z.string().min(1, "JWT_PUBLIC_KEY is required (base64-encoded Ed25519)"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),

  // Password hashing (secret) — server-side pepper mixed into the PBKDF2 input
  PASSWORD_PEPPER: z.string().min(1, "PASSWORD_PEPPER is required"),

  // Legacy argon2 verification (old prod server behind the Tunnel).
  // Optional: when unset, argon2 hashes can no longer be verified.
  LEGACY_VERIFY_URL: z.string().url().optional(),
  LEGACY_VERIFY_SECRET: z.string().optional(),

  // CORS
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:5173")
    .transform((s) => s.split(",")),

  // File uploads
  MAX_FILE_SIZE: z.coerce.number().default(10 * 1024 * 1024), // 10MB

  // Email (Brevo)
  BREVO_API_KEY: z.string().optional(),
  FROM_EMAIL: z.string().email().default("noreply@badgeid.ca"),
  FROM_NAME: z.string().default("Badge"),

  // Frontend URL (for email links)
  FRONTEND_URL: z.string().url().default("http://localhost:5173"),

  // Stripe (boutique)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // OAuth
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_CLIENT_ID: z.string().optional(),
  MICROSOFT_CLIENT_SECRET: z.string().optional(),
  FACEBOOK_CLIENT_ID: z.string().optional(),
  FACEBOOK_CLIENT_SECRET: z.string().optional(),

  // Public base URL for files served from the R2 bucket
  R2_PUBLIC_URL: z.string().optional(),

  // Admin notifications
  ADMIN_ORDER_EMAIL: z.string().email().optional(),
  ADMIN_CONTACT_EMAIL: z.string().email().optional(),
});

export type Env = z.infer<typeof envSchema>;

// Bindings are identical for every request an isolate serves, so the parsed
// config is cached at module scope — same access pattern as apps/api.
let config: Env;

export function initConfig(env: Bindings): Env {
  if (!config) {
    config = envSchema.parse(env);
  }
  return config;
}

export function getConfig(): Env {
  if (!config) {
    throw new Error("Config not initialized — initConfig(env) must run first");
  }
  return config;
}
