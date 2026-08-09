import type { Bindings } from "./config.js";

// Shared Hono type environment: bindings + per-request variables set by the
// auth middleware (mirrors the Fastify request decorations in apps/api).
export type AppEnv = {
  Bindings: Bindings;
  Variables: {
    userId?: string;
    emailVerified?: boolean;
    isAdmin?: boolean;
  };
};
