"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRequireRole } from "@/lib/useRequireRole";
import { supabase } from "@/lib/supabaseClient";
import { Question } from "@/lib/types";
import { calculateExamMinutes, balancedDifficultySplit } from "@/lib/examTimer";

const GRADES = Array.from({ length: 9 }, (_, i) => i + 4);

export default function NewExamPage() {
  const { profile, loading } = useRequireRole(["ADMIN", "INSTRUCTOR"]);
  const router = useRouter();

  const [mode, setMode] = useState<"MANUAL" | "AUTO">("AUTO");
  const [titleEn, setTitleEn] = useState("");
  const [titleAr, setTitleAr] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [grade, setGrade] = useState<number | "ALL">("ALL");
  const [pool, setPool] = useState<Question[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [autoCount, setAutoCount] = useState(20);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadPool();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grade]);

  async function loadPool() {
    let query = supabase.from("questions").select("*").order("created_at", { ascending: false });
    if (grade !== "ALL") query = query.eq("target_grade", grade);
    const { data } = await query;
    setPool((data as Question[]) ?? []);
  }

  function toggleSelect(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function runAutoBalance() {
    const { easy, medium, hard } = balancedDifficultySplit(autoCount);
    const byDifficulty = (d: string) => pool.filter((q) => q.difficulty === d);
    const pick = (arr: Question[], n: number) =>
      [...arr].sort(() => Math.random() - 0.5).slice(0, n);

    const chosen = [
      ...pick(byDifficulty("EASY"), easy),
      ...pick(byDifficulty("MEDIUM"), medium),
      ...pick(byDifficulty("HARD"), hard),
    ];

    if (chosen.length < autoCount) {
      setError(
        `Only found ${chosen.length} of ${autoCount} questions for this grade filter — add more questions to the pool, or lower the count.`
      );
    } else {
      setError(null);
    }
    setSelected(chosen.map((q) => q.id));
  }

  const questionCount = selected.length;
  const minutes = calculateExamMinutes(questionCount || 1);

  async function handleCreate() {
    if (!titleEn.trim() || !titleAr.trim()) {
      setError("Title is required in both languages.");
      return;
    }
    if (selected.length === 0) {
      setError("Select at least one question.");
      return;
    }
    setSaving(true);
    setError(null);

    const { data: exam, error: examErr } = await supabase
      .from("exams")
      .insert({
        creator_id: profile!.id,
        title_en: titleEn.trim(),
        title_ar: titleAr.trim(),
        is_public: isPublic,
        question_count: selected.length,
        calculated_time_minutes: calculateExamMinutes(selected.length),
      })
      .select()
      .single();

    if (examErr || !exam) {
      setError(examErr?.message ?? "Failed to create exam.");
      setSaving(false);
      return;
    }

    const rows = selected.map((question_id, i) => ({
      exam_id: (exam as { id: string }).id,
      question_id,
      sequence: i + 1,
    }));
    const { error: linkErr } = await supabase.from("exam_questions").insert(rows);
    if (linkErr) {
      setError(linkErr.message);
      setSaving(false);
      return;
    }

    router.push("/instructor/exams");
  }

  if (loading || !profile) return <p className="text-navy/60">Loading…</p>;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-navy">New Exam</h1>

      <div className="card grid gap-4 p-5 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-navy/80">Title (English)</span>
          <input
            value={titleEn}
            onChange={(e) => setTitleEn(e.target.value)}
            className="rounded-lg border border-border px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-navy/80">Title (Arabic)</span>
          <input
            value={titleAr}
            onChange={(e) => setTitleAr(e.target.value)}
            dir="rtl"
            className="rounded-lg border border-border px-3 py-2"
          />
        </label>
      </div>

      <div className="card flex flex-wrap items-center gap-6 p-5">
        <label className="flex items-center gap-2 text-sm text-navy">
          Public exam
          <span
            className="switch"
            data-on={isPublic}
            role="switch"
            aria-checked={isPublic}
            onClick={() => setIsPublic((v) => !v)}
          >
            <span className="switch-thumb" />
          </span>
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-navy/80">Grade filter</span>
          <select
            value={grade}
            onChange={(e) => setGrade(e.target.value === "ALL" ? "ALL" : Number(e.target.value))}
            className="rounded-lg border border-border px-3 py-2"
          >
            <option value="ALL">All grades</option>
            {GRADES.map((g) => (
              <option key={g} value={g}>
                Grade {g}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setMode("AUTO")}
          className={`rounded-card px-4 py-2 text-sm font-medium ${
            mode === "AUTO" ? "bg-navy text-white" : "border border-border text-navy"
          }`}
        >
          Auto-Balanced Generator
        </button>
        <button
          onClick={() => setMode("MANUAL")}
          className={`rounded-card px-4 py-2 text-sm font-medium ${
            mode === "MANUAL" ? "bg-navy text-white" : "border border-border text-navy"
          }`}
        >
          Manual Selection
        </button>
      </div>

      {mode === "AUTO" ? (
        <div className="card flex flex-wrap items-end gap-4 p-5">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-navy/80">Number of questions</span>
            <input
              type="number"
              min={1}
              value={autoCount}
              onChange={(e) => setAutoCount(Number(e.target.value))}
              className="w-28 rounded-lg border border-border px-3 py-2"
            />
          </label>
          <p className="text-sm text-navy/60">
            Split: {balancedDifficultySplit(autoCount).easy} Easy /{" "}
            {balancedDifficultySplit(autoCount).medium} Medium /{" "}
            {balancedDifficultySplit(autoCount).hard} Hard
          </p>
          <button
            onClick={runAutoBalance}
            className="rounded-card bg-teal px-4 py-2 font-medium text-white hover:bg-teal-light"
          >
            Generate
          </button>
        </div>
      ) : (
        <div className="card flex flex-col gap-2 p-5">
          <p className="font-medium text-navy">
            Select questions ({selected.length} selected, {pool.length} available)
          </p>
          <div className="flex max-h-96 flex-col gap-2 overflow-y-auto">
            {pool.map((q) => (
              <label
                key={q.id}
                className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(q.id)}
                  onChange={() => toggleSelect(q.id)}
                  className="mt-1 h-4 w-4 accent-teal"
                />
                <span>
                  {q.text_en}
                  <span className="ml-2 text-navy/50">
                    (Grade {q.target_grade} · {q.difficulty})
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
        <p className="text-navy">
          <strong>{questionCount}</strong> questions selected · timer:{" "}
          <strong>{questionCount > 0 ? minutes : 0} min</strong> (⌈Q×25/24⌉)
        </p>
        {error && <p className="text-red-600">{error}</p>}
        <button
          onClick={handleCreate}
          disabled={saving}
          className="rounded-card bg-navy px-5 py-2.5 font-medium text-white hover:bg-navy-light disabled:opacity-60"
        >
          {saving ? "Creating…" : "Create Exam"}
        </button>
      </div>
    </div>
  );
}
