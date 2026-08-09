import { getConfig } from "../config.js";

// PBKDF2-SHA256 via WebCrypto, replacing argon2 (a native addon, unavailable
// on Workers). A server-side secret pepper is mixed into the derivation input
// to compensate for the free-plan PBKDF2 iteration cap.
//
// Stored format: pbkdf2$<iterations>$<salt-b64>$<hash-b64>
// Legacy format: $argon2id$... — never verified. Accounts that still hold one
// are refused at login and sent through password reset, which writes a PBKDF2
// hash. `isLegacyHash` and this note go away once no argon2 hash remains.

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
 * Verify a password against a stored PBKDF2 hash.
 *
 * A legacy argon2 hash can never match: callers must check `isLegacyHash`
 * first and route the account to password reset. Returning false here is
 * defence in depth, so a missed check fails closed rather than granting access.
 */
export async function verifyPassword(
  storedHash: string,
  password: string,
): Promise<boolean> {
  if (isLegacyHash(storedHash)) return false;

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
