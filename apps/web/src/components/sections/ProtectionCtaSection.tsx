import { Link } from "react-router";
import { useLanguage } from "@/i18n/context";
import { getButtonClasses } from "@/lib/button-styles";
import { ROUTES } from "@/routes/routes";

export function ProtectionCtaSection() {
  const { t } = useLanguage();

  return (
    <section id="register" className="scroll-mt-24 bg-[var(--rcb-bg)]">
      <div className="section-shell pt-16 pb-28 sm:pt-20 sm:pb-32 lg:pt-24">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[2.5rem] border border-[var(--rcb-frame)] bg-[var(--rcb-bg)]">
          <div className="grid lg:grid-cols-[340px_1fr]">
            <img
              src="/assets/promo-protect-v2.webp"
              alt={t.protectionCta.imageAlt}
              width={1536}
              height={1024}
              loading="lazy"
              className="h-full w-full object-cover"
            />

            <div className="relative z-10 flex flex-col justify-center px-8 py-14 text-center sm:px-16 sm:py-20 lg:text-left">
              <h2 className="text-6xl font-bold leading-tight text-[var(--rcb-text)] sm:text-7xl">
                {t.protectionCta.headingLine1}
                <br />
                {t.protectionCta.headingLine2}
              </h2>
              <p className="mt-8 max-w-3xl text-xl leading-relaxed text-[var(--rcb-text-muted)]">
                {t.protectionCta.description}
              </p>

              <div className="mt-12 flex flex-wrap items-center justify-center gap-4 lg:justify-start">
                <Link to={ROUTES.registerItem} className={getButtonClasses("primary")}>{t.buttons.signUp}</Link>
                <Link to={ROUTES.lookup} className={getButtonClasses("outline")}>{t.buttons.verifyItem}</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
