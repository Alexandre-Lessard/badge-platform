# @rnbp/web — Frontend

React web application for the National Registry of Personal Property.

## Stack

React 19, Vite 6, Tailwind CSS 4, React Router 7 (framework mode).

The home page (`/`) is prerendered at build time so crawlers and OAuth verifiers see a fully rendered HTML document. All other routes are served via the prerendered SPA shell and hydrated on the client.

## Local setup

```bash
# Optional: configure the API URL
# Default: http://localhost:8787/api
echo "VITE_API_URL=http://localhost:8787/api" > .env

# Start in dev mode
pnpm dev
```

Available at `http://localhost:5173`.

## Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start the React Router dev server (HMR). |
| `pnpm build` | Type-check (`tsc -b --noEmit`) then run `react-router build`. Output goes to `build/client/`. |
| `pnpm preview` | Serve the production build locally with `vite preview --outDir build/client`. |
| `pnpm lint` | ESLint. |
| `pnpm test` | Vitest (uses a separate `vitest.config.ts` to bypass the `@react-router/dev` Vite plugin). |
| `pnpm deploy` | Build then `wrangler pages deploy build/client`. |

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:8787/api` | Backend API URL |

## Routes

Routes are declared in [`src/routes.ts`](src/routes.ts) using the React Router framework-mode DSL (`index`, `route`, `layout`).

### Public

| Path | Module | Description |
|------|--------|-------------|
| `/` | `pages/LandingPage.tsx` | Home page (prerendered) |
| `/login` | `pages/LoginPage.tsx` | Login |
| `/register` | `pages/RegisterAccountPage.tsx` | Account creation |
| `/register-item` | `pages/RegisterItemPage.tsx` | Item registration (multi-step form) |
| `/lookup` | `pages/LookupPage.tsx` | Public lookup by RNBP number or serial number |
| `/lookup/photo` | `pages/LookupPhotoPage.tsx` | Photo-based lookup placeholder |
| `/registry` | `pages/PartnerPage.tsx` | Browse the registry (citizen / police / insurance) |
| `/privacy` | `pages/PrivacyPolicyPage.tsx` | Privacy policy |
| `/terms` | `pages/TermsOfServicePage.tsx` | Terms of service |
| `/data-deletion` | `pages/DataDeletionPage.tsx` | Data deletion policy and process |
| `/faq` | `pages/FaqPage.tsx` | Frequently asked questions |
| `/contact` | `pages/ContactPage.tsx` | Contact form |
| `/about` | `pages/AboutPage.tsx` | About |
| `/shop` | `pages/BoutiquePage.tsx` | Store |
| `/shop/success` | `pages/BoutiqueSuccessPage.tsx` | Post-purchase confirmation |
| `/verify-email` | `pages/VerifyEmailPage.tsx` | Email verification |
| `/email-pending` | `pages/EmailPendingPage.tsx` | Pending email verification |
| `/auth/{google,facebook,microsoft}/callback` | `pages/OAuthCallbackPage.tsx` | OAuth callbacks (3 routes share one module via distinct route IDs) |

### Protected (`layouts/protected.tsx`)

| Path | Module |
|------|--------|
| `/dashboard` | `pages/DashboardPage.tsx` |
| `/profile` | `pages/ProfilePage.tsx` |
| `/settings` | `pages/SettingsPage.tsx` |
| `/items/:id` | `pages/ItemDetailPage.tsx` |
| `/edit/:id` | `pages/EditItemPage.tsx` |
| `/report-theft` | `pages/ReportTheftPage.tsx` |

### Admin (`layouts/admin.tsx`)

| Path | Module |
|------|--------|
| `/admin` | `pages/AdminDashboardPage.tsx` |
| `/admin/items` | `pages/AdminItemsPage.tsx` |
| `/admin/orders` | `pages/AdminOrdersPage.tsx` |
| `/admin/orders/:id` | `pages/AdminOrderDetailPage.tsx` |
| `/admin/products` | `pages/AdminProductsPage.tsx` |
| `/admin/products/:id` | `pages/AdminProductEditPage.tsx` |

### Legacy FR redirects

The previous FR-only paths (`/connexion`, `/inscription`, `/enregistrer`, …) are served as `301` redirects via [`public/_redirects`](public/_redirects). They will be removed after July 2026.

## Structure

```
apps/web/
├── react-router.config.ts   # ssr: false, appDirectory: "src", prerender: ["/"]
├── vite.config.ts           # @react-router/dev/vite + Tailwind
├── vitest.config.ts         # separate config for tests (uses @vitejs/plugin-react)
├── public/
│   ├── _redirects           # FR legacy redirects + SPA fallback
│   └── _routes.json
├── functions/
│   └── [[path]].ts          # Cloudflare Pages Function: per-route meta + locale + sitemap
├── src/assets/              # Bundled static assets (e.g. insurer logos)
└── src/
    ├── root.tsx             # HTML shell, providers, <Outlet />
    ├── routes.ts            # Route table (layouts + index + routes)
    ├── layouts/
    │   ├── protected.tsx    # <ProtectedRoute><Outlet /></ProtectedRoute>
    │   └── admin.tsx        # <AdminRoute><AdminLayout><Outlet /></AdminLayout></AdminRoute>
    ├── pages/               # One default-exported component per route
    ├── components/
    │   ├── ClientOnly.tsx   # Hydration-safe wrapper for browser-state UI
    │   ├── ScrollToTop.tsx  # Smooth-scroll to anchors / top on route change
    │   ├── ErrorBoundary.tsx
    │   ├── auth/            # ProtectedRoute, AdminRoute, ServiceUnavailable
    │   ├── layout/          # Navbar, Footer, PromoBanner, AccountNav
    │   ├── sections/        # Landing-page sections
    │   ├── registration/    # Registration form steps
    │   ├── ui/              # Button, Tabs, Modal, LanguageSwitcher, ItemImage
    │   └── icons/           # SVG icons
    ├── i18n/
    │   ├── context.tsx      # Language provider + detection
    │   └── locales/         # FR and EN translations
    ├── lib/
    │   ├── api-client.ts
    │   ├── auth-context.tsx
    │   ├── cart-context.tsx
    │   ├── register-item.ts
    │   ├── oauth.ts
    │   ├── useObjectUrls.ts
    │   └── button-styles.ts
    ├── routes/              # ROUTES constant (path map shared across the app)
    ├── types/               # TypeScript types (SiteContent)
    └── index.css            # CSS variables + global styles
