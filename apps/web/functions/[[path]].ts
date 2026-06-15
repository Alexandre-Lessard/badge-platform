interface PageMeta {
  title: string;
  description: string;
  robots?: string;
}

type LocaleMeta = Record<string, PageMeta>;

const META: Record<"fr" | "en", { defaults: PageMeta; pages: LocaleMeta }> = {
  fr: {
    defaults: {
      title: "Protégez et retrouvez vos biens de valeur | Badge",
      description:
        "Enregistrez vos biens de valeur dans un registre sécurisé. Protégez et retrouvez vos biens en cas de perte ou de vol.",
    },
    pages: {
      "/": {
        title: "Protégez et retrouvez vos biens de valeur | Badge",
        description:
          "Enregistrez vos biens de valeur dans un registre sécurisé. Protégez et retrouvez vos biens en cas de perte ou de vol.",
      },
      "/faq": {
        title: "Questions fréquentes | Badge",
        description:
          "Trouvez les réponses aux questions courantes sur l'enregistrement de vos biens au Badge.",
      },
      "/registry": {
        title: "Consulter le registre | Badge",
        description:
          "Consultez le registre pour vérifier un bien. Citoyens, services policiers et compagnies d'assurance.",
      },
      "/privacy": {
        title: "Politique de confidentialité | Badge",
        description:
          "Découvrez comment Badge protège vos renseignements personnels et respecte les lois fédérales sur la vie privée.",
      },
      "/terms": {
        title: "Conditions d'utilisation | Badge",
        description:
          "Consultez les conditions d'utilisation du Badge.",
      },
      "/data-deletion": {
        title: "Suppression de votre compte | Badge",
        description:
          "Comment demander la suppression complète de votre compte et de vos données du Badge.",
      },
      "/lookup": {
        title: "Vérifier un bien | Badge",
        description:
          "Entrez un code Badge pour vérifier le statut d'un bien enregistré dans le registre.",
      },
      "/login": {
        title: "Connexion | Badge",
        description:
          "Connectez-vous à votre compte Badge pour gérer vos biens enregistrés.",
      },
      "/register": {
        title: "Créer un compte | Badge",
        description:
          "Inscrivez-vous gratuitement à Badge pour enregistrer et protéger vos biens de valeur.",
      },
      "/dashboard": {
        title: "Tableau de bord | Badge",
        description: "Gérez vos biens enregistrés.",
        robots: "noindex, nofollow",
      },
      "/report-theft": {
        title: "Déclarer un vol | Badge",
        description: "Déclarez un bien volé.",
        robots: "noindex, nofollow",
      },
      "/register-item": {
        title: "Enregistrer un bien | Badge",
        description: "Enregistrez un bien dans le registre.",
        robots: "noindex, nofollow",
      },
      "/shop": {
        title: "Boutique | Badge",
        description:
          "Achetez des étiquettes d'identification Badge pour protéger vos biens de valeur.",
      },
      "/shop/success": {
        title: "Commande confirmée | Badge",
        description: "Votre commande a été confirmée avec succès.",
        robots: "noindex, nofollow",
      },
      "/contact": {
        title: "Contactez-nous | Badge",
        description:
          "Contactez l'équipe du Badge pour toute question ou demande.",
      },
      "/verify-email": {
        title: "Vérification du courriel | Badge",
        description: "Vérifiez votre adresse courriel.",
        robots: "noindex, nofollow",
      },
      "/email-pending": {
        title: "Vérification en attente | Badge",
        description: "Vérification de votre courriel en cours.",
        robots: "noindex, nofollow",
      },
      "/admin/orders": {
        title: "Admin — Commandes | Badge",
        description: "Gestion des commandes.",
        robots: "noindex, nofollow",
      },
      "/c": {
        title: "Bien enregistré | Badge",
        description: "Vérifiez l'état d'un bien enregistré à Badge via son code Badge.",
        robots: "noindex, nofollow",
      },
    },
  },
  en: {
    defaults: {
      title: "Protect and recover your valuable belongings | Badge",
      description:
        "Register your valuable belongings in a secure registry. Protect and recover your items in case of loss or theft.",
    },
    pages: {
      "/": {
        title: "Protect and recover your valuable belongings | Badge",
        description:
          "Register your valuable belongings in a secure registry. Protect and recover your items in case of loss or theft.",
      },
      "/faq": {
        title: "Frequently Asked Questions | Badge",
        description:
          "Find answers to common questions about registering your belongings in the Badge.",
      },
      "/registry": {
        title: "Consult the Registry | Badge",
        description:
          "Consult the registry to verify an item. Citizens, law enforcement and insurance companies.",
      },
      "/privacy": {
        title: "Privacy Policy | Badge",
        description:
          "Learn how the Badge protects your personal information and complies with federal privacy laws.",
      },
      "/terms": {
        title: "Terms of Service | Badge",
        description:
          "Review the terms of service for the Badge.",
      },
      "/data-deletion": {
        title: "Account Deletion | Badge",
        description:
          "How to request the complete deletion of your account and data from the Badge.",
      },
      "/lookup": {
        title: "Verify an Item | Badge",
        description:
          "Enter a Badge code to check the status of a registered item.",
      },
      "/login": {
        title: "Login | Badge",
        description:
          "Sign in to your Badge account to manage your registered items.",
      },
      "/register": {
        title: "Create an Account | Badge",
        description:
          "Sign up for free to register and protect your valuable belongings.",
      },
      "/dashboard": {
        title: "Dashboard | Badge",
        description: "Manage your registered items.",
        robots: "noindex, nofollow",
      },
      "/report-theft": {
        title: "Report a Theft | Badge",
        description: "Report a stolen item.",
        robots: "noindex, nofollow",
      },
      "/register-item": {
        title: "Register an Item | Badge",
        description: "Register an item in the registry.",
        robots: "noindex, nofollow",
      },
      "/shop": {
        title: "Shop | Badge",
        description:
          "Buy Badge identification stickers to protect your valuable belongings.",
      },
      "/shop/success": {
        title: "Order Confirmed | Badge",
        description: "Your order has been successfully confirmed.",
        robots: "noindex, nofollow",
      },
      "/contact": {
        title: "Contact Us | Badge",
        description:
          "Contact the Badge team for any questions or inquiries.",
      },
      "/verify-email": {
        title: "Email Verification | Badge",
        description: "Verify your email address.",
        robots: "noindex, nofollow",
      },
      "/email-pending": {
        title: "Verification Pending | Badge",
        description: "Email verification in progress.",
        robots: "noindex, nofollow",
      },
      "/admin/orders": {
        title: "Admin — Orders | Badge",
        description: "Order management.",
        robots: "noindex, nofollow",
      },
      "/c": {
        title: "Registered item | Badge",
        description: "Check the status of an item registered with Badge via its badge code.",
        robots: "noindex, nofollow",
      },
    },
  },
};

