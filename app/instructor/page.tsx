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
          href="/instructor/questions"
          title={t("dashboard.instructor.pool")}
          description="Browse, filter, and add questions across Grades 4–12, difficulty, and categories."
        />
        <ModuleCard
          href="/instructor/exams"
          title={t("dashboard.instructor.exams")}
          description="Manual selection or Auto-Balanced Generator (30% Easy / 50% Medium / 20% Hard) with automatic timer calculation."
        />
        <ModuleCard
          href="/instructor/import"
          title={t("dashboard.instructor.importer")}
          description="Bulk-upload bilingual questions from a CSV file, with row-by-row validation."
        />
        <ModuleCard
          title={t("dashboard.instructor.classes")}
          description="Classes and parent linking — coming soon."
        />
      </div>
    </div>
  );
}
