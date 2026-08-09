// One-time rename of browser-storage keys from the RNBP era to the Badge one.
//
// Renaming the keys outright would sign every logged-in user out and empty
// their cart, so each old key is copied to its new name and then removed.
// Runs at module load, before AuthProvider or CartProvider read anything.
//
// Safe to delete after 2026-11-09: by then any session that predates the
// rename has expired anyway (refresh tokens live 7 days).

const RENAMES: { storage: "local" | "session"; from: string; to: string }[] = [
  { storage: "session", from: "rnbp_refresh_token", to: "badge_refresh_token" },
  { storage: "local", from: "rnbp_cart_v2", to: "badge_cart_v2" },
  { storage: "local", from: "rnbp_cart", to: "badge_cart" },
  { storage: "local", from: "rnbp-promo-dismissed", to: "badge-promo-dismissed" },
  { storage: "local", from: "rnbp_registration_draft", to: "badge_registration_draft" },
];

export function migrateLegacyStorageKeys(): void {
  if (typeof window === "undefined") return;

  for (const { storage, from, to } of RENAMES) {
    try {
      const store = storage === "local" ? window.localStorage : window.sessionStorage;
      const value = store.getItem(from);
      if (value === null) continue;

      // A value already under the new name wins — the user has used the app
      // since the rename, so the old entry is stale.
      if (store.getItem(to) === null) {
        store.setItem(to, value);
      }
      store.removeItem(from);
    } catch {
      // Private mode, disabled storage, quota — nothing here is worth failing over
    }
  }
}

migrateLegacyStorageKeys();
