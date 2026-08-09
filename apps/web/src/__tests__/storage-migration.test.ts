import { describe, it, expect, beforeEach } from "vitest";
import { migrateLegacyStorageKeys } from "@/lib/storage-migration";

describe("migrateLegacyStorageKeys", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("keeps a signed-in user signed in", () => {
    sessionStorage.setItem("rnbp_refresh_token", "token-abc");

    migrateLegacyStorageKeys();

    expect(sessionStorage.getItem("badge_refresh_token")).toBe("token-abc");
    expect(sessionStorage.getItem("rnbp_refresh_token")).toBeNull();
  });

  it("carries the cart and the other keys over", () => {
    localStorage.setItem("rnbp_cart_v2", '[{"productSlug":"sticker-sheet"}]');
    localStorage.setItem("rnbp-promo-dismissed", "1");
    localStorage.setItem("rnbp_registration_draft", '{"name":"Vélo"}');

    migrateLegacyStorageKeys();

    expect(localStorage.getItem("badge_cart_v2")).toBe('[{"productSlug":"sticker-sheet"}]');
    expect(localStorage.getItem("badge-promo-dismissed")).toBe("1");
    expect(localStorage.getItem("badge_registration_draft")).toBe('{"name":"Vélo"}');
    expect(localStorage.getItem("rnbp_cart_v2")).toBeNull();
  });

  it("does not clobber a value written since the rename", () => {
    localStorage.setItem("rnbp_cart_v2", "stale");
    localStorage.setItem("badge_cart_v2", "current");

    migrateLegacyStorageKeys();

    expect(localStorage.getItem("badge_cart_v2")).toBe("current");
    expect(localStorage.getItem("rnbp_cart_v2")).toBeNull();
  });

  it("is a no-op when there is nothing to migrate", () => {
    migrateLegacyStorageKeys();

    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
});
