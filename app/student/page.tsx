"use client";

import { useLanguage } from "@/i18n/LanguageProvider";
import { ModuleCard } from "@/components/ModuleCard";

export default function StudentPortal() {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-navy">{t("dashboard.student.title")}</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <ModuleCard
          href="/student/exams"
          title={t("dashboard.student.practice")}
          description="Public practice tests shared by any instructor — take them now."
        />
        <ModuleCard title={t("dashboard.student.assigned")} description="Class-assigned exams — coming soon." />
        <ModuleCard title={t("dashboard.student.progress")} description="Progress charts — coming soon." />
        <ModuleCard title={t("dashboard.student.leaderboard")} description="Class leaderboard — coming soon." />
      </div>
    </div>
  );
}
