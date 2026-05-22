import { Link } from "react-router";
import { useLanguage } from "@/i18n/context";
import { getButtonClasses } from "@/lib/button-styles";
import { ROUTES } from "@/routes/routes";

export function LookupPhotoPage() {
  const { locale } = useLanguage();

  const i18n = {
    fr: {
      title: "Recherche par photo | Badge",
      description: "Recherchez un bien enregistré à l'aide d'une photo.",
      heading: "Recherche par photo",
      badge: "Bientôt disponible",
      text: "Soumettez une photo de votre bien. Notre système d'intelligence artificielle analysera l'image et la comparera à l'ensemble des biens enregistrés dans notre base de données pour tenter d'identifier une correspondance.",
      subtext: "Cette fonctionnalité est en cours de développement et sera disponible prochainement.",
      back: "Retour à la recherche",
    },
    en: {
      title: "Photo search | Badge",
      description: "Search for a registered item using a photo.",
      heading: "Photo search",
      badge: "Coming soon",
      text: "Submit a photo of your item. Our artificial intelligence system will analyze the image and compare it to all items registered in our database to attempt to identify a match.",
      subtext: "This feature is under development and will be available soon.",
      back: "Back to search",
    },
  };

  const c = i18n[locale === "en" ? "en" : "fr"];

  return (
    <section className="flex min-h-[60vh] items-center justify-center bg-[var(--rcb-white)] px-4 py-16">
      
        <title>{c.title}</title>
        <meta name="description" content={c.description} />
      
      <div className="w-full max-w-lg text-center">
        {/* Camera icon */}
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[var(--rcb-primary)]/10">
          <svg className="h-10 w-10 text-[var(--rcb-primary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
        </div>

        <h1 className="mt-6 text-3xl font-bold text-[var(--rcb-text-strong)]">
          {c.heading}
        </h1>

        <span className="mt-4 inline-block rounded-full bg-[var(--rcb-primary)] px-4 py-1.5 text-xs font-bold tracking-wide text-white uppercase">
          {c.badge}
        </span>

        <p className="mt-6 text-lg leading-relaxed text-[var(--rcb-text-muted)]">
          {c.text}
        </p>

        <p className="mt-4 text-sm text-[var(--rcb-text-light)]">
          {c.subtext}
        </p>

        <div className="mt-10">
          <Link to={ROUTES.lookup} className={getButtonClasses("outline")}>
            {c.back}
          </Link>
        </div>
      </div>
    </section>
  );
}
export default LookupPhotoPage;
