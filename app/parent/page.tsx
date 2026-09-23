"use client";

import { useLanguage } from "@/i18n/LanguageProvider";
import { ModuleCard } from "@/components/ModuleCard";

export default function ParentPortal() {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-navy">{t("dashboard.parent.title")}</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <ModuleCard
          title={t("dashboard.parent.children")}
          description="Overview cards for linked children, with scores, completion rate, category breakdown, and class ranking."
        />
        <ModuleCard
          title={t("dashboard.parent.link")}
          description="Link by entering your child's registered email, or claim a child from a shared class link."
        />
      </div>
    </div>
  );
}
