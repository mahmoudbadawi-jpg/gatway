"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useLanguage } from "@/i18n/LanguageProvider";

export function Header() {
  const { t, lang, toggleLang } = useLanguage();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("gatway-theme");
    const isDark = stored === "dark";
    setDark(isDark);
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
    window.localStorage.setItem("gatway-theme", next ? "dark" : "light");
  }

  return (
    <header className="no-print sticky top-0 z-50 border-b border-border bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2">
        <Link href="/dashboard" aria-label={t("app.name")} className="flex items-center">
          <Image src="/logo/gatway-logo.png" alt={t("app.name")} width={72} height={72} priority />
        </Link>

        <div className="flex items-center gap-5">
          <button
            onClick={toggleLang}
            className="text-sm font-medium text-navy/80 hover:text-teal"
            aria-label="Toggle language"
          >
            {lang === "en" ? "AR" : "EN"}
          </button>

          <label className="flex items-center gap-2 text-sm text-navy/70">
            {t("theme.eyeComfort")}
            <span
              className="switch"
              data-on={dark}
              role="switch"
              aria-checked={dark}
              onClick={toggleTheme}
            >
              <span className="switch-thumb" />
            </span>
          </label>
        </div>
      </div>
    </header>
  );
}
