/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { SiteContent } from "@/types/content";
import { defaultLocale, locales, type SupportedLocale } from "./locales";

type LanguageContextValue = {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  t: SiteContent;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function detectLocale(): SupportedLocale {
  // SSR / build-time: no browser APIs available.
  // BUILD_LOCALE=en switches the prerender output to English (used to generate
  // index.en.html for badgeid.ca). Access process via globalThis cast so we don't
  // need @types/node in the web app, and so the whole branch is dead-code in
  // the browser bundle — both FR and EN builds produce identical client assets,
  // only the prerendered HTML differs.
  if (typeof window === "undefined") {
    const g = globalThis as {
      process?: { env?: Record<string, string | undefined> };
    };
    if (g.process?.env?.BUILD_LOCALE === "en") return "en";
    return defaultLocale;
  }

  // 1. User's explicit choice (localStorage)
  const stored = localStorage.getItem("locale");
  if (stored && stored in locales) return stored as SupportedLocale;

  // 2. Browser language
  const browserLang = navigator.language.slice(0, 2);
  if (browserLang in locales) return browserLang as SupportedLocale;

  return defaultLocale;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>(detectLocale);

  const setLocale = (newLocale: SupportedLocale) => {
    setLocaleState(newLocale);
    localStorage.setItem("locale", newLocale);
  };

  useEffect(() => {
    document.documentElement.lang = locale === "fr" ? "fr-CA" : "en-CA";
  }, [locale]);

  return (
    <LanguageContext value={{ locale, setLocale, t: locales[locale] }}>
      {children}
    </LanguageContext>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}
