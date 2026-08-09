import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import type { AppEnv } from "../context.js";

export const healthRoutes = new Hono<AppEnv>();

healthRoutes.get("/health", async (c) => {
  const checks: Record<string, string> = {};

  // Database check
  try {
    await getDb().run(sql`SELECT 1`);
    checks.database = "ok";
  } catch {
    checks.database = "error";
  }

  const healthy = Object.values(checks).every((v) => v === "ok");

  return c.json(
    {
      status: healthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      checks,
    },
    healthy ? 200 : 503,
  );
});
