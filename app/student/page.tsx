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
          description="Class-assigned exams and public practice tests — take them now."
        />
        <ModuleCard
          href="/student/progress"
          title={t("dashboard.student.progress")}
          description="Your score history and a topic-by-topic breakdown of strengths and weaknesses."
        />
        <ModuleCard
          href="/student/leaderboard"
          title={t("dashboard.student.leaderboard")}
          description="See how your scores compare to the rest of your class."
        />
      </div>
    </div>
  );
}
