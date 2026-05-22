import { Link } from "react-router";
import { useLanguage } from "@/i18n/context";
import { ROUTES } from "@/routes/routes";

type PromoCalloutProps = {
  variant: "dashboard" | "item" | "registration";
  /** Pass the user's items to check if they already ordered stickers */
  items?: { badgeCode?: string | null }[];
};

export function PromoCallout({ variant, items }: PromoCalloutProps) {
  const { t } = useLanguage();
  const promo = t.promo;

  if (!promo) return null;

  // Hide if user already has at least one item with an Badge code
  if (items?.some((item) => item.badgeCode)) return null;

  const texts = {
    dashboard: promo.calloutDashboard ?? "Your items are not yet physically protected. Take advantage of the free offer!",
    item: promo.calloutItem ?? "This item doesn't have an Badge code yet. Order your stickers for free!",
    registration: promo.calloutRegistration ?? "Your item is registered! Order your stickers for free to protect it.",
  };

  return (
    <div className="rounded-xl border border-[var(--rcb-primary)]/20 bg-[var(--rcb-primary)]/[0.04] px-5 py-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="shrink-0 rounded-full bg-[var(--rcb-primary)] px-2.5 py-0.5 text-xs font-bold tracking-wide text-white uppercase">
          {promo.badge}
        </span>
        <p className="text-sm text-[var(--rcb-text-strong)]">
          {texts[variant]}
        </p>
        <Link
          to={ROUTES.shop}
          className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--rcb-primary)] hover:underline"
        >
          {promo.cta}
          <span aria-hidden="true">&rarr;</span>
        </Link>
      </div>
    </div>
  );
}
