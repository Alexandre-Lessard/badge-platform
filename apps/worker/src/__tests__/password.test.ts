import { describe, it, expect, beforeAll, vi, afterEach } from "vitest";
import { initConfig, type Bindings } from "../config.js";
import { hashPassword, verifyPassword, isLegacyHash } from "../utils/password.js";

const LEGACY_HASH = "$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQ$aGFzaGVkdmFsdWU";

beforeAll(() => {
  initConfig({
    JWT_PRIVATE_KEY: "dGVzdC1wcml2YXRlLWtleQ==",
    JWT_PUBLIC_KEY: "dGVzdC1wdWJsaWMta2V5",
    PASSWORD_PEPPER: "test-pepper",
    NODE_ENV: "test",
  } as unknown as Bindings);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("hashPassword / verifyPassword", () => {
  it("round-trip: hash then verify returns true", async () => {
    const hash = await hashPassword("MyP@ssw0rd!");
    expect(await verifyPassword(hash, "MyP@ssw0rd!")).toBe(true);
  });

  it("rejects wrong password", async () => {
    const hash = await hashPassword("MyP@ssw0rd!");
    expect(await verifyPassword(hash, "WrongPassword")).toBe(false);
  });

  it("produces different hashes for same input (salted)", async () => {
    expect(await hashPassword("SamePassword")).not.toBe(await hashPassword("SamePassword"));
  });

  it("rejects a malformed stored hash instead of throwing", async () => {
    expect(await verifyPassword("not-a-hash", "whatever")).toBe(false);
  });
});

describe("legacy argon2 hashes", () => {
  it("recognizes the argon2 prefix", () => {
    expect(isLegacyHash(LEGACY_HASH)).toBe(true);
    expect(isLegacyHash("pbkdf2$100000$c2FsdA==$aGFzaA==")).toBe(false);
  });

  // The login route refuses a legacy hash before it ever reaches verifyPassword
  // and sends the account to password reset. These two guard the fallback: if
  // that check is ever removed, verification must fail closed rather than call
  // out to a server that no longer exists.
  it("never verifies a legacy hash, whatever the password", async () => {
    expect(await verifyPassword(LEGACY_HASH, "correct")).toBe(false);
    expect(await verifyPassword(LEGACY_HASH, "")).toBe(false);
  });

  it("makes no network call for a legacy hash", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    await verifyPassword(LEGACY_HASH, "correct");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
