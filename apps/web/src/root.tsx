import { Links, Meta, Outlet, Scripts, ScrollRestoration, useLocation } from "react-router";
import { canonicalUrl } from "@/lib/canonical";
import { ErrorBoundary as AppErrorBoundary } from "@/components/ErrorBoundary";
import { ScrollToTop } from "@/components/ScrollToTop";
import { LanguageProvider } from "@/i18n/context";
// Must precede the providers below: it renames the RNBP-era storage keys
// before AuthProvider and CartProvider read them.
import "@/lib/storage-migration";
import { AuthProvider } from "@/lib/auth-context";
import { CartProvider } from "@/lib/cart-context";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { PromoBanner } from "@/components/layout/PromoBanner";
import { CookieConsent } from "@/components/ui/CookieConsent";
import { PixelTracker } from "@/components/PixelTracker";
import "./index.css";

// eslint-disable-next-line react-refresh/only-export-components
export const links = () => [
  { rel: "icon", href: "/favicon.ico" },
  { rel: "icon", type: "image/png", href: "/favicon.png" },
  // W3C standard rel for declaring the privacy policy URL of a site.
  // Recognized by Google and Meta OAuth verifiers as an explicit signal
  // independent of the visible DOM.
  { rel: "privacy-policy", href: "https://badgeid.ca/privacy" },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700;900&display=swap",
  },
];

export default function Root() {
  const { pathname } = useLocation();
  const prerendering = typeof window === "undefined";
  const canonical = prerendering ? null : canonicalUrl(pathname);

  return (
    <html lang="{{LANG}}">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />

        {/*
          {{...}} placeholders are consumed by the Cloudflare Pages Function at
          request time (functions/[[path]].ts → injectMeta). React 19 hoists per-page
          <title> and <meta name="description"> set in route components, so those
          are not here.

          React 19 never reconciles <meta>/<link> with the served HTML: it looks for
          an element with identical attributes and inserts its own when none
          matches. Rendering the placeholders in the browser therefore added a
          second copy of each tag carrying the raw placeholder, and Google followed
          href="{{CANONICAL}}" as a link (404s in Search Console). So:
          - the tags crawlers read without running JS are prerender-only;
          - canonical and hreflang, which Google reads from the rendered page, are
            computed in the browser with the same rule as the Function, so React
            matches the served tag instead of adding one — and still renders the
            right value when a failed hydration makes it rebuild the document.
        */}
        {prerendering && (
          <>
            <meta name="robots" content="{{ROBOTS}}" />
            <meta property="og:type" content="website" />
            <meta property="og:locale" content="{{OG_LOCALE}}" />
            <meta property="og:locale:alternate" content="{{OG_LOCALE_ALT}}" />
            <meta property="og:site_name" content="{{SITE_NAME}}" />
            <meta property="og:url" content="{{OG_URL}}" />
            <meta property="og:image" content="{{OG_IMAGE}}" />
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:image" content="{{OG_IMAGE}}" />
          </>
        )}
        <link rel="canonical" href={canonical ?? "{{CANONICAL}}"} />
        <link rel="alternate" hrefLang="fr" href={canonical ?? "{{HREFLANG_FR}}"} />
        <link rel="alternate" hrefLang="en" href={canonical ?? "{{HREFLANG_EN}}"} />
        <link rel="alternate" hrefLang="x-default" href={canonical ?? "{{HREFLANG_FR}}"} />
        {/* JSON-LD {{JSON_LD}} */}

        <Meta />
        <Links />
      </head>
      <body suppressHydrationWarning>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded focus:bg-[var(--rcb-primary)] focus:px-4 focus:py-2 focus:text-white"
        >
          Skip to content
        </a>
        <AppErrorBoundary>
          <LanguageProvider>
            <AuthProvider>
              <CartProvider>
                <ScrollToTop />
                <div className="min-h-screen">
                  <Navbar />
                  <PromoBanner />
                  <main id="main-content">
                    <Outlet />
                  </main>
                  <Footer />
                </div>
                <PixelTracker />
                <CookieConsent />
              </CartProvider>
            </AuthProvider>
          </LanguageProvider>
        </AppErrorBoundary>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