```

## Prerendering and SSR safety

`/` is rendered to static HTML at build time. The full provider tree (`LanguageProvider`, `AuthProvider`, `CartProvider`) plus `Navbar`, `PromoBanner`, `Footer` and `LandingPage` execute on Node during the build, so any code reached during render must be SSR-safe:

- Browser-only APIs (`window`, `document`, `localStorage`, `sessionStorage`, `navigator`) are guarded with `typeof window === "undefined"` checks (see `i18n/context.tsx`, `lib/auth-context.tsx`, `components/layout/PromoBanner.tsx`, `components/ErrorBoundary.tsx`).
- UI that depends on browser state (auth status, cart count, dismissed banner, current year) is wrapped in `<ClientOnly fallback={…}>`. Provide a fallback with the same dimensions as the rendered content to avoid layout shift after hydration.

## Page meta tags

Page titles and descriptions use React 19's native `<title>` and `<meta>` hoisting — no third-party head manager. Each page renders a `<title>` (and optionally a `<meta name="description">`) in its JSX:

```tsx
export function MyPage() {
  const { t } = useLanguage();
  return (
    <section>
      <title>{`${t.pages.my.title} | RNBP`}</title>
      <meta name="description" content={t.pages.my.description} />
      ...
    </section>
  );
}
```

For the SPA-fallback HTML served on non-prerendered routes, the Cloudflare Pages Function ([`functions/[[path]].ts`](functions/[[path]].ts)) injects the per-route `<title>`, `<meta name="description">`, Open Graph, Twitter, canonical, hreflang and JSON-LD tags at request time, based on the requested path and the active domain (`rnbp.ca` / `nrpp.ca`). The title and description are routed through `{{TITLE}}` / `{{DESCRIPTION}}` placeholders injected at build time by [`scripts/build-multilocale.mjs`](scripts/build-multilocale.mjs), since React 19 hoists the home page's title into the prerendered HTML that serves as the SPA fallback.

## i18n system

The application is bilingual (FR / EN). Translations cover all static content, including the privacy policy and terms of service.

### How to add translations

1. Add the key to the `SiteContent` type (`src/types/content.ts`)
2. Add the translation in `src/i18n/locales/fr.ts`
3. Add the translation in `src/i18n/locales/en.ts`
4. Use in a component: `const { t } = useLanguage();`

### Language detection

Priority order:
1. **localStorage** — Explicit user choice
2. **Hostname** — `rnbp.ca` → FR, `nrpp.ca` → EN
3. **Browser** — `navigator.language`
4. **Default** — FR (used during build-time prerendering)

The language toggle is instant (no reload, no domain change).

## Dual-domain strategy

| Domain | Default language | Usage |
|--------|-----------------|-------|
| `rnbp.ca` | French | Quebec market |
| `nrpp.ca` | English | English-speaking Canadian market |

Both domains serve the same application. The logo follows the active language (not the domain). The Cloudflare Pages Function emits per-domain `hreflang` and canonical tags so each domain is indexed in the correct language.

## Design system

### CSS variables (`--rcb-*`)

```css
--rcb-primary: #D80621        /* Primary red */
--rcb-primary-dark: #8b0415   /* Dark red (hover) */
--rcb-navy: #232b37           /* Navy blue (strong text) */
--rcb-surface: #f5f5f5        /* Light gray background */
--rcb-text-body: #555555      /* Body text (WCAG AA) */
--rcb-text-muted: #666666     /* Secondary text (WCAG AA) */
```

### Button component

```tsx
import { Button } from "@/components/ui/Button";

