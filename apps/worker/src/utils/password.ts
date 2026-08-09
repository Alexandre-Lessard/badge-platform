import { getConfig } from "../config.js";

// PBKDF2-SHA256 via WebCrypto, replacing argon2 (a native addon, unavailable
// on Workers). A server-side secret pepper is mixed into the derivation input
// to compensate for the free-plan PBKDF2 iteration cap.
//
// Stored format: pbkdf2$<iterations>$<salt-b64>$<hash-b64>
// Legacy format: $argon2id$... — verified remotely on the old prod server
// (LEGACY_VERIFY_URL) until every account has logged in once and been
// re-hashed to PBKDF2.

const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const KEY_BYTES = 32;

function b64encode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function b64decode(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

async function derive(
  password: string,
  pepper: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`${password}${pepper}`),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    keyMaterial,
    KEY_BYTES * 8,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const config = getConfig();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(password, config.PASSWORD_PEPPER, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${b64encode(salt)}$${b64encode(hash)}`;
}

export function isLegacyHash(storedHash: string): boolean {
  return storedHash.startsWith("$argon2");
}

/**
 * Verify a password against a stored hash. Handles both formats:
 * - pbkdf2$... → local WebCrypto verification
 * - $argon2... → remote verification on the legacy server (network I/O, which
 *   does not count against the Worker's CPU budget)
 */
export async function verifyPassword(
  storedHash: string,
  password: string,
): Promise<boolean> {
  if (isLegacyHash(storedHash)) {
    return verifyLegacyPassword(storedHash, password);
  }

  const config = getConfig();
  const parts = storedHash.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;

  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations < 1) return false;

  const salt = b64decode(parts[2]);
  const expected = b64decode(parts[3]);
  const actual = await derive(password, config.PASSWORD_PEPPER, salt, iterations);
  if (actual.length !== expected.length) return false;

  // Constant-time comparison
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i]! ^ expected[i]!;
  return diff === 0;
}

async function verifyLegacyPassword(
  storedHash: string,
  password: string,
): Promise<boolean> {
  const config = getConfig();
  if (!config.LEGACY_VERIFY_URL || !config.LEGACY_VERIFY_SECRET) {
    console.error("Legacy argon2 hash encountered but LEGACY_VERIFY_URL is not configured");
    return false;
  }

  const res = await fetch(config.LEGACY_VERIFY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.LEGACY_VERIFY_SECRET}`,
    },
    body: JSON.stringify({ hash: storedHash, password }),
  });

  if (!res.ok) {
    console.error(`Legacy verify endpoint returned ${res.status}`);
    return false;
  }

  const data = (await res.json()) as { valid?: boolean };
  return data.valid === true;
}
