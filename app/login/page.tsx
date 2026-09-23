"use client";

import { useLanguage } from "@/i18n/LanguageProvider";
import { useAuth } from "@/lib/useAuth";

export default function LoginPage() {
  const { t } = useLanguage();
  const { signInWithGoogle } = useAuth();

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-card border border-border bg-surface p-10 text-center shadow-sm">
      <h1 className="text-2xl font-bold text-navy">{t("auth.welcome")}</h1>
      <p className="text-navy/70">{t("auth.subtitle")}</p>
      <button
        onClick={signInWithGoogle}
        className="mt-4 w-full rounded-card bg-navy px-4 py-2.5 font-medium text-white transition hover:bg-navy-light"
      >
        {t("auth.signInGoogle")}
      </button>
    </div>
  );
}
