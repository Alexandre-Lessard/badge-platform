import { drizzle } from "drizzle-orm/d1";
import type { Bindings } from "../config.js";
import * as schema from "./schema.js";

// Like the config, the D1 binding is stable for every request an isolate
// serves, so the drizzle instance is cached at module scope.
let db: ReturnType<typeof createDb>;

function createDb(d1: D1Database) {
  return drizzle(d1, { schema });
}

export function initDb(env: Bindings) {
  if (!db) {
    db = createDb(env.DB);
  }
  return db;
}

export function getDb() {
  if (!db) {
    throw new Error("Database not initialized — initDb(env) must run first");
  }
  return db;
}

export type Db = ReturnType<typeof createDb>;
