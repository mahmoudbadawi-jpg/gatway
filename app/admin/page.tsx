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
          href="/admin/users"
          title={t("dashboard.admin.users")}
          description="View every user, and promote or demote their role (Admin, Instructor, Student, Parent)."
        />
        <ModuleCard
          href="/admin/monitoring"
          title={t("dashboard.admin.monitoring")}
          description="Platform-wide stats: users, question pool size, every exam's attempt count and average score."
        />
      </div>
    </div>
  );
}
