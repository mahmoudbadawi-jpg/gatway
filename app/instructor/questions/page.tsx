"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRequireRole } from "@/lib/useRequireRole";
import { supabase } from "@/lib/supabaseClient";
import { Question, Difficulty } from "@/lib/types";

const GRADES = Array.from({ length: 9 }, (_, i) => i + 4); // 4..12

export default function QuestionPoolPage() {
  const { profile, loading } = useRequireRole(["ADMIN", "INSTRUCTOR"]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [fetching, setFetching] = useState(true);
  const [gradeFilter, setGradeFilter] = useState<number | "ALL">("ALL");
  const [difficultyFilter, setDifficultyFilter] = useState<Difficulty | "ALL">("ALL");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    void loadQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, gradeFilter, difficultyFilter]);

  async function loadQuestions() {
    setFetching(true);
    setError(null);
    let query = supabase.from("questions").select("*").order("created_at", { ascending: false });
    if (gradeFilter !== "ALL") query = query.eq("target_grade", gradeFilter);
    if (difficultyFilter !== "ALL") query = query.eq("difficulty", difficultyFilter);
    const { data, error: err } = await query;
    if (err) setError(err.message);
    setQuestions((data as Question[]) ?? []);
    setFetching(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this question? This cannot be undone.")) return;
    const { error: err } = await supabase.from("questions").delete().eq("id", id);
    if (err) {
      alert(err.message);
      return;
    }
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  }

  if (loading || !profile) return <p className="text-navy/60">Loading…</p>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-navy">Shared Question Pool</h1>
        <Link
          href="/instructor/questions/new"
          className="rounded-card bg-teal px-4 py-2 font-medium text-white hover:bg-teal-light"
        >
          + New Question
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <span
          className="pill-card"
          data-selected={gradeFilter === "ALL"}
          onClick={() => setGradeFilter("ALL")}
        >
          All grades
        </span>
        {GRADES.map((g) => (
          <span
            key={g}
            className="pill-card"
            data-selected={gradeFilter === g}
            onClick={() => setGradeFilter(g)}
          >
            Grade {g}
          </span>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {(["ALL", "EASY", "MEDIUM", "HARD"] as const).map((d) => (
          <span
            key={d}
            className="pill-card"
            data-selected={difficultyFilter === d}
            onClick={() => setDifficultyFilter(d)}
          >
            {d === "ALL" ? "All difficulties" : d}
          </span>
        ))}
      </div>

      {error && <p className="text-red-600">{error}</p>}
      {fetching ? (
        <p className="text-navy/60">Loading questions…</p>
      ) : questions.length === 0 ? (
        <p className="text-navy/60">No questions yet — add the first one.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {questions.map((q) => (
            <div key={q.id} className="card flex items-start justify-between gap-4 p-4">
              <div>
                <p className="font-medium text-navy">{q.text_en}</p>
                <p className="mt-1 text-sm text-navy/60">
                  Grade {q.target_grade} · {q.difficulty}
                </p>
              </div>
              <button
                onClick={() => handleDelete(q.id)}
                className="shrink-0 rounded-card border border-border px-3 py-1.5 text-sm text-navy/70 hover:border-red-400 hover:text-red-600"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
