import { useState } from "react";
import { Link } from "react-router";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { ClientOnly } from "@/components/ClientOnly";
import { useLanguage } from "@/i18n/context";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart-context";
import { getButtonClasses } from "@/lib/button-styles";
import { ROUTES } from "@/routes/routes";

// Small badge wrapped in ClientOnly so the SSR/CSR mismatch on cartCount
// (server has [], client may have items) doesn't trigger hydration warnings.
function CartBadge({ href }: { href: string }) {
  return (
    <ClientOnly>
      <CartBadgeInner href={href} />
    </ClientOnly>
  );
}

function CartBadgeInner({ href }: { href: string }) {
  const { cartCount } = useCart();
  if (href !== ROUTES.shop || cartCount <= 0) return null;
  return (
    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--rcb-primary)] px-1 text-[10px] font-bold text-white">
      {cartCount}
    </span>
  );
}

// Auth-state UI on desktop. Wrapped in ClientOnly to prevent hydration mismatch
// (server renders "Login", client may render avatar/logout once auth is restored).
// The fallback reserves space matching the typical "Login" button width.
function AuthDesktop() {
  return (
    <ClientOnly fallback={<div aria-hidden="true" style={{ width: 96, height: 36 }} />}>
      <AuthDesktopInner />
    </ClientOnly>
  );
}

function AuthDesktopInner() {
  const { t } = useLanguage();
  const { user, logout } = useAuth();
  if (user) {
    return (
      <>
        {user.isAdmin && (
          <Link
            to={ROUTES.admin}
            className="flex h-9 items-center rounded-lg px-3 text-sm font-medium text-[var(--rcb-text-muted)] transition-colors hover:bg-[var(--rcb-border)] hover:text-[var(--rcb-primary)]"
          >
            Admin
          </Link>
        )}
        <Link to={ROUTES.dashboard} className={getButtonClasses("primary", "sm", "whitespace-nowrap text-center")}>
          {t.nav.myAccount}
        </Link>
        <button
          type="button"
          onClick={() => logout()}
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-[var(--rcb-text-muted)] transition-colors hover:bg-[var(--rcb-border)] hover:text-[var(--rcb-primary)]"
          aria-label={t.nav.logout}
        >
          <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </>
    );
  }
  return (
    <Link to={ROUTES.login} className={getButtonClasses("primary", "sm", "whitespace-nowrap text-center")}>
      {t.nav.login}
    </Link>
  );
}

// Auth-state UI inside the mobile menu. Same hydration concerns.
function AuthMobile({ onNav }: { onNav: () => void }) {
  return (
    <ClientOnly>
      <AuthMobileInner onNav={onNav} />
    </ClientOnly>
  );
}

function AuthMobileInner({ onNav }: { onNav: () => void }) {
  const { t } = useLanguage();
  const { user, logout } = useAuth();
  if (user) {
    return (
      <>
        {user.isAdmin && (
          <Link to={ROUTES.admin} onClick={onNav} className={getButtonClasses("outline", "sm", "w-full")}>
            Admin
          </Link>
        )}
        <Link to={ROUTES.dashboard} onClick={onNav} className={getButtonClasses("primary", "sm", "w-full")}>
          {t.nav.myAccount}
        </Link>
        <button
          type="button"
          onClick={() => {
            logout();
            onNav();
          }}
          className="cursor-pointer rounded-lg px-4 py-2 text-sm font-medium text-[var(--rcb-text-muted)] transition-colors hover:text-[var(--rcb-primary)]"
        >
          {t.nav.logout}
        </button>
      </>
    );
  }
  return (
    <Link to={ROUTES.login} onClick={onNav} className={getButtonClasses("primary", "sm", "w-full")}>
      {t.nav.login}
    </Link>
  );
}

export function Navbar() {
  const { t } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-[var(--rcb-header)]/95 backdrop-blur">
      <div className="section-shell flex min-h-20 items-center justify-between gap-6 py-3">
        <Link to="/" className="shrink-0">
          <img src="/assets/logo.png" alt={t.a11y.logoAlt} className="h-10" />
        </Link>

        <nav aria-label={t.a11y.mainNav} className="hidden items-center gap-9 text-base font-medium text-[var(--rcb-text-strong)] lg:flex">
          {t.nav.items.map((item) => (
            <Link
              key={item.label}
              to={item.href}
              className="relative flex items-center justify-center gap-1 min-w-[4rem] transition-colors hover:text-[var(--rcb-primary)]"
            >
              {item.label}
              <CartBadge href={item.href} />
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <LanguageSwitcher />
          <AuthDesktop />
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((prev) => !prev)}
          className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-[var(--rcb-text-strong)] transition-colors hover:bg-[var(--rcb-border)] lg:hidden"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {menuOpen ? (
              <>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </>
            ) : (
              <>
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </>
            )}
          </svg>
        </button>
      </div>

      {menuOpen && (
        <nav
          aria-label={t.a11y.mobileNav}
          className="border-t border-[var(--rcb-border)] bg-[var(--rcb-header)] lg:hidden"
        >
          <div className="section-shell flex flex-col gap-1 py-4">
            {t.nav.items.map((item) => (
              <Link
                key={item.label}
                to={item.href}
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 rounded-lg px-4 py-3 text-base font-medium text-[var(--rcb-text-strong)] transition-colors hover:bg-[var(--rcb-border)]"
              >
                {item.label}
                <CartBadge href={item.href} />
              </Link>
            ))}
            <div className="mt-2 border-t border-[var(--rcb-border)] pt-4">
              <div className="flex items-center px-4">
                <LanguageSwitcher />
              </div>
              <div className="mt-4 flex flex-col gap-2 px-4">
                <AuthMobile onNav={() => setMenuOpen(false)} />
              </div>
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
