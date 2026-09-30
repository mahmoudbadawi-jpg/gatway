"use client";

import { useEffect, useState } from "react";
import { useRequireRole } from "@/lib/useRequireRole";
import { supabase } from "@/lib/supabaseClient";
import { Exam, Question, StudentAttempt, Category } from "@/lib/types";

interface CategoryStat {
  name: string;
  correct: number;
  total: number;
}

export default function StudentProgressPage() {
  const { profile, loading } = useRequireRole(["ADMIN", "INSTRUCTOR", "STUDENT", "PARENT"]);
  const [attempts, setAttempts] = useState<(StudentAttempt & { examTitle: string })[]>([]);
  const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!profile) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  async function load() {
    setFetching(true);

    const { data: attemptData } = await supabase
      .from("student_attempts")
      .select("*")
      .eq("student_id", profile!.id)
      .eq("status", "SUBMITTED")
      .order("submitted_at", { ascending: true });

    const rows = (attemptData as StudentAttempt[]) ?? [];

    const examIds = Array.from(new Set(rows.map((a) => a.exam_id)));
    const { data: examData } = examIds.length
      ? await supabase.from("exams").select("id, title_en").in("id", examIds)
      : { data: [] as { id: string; title_en: string }[] };
    const examTitleById = new Map((examData ?? []).map((e: { id: string; title_en: string }) => [e.id, e.title_en]));

    const withTitles = rows.map((a) => ({ ...a, examTitle: examTitleById.get(a.exam_id) ?? "Exam" }));
    setAttempts(withTitles);

    // Category breakdown: gather every question answered across all attempts.
    const questionIds = Array.from(new Set(rows.flatMap((a) => Object.keys(a.answers ?? {}))));
    if (questionIds.length > 0) {
      const [{ data: questions }, { data: qCatLinks }, { data: cats }] = await Promise.all([
        supabase.from("questions").select("*").in("id", questionIds),
        supabase.from("question_categories").select("question_id, category_id").in("question_id", questionIds),
        supabase.from("categories").select("*"),
      ]);

      const questionById = new Map((questions as Question[]).map((q) => [q.id, q]));
      const categoryById = new Map((cats as Category[]).map((c) => [c.id, c]));
      const catsByQuestion = new Map<string, string[]>();
      (qCatLinks ?? []).forEach((row: { question_id: string; category_id: string }) => {
        const list = catsByQuestion.get(row.question_id) ?? [];
        list.push(row.category_id);
        catsByQuestion.set(row.question_id, list);
      });

      const stats = new Map<string, CategoryStat>();
      rows.forEach((attempt) => {
        Object.entries(attempt.answers ?? {}).forEach(([qId, chosen]) => {
          const q = questionById.get(qId);
          if (!q) return;
          const catIds = catsByQuestion.get(qId) ?? ["__uncategorized"];
          const isCorrect = chosen === q.correct_option_index;
          catIds.forEach((catId) => {
            const name = catId === "__uncategorized" ? "Uncategorized" : categoryById.get(catId)?.name_en ?? "Uncategorized";
            const existing = stats.get(name) ?? { name, correct: 0, total: 0 };
            existing.total += 1;
            if (isCorrect) existing.correct += 1;
            stats.set(name, existing);
          });
        });
      });
      setCategoryStats(Array.from(stats.values()).sort((a, b) => b.total - a.total));
    }

    setFetching(false);
  }

  if (loading || fetching) return <p className="text-navy/60">Loading…</p>;

  const scores = attempts.map((a) => a.score ?? 0);
  const maxScore = 100;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-navy">My Progress</h1>

      {attempts.length === 0 ? (
        <p className="text-navy/60">Take an exam to start building your progress history.</p>
      ) : (
        <>
          <div className="card p-5">
            <p className="mb-3 font-medium text-navy">Score history</p>
            <svg viewBox="0 0 600 200" className="w-full">
              <line x1="0" y1="180" x2="600" y2="180" stroke="rgb(226 232 240)" strokeWidth={1} />
              <line x1="0" y1="90" x2="600" y2="90" stroke="rgb(226 232 240)" strokeWidth={1} strokeDasharray="4 4" />
              {scores.length > 1 && (
                <polyline
                  fill="none"
                  stroke="rgb(0 168 143)"
                  strokeWidth={2.5}
                  points={scores
                    .map((s, i) => {
                      const x = (i / (scores.length - 1)) * 580 + 10;
                      const y = 180 - (Math.min(s, maxScore) / maxScore) * 160;
                      return `${x},${y}`;
                    })
                    .join(" ")}
                />
              )}
              {scores.map((s, i) => {
                const x = scores.length > 1 ? (i / (scores.length - 1)) * 580 + 10 : 300;
                const y = 180 - (Math.min(s, maxScore) / maxScore) * 160;
                return <circle key={i} cx={x} cy={y} r={4} fill="rgb(10 37 64)" />;
              })}
            </svg>
            <div className="mt-2 flex justify-between text-xs text-navy/50">
              <span>First attempt</span>
              <span>Most recent</span>
            </div>
          </div>

          <div className="card flex flex-col gap-2 p-5">
            <p className="font-medium text-navy">Recent attempts</p>
            {[...attempts].reverse().map((a) => (
              <div key={a.id} className="flex items-center justify-between border-b border-border py-2 text-sm last:border-0">
                <span className="text-navy">{a.examTitle}</span>
                <span className="font-medium text-teal">{a.score}%</span>
              </div>
            ))}
          </div>

          {categoryStats.length > 0 && (
            <div className="card flex flex-col gap-3 p-5">
              <p className="font-medium text-navy">By category</p>
              {categoryStats.map((c) => {
                const pct = c.total > 0 ? Math.round((c.correct / c.total) * 100) : 0;
                return (
                  <div key={c.name} className="flex flex-col gap-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-navy">{c.name}</span>
                      <span className="text-navy/60">
                        {c.correct}/{c.total} ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-border">
                      <div className="h-full bg-teal" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
