"use client";

import { useLanguage } from "@/i18n/LanguageProvider";
import { ModuleCard } from "@/components/ModuleCard";

export default function AdminPortal() {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-navy">{t("dashboard.admin.title")}</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <ModuleCard
          title={t("dashboard.admin.users")}
          description="View, edit, promote, or assign roles (Admin, Instructor, Student, Parent)."
        />
        <ModuleCard
          title={t("dashboard.admin.monitoring")}
          description="System-wide access to shared question pools, public exams, and user analytics."
        />
      </div>
    </div>
  );
}
