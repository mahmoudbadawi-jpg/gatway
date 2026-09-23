"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import en from "./en.json";
import ar from "./ar.json";

type Lang = "en" | "ar";
const dictionaries: Record<Lang, Record<string, string>> = { en, ar };

interface LanguageContextValue {
  lang: Lang;
  dir: "ltr" | "rtl";
  t: (key: string) => string;
  toggleLang: () => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>("en");

  useEffect(() => {
    const stored = window.localStorage.getItem("gatway-lang") as Lang | null;
    if (stored) setLang(stored);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    window.localStorage.setItem("gatway-lang", lang);
  }, [lang]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      lang,
      dir: lang === "ar" ? "rtl" : "ltr",
      t: (key: string) => dictionaries[lang][key] ?? key,
      toggleLang: () => setLang((prev) => (prev === "en" ? "ar" : "en")),
    }),
    [lang]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used inside LanguageProvider");
  return ctx;
}
