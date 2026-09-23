"use client";

import { useLanguage } from "@/i18n/LanguageProvider";
import { ModuleCard } from "@/components/ModuleCard";

export default function InstructorPortal() {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-navy">{t("dashboard.instructor.title")}</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <ModuleCard
          title={t("dashboard.instructor.pool")}
          description="Browse and filter all questions added by any instructor across Grades 4–12, difficulty, and single/mixed categories."
        />
        <ModuleCard
          title={t("dashboard.instructor.importer")}
          description="CSV parser supporting bilingual inputs (English & Arabic text, choices, explanations)."
        />
        <ModuleCard
          title={t("dashboard.instructor.exams")}
          description="Manual selection or Auto-Balanced Generator (30% Easy / 50% Medium / 20% Hard) with automatic timer calculation."
        />
        <ModuleCard
          title={t("dashboard.instructor.classes")}
          description="Create classes, generate shareable Class Claim Links, and add parents by email."
        />
      </div>
    </div>
  );
}
