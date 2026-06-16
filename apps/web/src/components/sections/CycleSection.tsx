import { Link } from "react-router";
import { useLanguage } from "@/i18n/context";
import { getButtonClasses } from "@/lib/button-styles";
import { ROUTES } from "@/routes/routes";

export function CycleSection() {
  const { t } = useLanguage();

  return (
    <section id="about" className="scroll-mt-24 bg-[var(--rcb-surface)]">
      <div className="section-shell py-18 sm:py-20">
        <h2 className="text-center text-6xl font-bold text-[var(--rcb-text)] sm:text-7xl">
          {t.cycle.heading}
        </h2>

        <div className="mt-14 grid items-center gap-12 md:grid-cols-2">
          <div className="space-y-6">
            {t.cycle.actions.map((action) => (
              <article
                key={action.number}
                className="border-t border-[var(--rcb-border-muted)] pt-6"
              >
                <div className="flex items-center gap-3 text-3xl font-bold">
                  <span className="text-xl text-[var(--rcb-primary)]">{action.number}</span>
                  <h3>{action.title}</h3>
                </div>
                <p className="mt-4 text-xl text-[var(--rcb-text-body)]">
                  {action.description}
                </p>
              </article>
            ))}
          </div>

          <figure className="mx-auto w-full max-w-[430px]">
            <img
              src="/assets/cycle-police.webp"
              alt={t.cycle.imageAlt}
              width={506}
              height={759}
              loading="lazy"
              className="h-auto w-full rounded-[2.2rem] object-cover"
            />
          </figure>
        </div>

        <div className="mt-14 text-center">
          <Link
            to={ROUTES.lookup}
            className={getButtonClasses("outline")}
          >
            {t.buttons.declareStolen}
          </Link>
        </div>
      </div>
    </section>
  );
}
