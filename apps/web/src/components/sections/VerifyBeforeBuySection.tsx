import { Link } from "react-router";
import { useLanguage } from "@/i18n/context";
import { getButtonClasses } from "@/lib/button-styles";
import { ROUTES } from "@/routes/routes";

export function VerifyBeforeBuySection() {
  const { t } = useLanguage();
  const content = t.verifyBeforeBuy;
  if (!content) return null;

  return (
    <section className="scroll-mt-24 bg-[var(--rcb-bg-muted)]">
      <div className="section-shell pt-16 pb-28 sm:pt-20 sm:pb-32 lg:pt-24">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[2.5rem] border border-[var(--rcb-primary)]">
          <div className="grid lg:grid-cols-[1fr_340px]">
            <div className="relative z-10 flex flex-col justify-center px-8 py-14 text-center sm:px-16 sm:py-20 lg:text-left">
              <h2 className="text-6xl font-bold leading-tight text-[var(--rcb-text)] sm:text-7xl">
                <span className="text-[var(--rcb-primary)]">{content.headingAccent}</span>
                <br />
                {content.heading}
              </h2>
              <p className="mt-8 max-w-3xl text-xl leading-relaxed text-[var(--rcb-text-muted)]">
                {content.description}
              </p>
              <div className="mt-12 flex flex-wrap items-center justify-center gap-4 lg:justify-start">
                <Link to={ROUTES.lookup} className={getButtonClasses("primary")}>
                  {content.buttonText}
                </Link>
              </div>
            </div>

            <img
              src="/assets/verify-before-buy-v2.webp"
              alt={content.imageAlt}
              width={604}
              height={819}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
