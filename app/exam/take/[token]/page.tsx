"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useRequireRole } from "@/lib/useRequireRole";
import { supabase } from "@/lib/supabaseClient";
import { Exam, Question } from "@/lib/types";

export default function ExamRunnerPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { profile, loading } = useRequireRole(["ADMIN", "INSTRUCTOR", "STUDENT", "PARENT"]);

  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [current, setCurrent] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [showWarning, setShowWarning] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [startedAt] = useState(() => new Date().toISOString());

  useEffect(() => {
    if (!profile) return;
    void loadExam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, token]);

  async function loadExam() {
    setFetching(true);
    const { data: examData } = await supabase
      .from("exams")
      .select("*")
      .eq("share_token", token)
      .single();

    if (!examData) {
      setFetching(false);
      return;
    }
    setExam(examData as Exam);
    setSecondsLeft((examData as Exam).calculated_time_minutes * 60);

    const { data: linkRows } = await supabase
      .from("exam_questions")
      .select("question_id, sequence")
      .eq("exam_id", (examData as Exam).id)
      .order("sequence", { ascending: true });

    const ids = (linkRows ?? []).map((r: { question_id: string }) => r.question_id);
    if (ids.length > 0) {
      const { data: qData } = await supabase.from("questions").select("*").in("id", ids);
      const byId = new Map((qData as Question[]).map((q) => [q.id, q]));
      setQuestions(ids.map((id: string) => byId.get(id)!).filter(Boolean));
    }
    setFetching(false);
  }

  // Countdown timer
  useEffect(() => {
    if (secondsLeft === null) return;
    if (secondsLeft <= 0) {
      void handleSubmit(true);
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => (s !== null ? s - 1 : s)), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  const unanswered = useMemo(
    () => questions.filter((q) => answers[q.id] === undefined).length,
    [questions, answers]
  );

  function selectAnswer(questionId: string, optionIndex: number) {
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  }

  function toggleFlag(questionId: string) {
    setFlagged((prev) => {
      const next = new Set(prev);
      next.has(questionId) ? next.delete(questionId) : next.add(questionId);
      return next;
    });
  }

  function requestSubmit() {
    if (unanswered > 0 || flagged.size > 0) {
      setShowWarning(true);
    } else {
      void handleSubmit(false);
    }
  }

  async function handleSubmit(timedOut: boolean) {
    if (!exam || !profile) return;
    setSubmitting(true);

    let correct = 0;
    questions.forEach((q) => {
      if (answers[q.id] === q.correct_option_index) correct += 1;
    });
    const score = questions.length > 0 ? Math.round((correct / questions.length) * 10000) / 100 : 0;

    const { data, error } = await supabase
      .from("student_attempts")
      .insert({
        student_id: profile.id,
        exam_id: exam.id,
        score,
        answers,
        flagged: Array.from(flagged),
        status: timedOut ? "TIMED_OUT" : "SUBMITTED",
        started_at: startedAt,
        submitted_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error || !data) {
      alert(error?.message ?? "Failed to submit exam.");
      setSubmitting(false);
      return;
    }

    router.push(`/exam/review/${(data as { id: string }).id}`);
  }

  if (loading || fetching) return <p className="text-navy/60">Loading exam…</p>;
  if (!exam) return <p className="text-red-600">Exam not found — check the link and try again.</p>;
  if (questions.length === 0)
    return <p className="text-navy/60">This exam has no questions yet.</p>;

  const q = questions[current];
  const minutes = Math.floor((secondsLeft ?? 0) / 60);
  const seconds = (secondsLeft ?? 0) % 60;
  const progressPct = ((current + 1) / questions.length) * 100;

  return (
    <div className="flex flex-col gap-6">
      <div className="no-print sticky top-0 z-40 -mx-4 flex flex-col gap-2 bg-canvas/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-navy">
            Question {current + 1} of {questions.length}
          </span>
          <span
            className={`font-mono font-bold ${
              (secondsLeft ?? 0) < 60 ? "text-red-600" : "text-navy"
            }`}
          >
            {minutes}:{seconds.toString().padStart(2, "0")}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-border">
          <div
            className="h-full bg-teal transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <div className="card p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <p className="text-lg font-medium text-navy">{q.text_en}</p>
          <button
            onClick={() => toggleFlag(q.id)}
            className={`shrink-0 rounded-card border px-3 py-1.5 text-xs font-medium ${
              flagged.has(q.id)
                ? "border-teal bg-teal/10 text-teal"
                : "border-border text-navy/60"
            }`}
          >
            {flagged.has(q.id) ? "🚩 Flagged" : "Flag question"}
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {q.options_en.map((opt, i) => (
            <label
              key={i}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition ${
                answers[q.id] === i ? "border-teal bg-teal/5" : "border-border"
              }`}
            >
              <input
                type="radio"
                name={q.id}
                checked={answers[q.id] === i}
                onChange={() => selectAnswer(q.id, i)}
                className="h-4 w-4 accent-teal"
              />
              {opt}
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrent((c) => Math.max(0, c - 1))}
          disabled={current === 0}
          className="rounded-card border border-border px-4 py-2 text-navy disabled:opacity-40"
        >
          Previous
        </button>

        <div className="flex flex-wrap justify-center gap-1.5">
          {questions.map((qq, i) => (
            <button
              key={qq.id}
              onClick={() => setCurrent(i)}
              className={`h-8 w-8 rounded-full text-xs font-medium ${
                i === current
                  ? "bg-navy text-white"
                  : answers[qq.id] !== undefined
                  ? "bg-teal/20 text-teal"
                  : "bg-border text-navy/60"
              } ${flagged.has(qq.id) ? "ring-2 ring-teal" : ""}`}
            >
              {i + 1}
            </button>
          ))}
        </div>

        {current < questions.length - 1 ? (
          <button
            onClick={() => setCurrent((c) => Math.min(questions.length - 1, c + 1))}
            className="rounded-card bg-navy px-4 py-2 text-white"
          >
            Next
          </button>
        ) : (
          <button
            onClick={requestSubmit}
            disabled={submitting}
            className="rounded-card bg-teal px-5 py-2 font-medium text-white hover:bg-teal-light disabled:opacity-60"
          >
            {submitting ? "Submitting…" : "Submit exam"}
          </button>
        )}
      </div>

      {showWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card max-w-sm p-6">
            <h3 className="mb-2 font-semibold text-navy">Before you submit</h3>
            <p className="mb-4 text-sm text-navy/70">
              {unanswered > 0 && <>{unanswered} question(s) are unanswered. </>}
              {flagged.size > 0 && <>{flagged.size} question(s) are flagged for review. </>}
              Submit anyway?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowWarning(false)}
                className="rounded-card border border-border px-4 py-2 text-sm text-navy"
              >
                Go back
              </button>
              <button
                onClick={() => {
                  setShowWarning(false);
                  void handleSubmit(false);
                }}
                className="rounded-card bg-teal px-4 py-2 text-sm font-medium text-white"
              >
                Submit anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
