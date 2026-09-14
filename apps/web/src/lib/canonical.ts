// Shared by the Pages Function (functions/[[path]].ts) and root.tsx, so the
// canonical in the served HTML and the one React renders in the browser are
// the same string. Keep it dependency-free: the Function imports it by relative
// path and is bundled by wrangler, outside the Vite build.

export const BRAND_ORIGIN = "https://badgeid.ca";

/** Drops the trailing slash, except on the root which has no other form. */
export function normalizePath(pathname: string): string {
  return pathname === "/" ? "/" : pathname.replace(/\/$/, "");
}

/**
 * Canonical URLs carry no trailing slash: every internal link comes from
 * ROUTES ("/faq", "/shop"), so the slashed form is a URL nothing links to.
 * Declaring it as canonical is what made Google pick its own instead.
 */
export function canonicalUrl(pathname: string): string {
  return `${BRAND_ORIGIN}${normalizePath(pathname)}`;
}
