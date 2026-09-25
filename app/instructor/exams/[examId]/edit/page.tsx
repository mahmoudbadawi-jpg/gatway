"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useRequireRole } from "@/lib/useRequireRole";
import { supabase } from "@/lib/supabaseClient";
import { Question } from "@/lib/types";
import { calculateExamMinutes, balancedDifficultySplit } from "@/lib/examTimer";

const GRADES = Array.from({ length: 9 }, (_, i) => i + 4);

export default function EditExamPage() {
  const { examId } = useParams<{ examId: string }>();
  const { profile, loading } = useRequireRole(["ADMIN", "INSTRUCTOR"]);
  const router = useRouter();

  const [titleEn, setTitleEn] = useState("");
  const [titleAr, setTitleAr] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [grade, setGrade] = useState<number | "ALL">("ALL");
  const [pool, setPool] = useState<Question[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [autoCount, setAutoCount] = useState(20);
  const [mode, setMode] = useState<"MANUAL" | "AUTO">("MANUAL");
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFoundOrForbidden, setNotFoundOrForbidden] = useState(false);

  useEffect(() => {
    if (!profile) return;
    void loadExam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, examId]);

  useEffect(() => {
    void loadPool();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grade]);

  async function loadExam() {
    setFetching(true);
    const { data: exam } = await supabase.from("exams").select("*").eq("id", examId).single();
    if (!exam || (exam.creator_id !== profile!.id && profile!.role !== "ADMIN")) {
      setNotFoundOrForbidden(true);
      setFetching(false);
      return;
    }
    setTitleEn(exam.title_en);
    setTitleAr(exam.title_ar);
    setIsPublic(exam.is_public);

    const { data: linkRows } = await supabase
      .from("exam_questions")
      .select("question_id")
      .eq("exam_id", examId)
      .order("sequence", { ascending: true });
    setSelected((linkRows ?? []).map((r: { question_id: string }) => r.question_id));
    setFetching(false);
  }

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
    setSelected(chosen.map((q) => q.id));
  }

  const questionCount = selected.length;
  const minutes = calculateExamMinutes(questionCount || 1);

  async function handleSave() {
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

    const { error: updateErr } = await supabase
      .from("exams")
      .update({
        title_en: titleEn.trim(),
        title_ar: titleAr.trim(),
        is_public: isPublic,
        question_count: selected.length,
        calculated_time_minutes: calculateExamMinutes(selected.length),
      })
      .eq("id", examId);

    if (updateErr) {
      setError(updateErr.message);
      setSaving(false);
      return;
    }

    // Replace the question set: delete old links, insert the new selection.
    await supabase.from("exam_questions").delete().eq("exam_id", examId);
    const rows = selected.map((question_id, i) => ({
      exam_id: examId,
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

  if (loading || fetching) return <p className="text-navy/60">Loading…</p>;
  if (notFoundOrForbidden)
    return <p className="text-red-600">Exam not found, or you don't have permission to edit it.</p>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy">Edit Exam</h1>
        <Link href="/instructor/exams" className="text-sm text-navy/60 hover:text-teal">
          ← Back to exams
        </Link>
      </div>

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
          <span className="font-medium text-navy/80">Grade filter (for question list below)</span>
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
          onClick={() => setMode("MANUAL")}
          className={`rounded-card px-4 py-2 text-sm font-medium ${
            mode === "MANUAL" ? "bg-navy text-white" : "border border-border text-navy"
          }`}
        >
          Manual Selection
        </button>
        <button
          onClick={() => setMode("AUTO")}
          className={`rounded-card px-4 py-2 text-sm font-medium ${
            mode === "AUTO" ? "bg-navy text-white" : "border border-border text-navy"
          }`}
        >
          Re-generate (Auto-Balanced)
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
          <button
            onClick={runAutoBalance}
            className="rounded-card bg-teal px-4 py-2 font-medium text-white hover:bg-teal-light"
          >
            Regenerate (replaces current selection)
          </button>
        </div>
      ) : (
        <div className="card flex flex-col gap-2 p-5">
          <p className="font-medium text-navy">
            {selected.length} selected, {pool.length} available
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
          <strong>{questionCount}</strong> questions · timer:{" "}
          <strong>{questionCount > 0 ? minutes : 0} min</strong>
        </p>
        {error && <p className="text-red-600">{error}</p>}
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-card bg-navy px-5 py-2.5 font-medium text-white hover:bg-navy-light disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
