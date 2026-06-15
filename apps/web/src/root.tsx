import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import { ErrorBoundary as AppErrorBoundary } from "@/components/ErrorBoundary";
import { ScrollToTop } from "@/components/ScrollToTop";
import { LanguageProvider } from "@/i18n/context";
import { AuthProvider } from "@/lib/auth-context";
import { CartProvider } from "@/lib/cart-context";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { PromoBanner } from "@/components/layout/PromoBanner";
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
  return (
    <html lang="{{LANG}}">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />

        {/*
          OG/Twitter/canonical tags with {{...}} placeholders consumed by the
          Cloudflare Pages Function at request time (functions/[[path]].ts →
          injectMeta). React 19 hoists per-page <title> and <meta name="description">
          set in route components directly into <head>, so we don't ship those here.
        */}
        <meta name="robots" content="{{ROBOTS}}" />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="{{OG_LOCALE}}" />
        <meta property="og:locale:alternate" content="{{OG_LOCALE_ALT}}" />
        <meta property="og:site_name" content="{{SITE_NAME}}" />
        <meta property="og:url" content="{{OG_URL}}" />
        <meta property="og:image" content="{{OG_IMAGE}}" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content="{{OG_IMAGE}}" />
        <link rel="canonical" href="{{CANONICAL}}" />
        <link rel="alternate" hrefLang="fr" href="{{HREFLANG_FR}}" />
        <link rel="alternate" hrefLang="en" href="{{HREFLANG_EN}}" />
        <link rel="alternate" hrefLang="x-default" href="{{HREFLANG_FR}}" />
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