const FAQ_FR = [
  {
    q: "Combien ça coûte\u00a0?",
    a: "L'enregistrement de vos biens est entièrement gratuit. Aucun frais caché, aucun abonnement.",
  },
  {
    q: "Quel est le seuil minimum\u00a0?",
    a: "Les biens doivent avoir une valeur d'au moins 250\u00a0$.",
  },
  {
    q: "Mes données sont-elles protégées\u00a0?",
    a: "Oui. Badge respecte les lois fédérales sur la protection des données. Vos informations personnelles ne sont jamais vendues ni partagées sans consentement.",
  },
  {
    q: "Combien de temps prend l'enregistrement\u00a0?",
    a: "Moins de trois minutes. Vous recevrez un numéro de confirmation immédiatement après validation.",
  },
  {
    q: "Pourquoi le registre est-il nécessaire\u00a0?",
    a: "Chaque année, des milliers de biens sont perdus ou volés au Canada. Badge crée une preuve officielle, sécurisée et datée de vos biens dans un dossier unique.",
  },
  {
    q: "Le registre fonctionne-t-il partout au pays\u00a0?",
    a: "Oui. Le registre est conçu pour fonctionner à l'échelle nationale.",
  },
];

const FAQ_EN = [
  {
    q: "How much does it cost?",
    a: "Registering your belongings is completely free. No hidden fees, no subscription.",
  },
  {
    q: "What is the minimum threshold?",
    a: "Items must have a value of at least $250.",
  },
  {
    q: "Is my data protected?",
    a: "Yes. The Badge complies with federal data protection laws. Your personal information is never sold or shared without consent.",
  },
  {
    q: "How long does registration take?",
    a: "Less than three minutes. You'll receive a confirmation number immediately after validation.",
  },
  {
    q: "Why is the registry necessary?",
    a: "Every year, thousands of items are lost or stolen in Canada. The Badge creates an official, secure and dated record of your belongings in a single file.",
  },
  {
    q: "Does the registry work across the country?",
    a: "Yes. The registry is designed to operate nationwide.",
  },
];

