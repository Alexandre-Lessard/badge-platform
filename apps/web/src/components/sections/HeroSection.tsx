import { Link } from "react-router";
import { useLanguage } from "@/i18n/context";
import { getButtonClasses } from "@/lib/button-styles";
import { ROUTES } from "@/routes/routes";

export function HeroSection() {
  const { t } = useLanguage();

  return (
    <section id="home" className="scroll-mt-28 bg-[var(--rcb-bg)]">
      <div className="section-shell grid items-center gap-10 py-16 lg:grid-cols-[1fr_1.1fr] lg:py-20">
        <div className="animate-rise">
          <p className="text-3xl font-medium leading-tight text-[var(--rcb-text)] sm:text-4xl">
            {t.hero.subtitleLine1}
          </p>
          <h1 className="mt-2 text-6xl font-bold leading-[0.95] text-[var(--rcb-primary)] sm:text-7xl">
            {t.hero.titleLine1}
          </h1>

          <p className="mt-8 max-w-xl text-lg leading-relaxed text-[var(--rcb-text-muted)] sm:text-xl">
            {t.hero.description}
          </p>

          <div className="mt-12 flex flex-wrap items-center gap-4">
            <Link to={ROUTES.registerItem} className={getButtonClasses("primary")}>{t.buttons.registerItem}</Link>
            <Link
              to={ROUTES.lookup}
              className={getButtonClasses("outline")}
            >
              {t.buttons.declareStolen}
            </Link>
          </div>
          <p className="mt-4 text-lg font-medium text-[var(--rcb-primary)]">
            {t.hero.freeLabel}
          </p>
        </div>

        <div className="relative mx-auto flex w-full max-w-[700px] items-center justify-center">
          <img
            src="/assets/hero-shield-check.png"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute -top-5 -right-5 w-[210px] opacity-90 sm:-top-10 sm:-right-10 sm:w-[420px]"
          />
          <img
            src="/assets/hero-items.webp"
            alt={t.hero.imageAlt}
            width={1536}
            height={1024}
            className="relative z-10 w-full drop-shadow-[0_30px_40px_rgba(16,25,40,0.2)]"
          />
        </div>
      </div>

      <div className="bg-[var(--rcb-bg)]">
        <div className="section-shell flex justify-center pb-2">
          <div className="rounded-full bg-[var(--rcb-primary)]/8 px-8 py-4 text-center text-xl font-semibold text-[var(--rcb-text-strong)] sm:text-2xl">
            <span className="whitespace-nowrap text-[var(--rcb-primary)]">{t.hero.countBadge.count}</span>{" "}
            {t.hero.countBadge.middle}{" "}
            <span className="whitespace-nowrap text-[var(--rcb-primary)]">{t.hero.countBadge.highlight}</span>
          </div>
        </div>
      </div>

      <div className="bg-[var(--rcb-bg)]">
        <div className="section-shell py-8">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {t.hero.trustBadges.map((badge, i) => {
              const icons = [
                <svg key="db" className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v6c0 1.66 4.03 3 9 3s9-1.34 9-3V5" /><path d="M3 11v6c0 1.66 4.03 3 9 3s9-1.34 9-3v-6" /></svg>,
                <svg key="lock" className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>,
                <svg key="shield" className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></svg>,
                <svg key="building" className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}><path d="M3 21h18M5 21V7l8-4v18M13 21V3l6 4v14" /><path d="M9 9h1m-1 4h1m3-4h1m-1 4h1" /></svg>,
              ];
              return (
                <div
                  key={badge.label}
                  className="flex flex-col items-center gap-2.5 rounded-xl border border-[var(--rcb-border)] bg-[var(--rcb-white)] px-4 py-5 text-center"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--rcb-primary)]/10 text-[var(--rcb-primary)]">
                    {icons[i]}
                  </span>
                  <span className="text-sm font-semibold leading-snug text-[var(--rcb-text-strong)]">
                    {badge.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
