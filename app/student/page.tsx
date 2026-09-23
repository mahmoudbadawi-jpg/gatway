"use client";

import { useLanguage } from "@/i18n/LanguageProvider";
import { ModuleCard } from "@/components/ModuleCard";

export default function StudentPortal() {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-navy">{t("dashboard.student.title")}</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <ModuleCard title={t("dashboard.student.assigned")} description="Exams assigned by your class instructor." />
        <ModuleCard title={t("dashboard.student.practice")} description="Public practice tests shared by any instructor." />
        <ModuleCard title={t("dashboard.student.progress")} description="Progress charts across attempts and categories." />
        <ModuleCard title={t("dashboard.student.leaderboard")} description="See how you rank against your class." />
      </div>
    </div>
  );
}