// Derived from META — single source of truth
const PUBLIC_PATHS = Object.entries(META.fr.pages)
  .filter(([, meta]) => !meta.robots?.includes("noindex"))
  .map(([path]) => path);

const NOINDEX_PATHS = Object.entries(META.fr.pages)
  .filter(([, meta]) => meta.robots?.includes("noindex"))
  .map(([path]) => path);

const ALL_KNOWN_PATHS = Object.keys(META.fr.pages);
const PREFIX_PATHS = ["/admin/orders", "/c"];

// Single-domain (badgeid.ca): locale detection moved client-side
// (localStorage > navigator.language). Server-side prerender defaults to FR;
// EN variant is generated via BUILD_LOCALE=en at build time.
const BRAND_ORIGIN = "https://badgeid.ca";

function detectLocale(): "fr" | "en" {
  return "fr";
}

function getDomain(): string {
  return BRAND_ORIGIN;
}

function getOtherDomain(): string {
  return BRAND_ORIGIN;
}

function generateRobotsTxt(): Response {
  const domain = BRAND_ORIGIN;
  const disallows = NOINDEX_PATHS.map((p) => `Disallow: ${p}`).join("\n");
  const body = `User-agent: *
Allow: /
${disallows}

Sitemap: ${domain}/sitemap.xml
`;
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

function generateSitemapXml(): Response {
  const locale = detectLocale();
  const domain = getDomain();
  const otherDomain = getOtherDomain();

  const urls = PUBLIC_PATHS.map((path) => {
    const loc = `${domain}${path === "/" ? "" : path}/`;
    const frHref =
      locale === "fr"
        ? loc
        : `${otherDomain}${path === "/" ? "" : path}/`;
    const enHref =
      locale === "en"
        ? loc
        : `${otherDomain}${path === "/" ? "" : path}/`;
    return `  <url>
    <loc>${loc}</loc>
    <xhtml:link rel="alternate" hreflang="fr" href="${frHref}" />
    <xhtml:link rel="alternate" hreflang="en" href="${enHref}" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${locale === "fr" ? loc : frHref}" />
    <lastmod>2026-03-11</lastmod>
  </url>`;
  }).join("\n");

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>`;

  return new Response(body, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}

function buildJsonLd(locale: "fr" | "en", path: string, domain: string): string {
  const orgName =
    locale === "fr"
      ? "Badge"
      : "Badge";
  const altName = "Badge";
  const logoFile = "logo.png";
  const description =
    locale === "fr"
      ? "Badge — protégez et retrouvez vos biens de valeur."
      : "Badge — protect and recover your valuable belongings.";

  let jsonLd = `<script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "${orgName}",
        "alternateName": "${altName}",
        "url": "${domain}",
        "logo": "${domain}/assets/${logoFile}",
        "description": "${description}"
      }
    </script>`;

  if (path === "/faq") {
    const faqItems = locale === "fr" ? FAQ_FR : FAQ_EN;
    const faqEntries = faqItems
      .map(
        (item) => `{
          "@type": "Question",
          "name": ${JSON.stringify(item.q)},
          "acceptedAnswer": {
            "@type": "Answer",
            "text": ${JSON.stringify(item.a)}
          }
        }`
      )
      .join(",\n        ");

    jsonLd += `
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
        ${faqEntries}
        ]
      }
    </script>`;
  }

  return jsonLd;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function injectMeta(
  html: string,
  locale: "fr" | "en",
  path: string,
): string {
  const domain = getDomain();
  // Lookup exact path, then parent path (e.g. /admin/commandes for /admin/commandes/123)
  const meta = META[locale].pages[path]
    ?? META[locale].pages[path.replace(/\/[^/]+$/, "")]
    ?? META[locale].defaults;

  const ogLocale = locale === "fr" ? "fr_CA" : "en_CA";
  const ogLocaleAlt = locale === "fr" ? "en_CA" : "fr_CA";
  const siteName = "Badge";
  const ogImageFile = locale === "fr" ? "og-image-fr.png" : "og-image-en.png";
  const canonicalUrl = `${domain}${path === "/" ? "" : path}/`;
  const ogUrl = canonicalUrl;
  const ogImage = `${domain}/assets/${ogImageFile}`;
  const hreflangFr = `https://badgeid.ca${path === "/" ? "/" : path + "/"}`;
  const hreflangEn = `https://badgeid.ca${path === "/" ? "/" : path + "/"}`;
  const robots = meta.robots ?? "index, follow";
  const lang = locale === "fr" ? "fr-CA" : "en-CA";
  const jsonLd = buildJsonLd(locale, path, domain);

  // The home-page <title> and <meta name="description"> hoisted by React 19
  // into the prerendered HTML are replaced with {{TITLE}} / {{DESCRIPTION}}
  // placeholders at build time (scripts/build-multilocale.mjs) so the
  // substitutions below work for every route, including SPA-fallback ones.
  // escapeHtml guards against future titles containing &, <, >, " — current
  // translations are safe but the placeholder interpolation would otherwise
  // inject raw chars into attribute/element contexts.
  return html
    .replace("{{LANG}}", lang)
    .replace(/\{\{TITLE\}\}/g, escapeHtml(meta.title))
    .replace(/\{\{DESCRIPTION\}\}/g, escapeHtml(meta.description))
    .replace("{{ROBOTS}}", robots)
    .replace("{{OG_LOCALE}}", ogLocale)
    .replace("{{OG_LOCALE_ALT}}", ogLocaleAlt)
    .replace("{{SITE_NAME}}", siteName)
    .replace("{{OG_URL}}", ogUrl)
    .replace(/\{\{OG_IMAGE\}\}/g, ogImage)
    .replace("{{CANONICAL}}", canonicalUrl)
    .replace(/\{\{HREFLANG_FR\}\}/g, hreflangFr)
    .replace("{{HREFLANG_EN}}", hreflangEn)
    .replace("<!-- JSON-LD {{JSON_LD}} -->", jsonLd);
}

