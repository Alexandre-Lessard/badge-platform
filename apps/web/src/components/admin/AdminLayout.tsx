import { useState } from "react";
import { Link, useLocation } from "react-router";
import { useLanguage } from "@/i18n/context";
import { ROUTES } from "@/routes/routes";

type NavLink = {
  label: string;
  href: string;
  icon: React.ReactNode;
};

function DashboardIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function ItemsIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  );
}

function ClientsIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function OrdersIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M9 14l2 2 4-4" />
    </svg>
  );
}

function ProductsIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 17l-5-5 5-5" />
      <path d="M18 17l-5-5 5-5" />
    </svg>
  );
}

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { t, locale } = useLanguage();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const admin = t.admin;

  const navLinks: NavLink[] = [
    { label: admin?.nav.dashboard ?? "Dashboard", href: ROUTES.admin, icon: <DashboardIcon /> },
    { label: admin?.nav.items ?? "Items", href: ROUTES.adminItems, icon: <ItemsIcon /> },
    { label: admin?.nav.clients ?? "Clients", href: ROUTES.adminClients, icon: <ClientsIcon /> },
    { label: admin?.nav.orders ?? "Orders", href: ROUTES.adminOrders, icon: <OrdersIcon /> },
    { label: admin?.nav.products ?? "Products", href: ROUTES.adminProducts, icon: <ProductsIcon /> },
  ];

  function isActive(href: string) {
    if (href === ROUTES.admin) {
      return location.pathname === ROUTES.admin;
    }
    return location.pathname.startsWith(href);
  }

  const sidebarWidth = collapsed ? "w-[64px]" : "w-[240px]";

  return (
    <div className="flex min-h-[calc(100vh-80px)]">
      {/* Desktop sidebar */}
      <aside className={`hidden ${sidebarWidth} shrink-0 flex-col border-r border-white/10 bg-[var(--rcb-text-strong)] transition-all duration-200 lg:flex`}>
        <nav className="mt-4 flex flex-1 flex-col gap-1 px-2">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              title={collapsed ? link.label : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                collapsed ? "justify-center" : ""
              } ${
                isActive(link.href)
                  ? "bg-white/15 text-white shadow-sm"
                  : "text-white/60 hover:bg-white/8 hover:text-white/90"
              }`}
            >
              {link.icon}
              {!collapsed && <span>{link.label}</span>}
            </Link>
          ))}
        </nav>

        <div className="border-t border-white/10 px-2 py-3">
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className={`flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-white/40 transition-colors hover:text-white/70 ${collapsed ? "justify-center" : ""}`}
            title={collapsed ? "Expand" : "Collapse"}
          >
            <CollapseIcon collapsed={collapsed} />
            {!collapsed && <span>{locale === "en" ? "Collapse" : "Réduire"}</span>}
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-[80px] z-40 flex h-14 items-center justify-between border-b border-[var(--rcb-border)] bg-[var(--rcb-text-strong)] px-4 lg:hidden">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="cursor-pointer rounded-lg p-1.5 text-white/80 transition-colors hover:bg-white/10"
            aria-label={sidebarOpen ? "Close menu" : "Open menu"}
          >
            {sidebarOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
          <span className="text-sm font-semibold text-white">Admin</span>
        </div>

        <nav className="flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              onClick={() => setSidebarOpen(false)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                isActive(link.href)
                  ? "bg-white/15 text-white"
                  : "text-white/60 hover:text-white/90"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 z-30 bg-black/50 lg:hidden"
            style={{ top: "calc(80px + 56px)" }}
            onClick={() => setSidebarOpen(false)}
          />
          <div
            className="fixed inset-y-0 left-0 z-40 w-[240px] bg-[var(--rcb-text-strong)] pt-4 lg:hidden"
            style={{ top: "calc(80px + 56px)" }}
          >
            <nav className="flex flex-col gap-1 px-3">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                    isActive(link.href)
                      ? "bg-white/15 text-white shadow-sm"
                      : "text-white/60 hover:bg-white/8 hover:text-white/90"
                  }`}
                >
                  {link.icon}
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </>
      )}

      {/* Main content */}
      <div className="flex-1 overflow-x-hidden bg-[#f8f9fb] pt-14 lg:pt-0">
        {children}
      </div>
    </div>
  );
}
