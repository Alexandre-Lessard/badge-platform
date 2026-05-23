import { execSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TMP_EN = join(tmpdir(), "rnbp-index.en.html");

console.log("→ Building EN prerender…");
execSync("react-router build", {
  stdio: "inherit",
  env: { ...process.env, BUILD_LOCALE: "en" },
});

if (!existsSync("build/client/index.html")) {
  throw new Error("EN build did not produce build/client/index.html");
}
copyFileSync("build/client/index.html", TMP_EN);

console.log("→ Building FR prerender…");
execSync("react-router build", { stdio: "inherit" });

copyFileSync(TMP_EN, "build/client/index.en.html");

// The home page's <title> and <meta name="description"> are hoisted by React 19
// from LandingPage into the prerendered HTML, which also serves as the SPA
// fallback for all non-prerendered routes. Replace them with {{TITLE}} /
// {{DESCRIPTION}} placeholders so the Cloudflare Pages Function can inject the
// correct per-route values at request time (see functions/[[path]].ts).
//
// IMPORTANT — these strings must stay in sync with t.pages.home.title/description
// in apps/web/src/i18n/locales/{fr,en}.ts. The build fails fast if they diverge.
// If a future translation contains HTML-reserved chars (&, <, >, "), mirror
// here the exact entity React 19 emits in the HTML (e.g. "&amp;", not "&").
const HOME = {
  fr: {
    file: "build/client/index.html",
    title: "Protégez et retrouvez vos biens de valeur | Badge",
    description:
      "Enregistrez vos biens de valeur dans un registre sécurisé. Protégez et retrouvez vos biens en cas de perte ou de vol.",
  },
  en: {
    file: "build/client/index.en.html",
    title: "Protect and recover your valuable belongings | Badge",
    description:
      "Register your valuable belongings in a secure registry. Protect and recover your items in case of loss or theft.",
  },
};

for (const [locale, { file, title, description }] of Object.entries(HOME)) {
  let html = readFileSync(file, "utf8");

  const titleTag = `<title>${title}</title>`;
  if (!html.includes(titleTag)) {
    throw new Error(
      `build-multilocale: expected title tag not found in ${file} (${locale}). Did t.pages.home.title change without updating this script?`,
    );
  }
  html = html.replace(titleTag, "<title>{{TITLE}}</title>");

  const descTag = `<meta name="description" content="${description}"/>`;
  if (!html.includes(descTag)) {
    throw new Error(
      `build-multilocale: expected description meta not found in ${file} (${locale}). Did t.pages.home.description change without updating this script?`,
    );
  }
  html = html.replace(descTag, `<meta name="description" content="{{DESCRIPTION}}"/>`);

  writeFileSync(file, html);
}

const fr = statSync("build/client/index.html");
const en = statSync("build/client/index.en.html");
if (fr.size === 0 || en.size === 0) {
  throw new Error("Multi-locale build produced an empty HTML output");
}

console.log(
  `✓ build/client/index.html (FR, ${fr.size} B) + index.en.html (EN, ${en.size} B) ready`,
);