export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const { pathname } = url;

  if (pathname === "/robots.txt") {
    return generateRobotsTxt();
  }

  if (pathname === "/sitemap.xml") {
    return generateSitemapXml();
  }

  // For non-HTML requests, pass through to static assets
  let response = await context.next();
  const contentType = response.headers.get("Content-Type") || "";
  if (!contentType.includes("text/html")) {
    return response;
  }

  // For HTML responses, inject meta tags
  const locale = detectLocale();

  // On the EN domain, swap the prerendered body for the EN-prerendered HTML
  // (build produces index.html in FR and index.en.html in EN). We re-fetch
  // via the ASSETS binding, which serves static assets and honours the
  // pretty-path mapping: requesting /index.en returns the contents of
  // /index.en.html (fetching /index.en.html directly 308-redirects to the
  // pretty path). If the EN file is missing (e.g. old build still deployed),
  // fall back silently to the FR body rather than 500.
  if (locale === "en") {
    const enUrl = new URL(context.request.url);
    enUrl.pathname = "/index.en";
    const enResp = await context.env.ASSETS.fetch(
      new Request(enUrl, context.request),
    );
    if (enResp.ok) {
      response = new Response(enResp.body, {
        status: response.status,
        headers: response.headers,
      });
    }
  }

  // Normalize path: remove trailing slash except for root
  const path = pathname === "/" ? "/" : pathname.replace(/\/$/, "");
  const html = await response.text();
  const modifiedHtml = injectMeta(html, locale, path);

  // Return 404 for unknown paths (avoid soft 404 for Google)
  const knownPath = ALL_KNOWN_PATHS.includes(path) ||
    PREFIX_PATHS.some((p) => path.startsWith(p + "/"));
  const status = knownPath ? response.status : 404;

  return new Response(modifiedHtml, {
    status,
    headers: response.headers,
  });
};
