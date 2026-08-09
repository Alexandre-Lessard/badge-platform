import { eq } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { users } from "../db/schema.js";

/**
 * Generate a random 9-digit client number (100000000–999999999).
 * Checks uniqueness in DB with retry (max 10 attempts).
 * Accepts a db/tx object to work within a transaction.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function generateClientNumber(conn?: any): Promise<string> {
  const db = conn ?? getDb();
  const MAX_ATTEMPTS = 10;

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const num = String(
      100_000_000 + Math.floor(Math.random() * 900_000_000),
    );

    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clientNumber, num))
      .limit(1);

    if (!existing) return num;
  }

  throw new Error("Failed to generate a unique client number");
}