<Button variant="primary" size="lg">Register</Button>
<Button variant="outline" size="sm">Cancel</Button>
```

Variants: `primary` (red), `outline` (border).
Sizes: `sm`, `lg` (default).

### Tabs component

```tsx
import { Tabs, type TabItem } from "@/components/ui/Tabs";

const tabs: TabItem<"citizen" | "police" | "insurer">[] = [
  { key: "citizen", label: "Citizens" },
  { key: "police", label: "Police services" },
  { key: "insurer", label: "Insurance companies" },
];

<Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} tabMinWidth={215}>
  {/* active tab content */}
</Tabs>
```

Generic (`<T extends string>`), full ARIA support (`role="tablist"`, `aria-selected`).
`tabMinWidth` prop for fixed bilingual width (see convention below).

### Modal component

```tsx
import { Modal } from "@/components/ui/Modal";

<Modal open={isOpen} onClose={() => setIsOpen(false)} title="Title">
  {/* content */}
</Modal>
```

Closes on Escape or overlay click. Body scroll is locked when open. Auto-focuses the first field on open.

### Fixed width FR/EN convention

Bilingual interactive elements (buttons, tabs, button-styled links) must have a fixed width based on the longest language (usually French). Apply via `style={{ minWidth: Xpx }}` or `tabMinWidth` on `<Tabs>`. This prevents the UI from "jumping" when switching languages.

### For `<a>` or `<Link>` styled as buttons

```tsx
import { getButtonClasses } from "@/lib/button-styles";

<Link to="/register" className={getButtonClasses("primary", "lg")}>
  Sign up
</Link>
```
