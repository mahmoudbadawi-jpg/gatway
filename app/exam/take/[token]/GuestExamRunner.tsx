"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface GuestQuestion {
  id: string;
  text_en: string;
  text_ar: string;
  options_en: string[];
  options_ar: string[];
}

interface GuestExam {
  id: string;
  title_en: string;
  title_ar: string;
  calculated_time_minutes: number;
}

/**
 * Takes an exam with no GATway account at all — reached from a LingoTrace
 * parent/student portal button. `ref` is the token LingoTrace generated for
 * this (assignment, student) pair; it's passed straight through to scoring
 * so the result can be reported back to the right LingoTrace student.
 */
export default function GuestExamRunner({ token, ref }: { token: string; ref: string }) {
  const [exam, setExam] = useState<GuestExam | null>(null);
  const [questions, setQuestions] = useState<GuestQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [current, setCurrent] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [fetching, setFetching] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [startedAt] = useState(() => new Date().toISOString());

  useEffect(() => {
    void loadExam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function loadExam() {
    setFetching(true);
    const { data, error } = await supabase.rpc("get_exam_for_taking", { p_token: token });
    if (error || !data) {
      setNotFound(true);
      setFetching(false);
      return;
    }
    setExam(data.exam);
    setQuestions(data.questions ?? []);
    setSecondsLeft(data.exam.calculated_time_minutes * 60);
    setFetching(false);
  }

  useEffect(() => {
    if (secondsLeft === null || result !== null) return;
    if (secondsLeft <= 0) {
      void handleSubmit(true);
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => (s !== null ? s - 1 : s)), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, result]);

  const unanswered = useMemo(
    () => questions.filter((q) => answers[q.id] === undefined).length,
    [questions, answers]
  );

  async function handleSubmit(timedOut: boolean) {
    if (!exam || submitting || result !== null) return;
    setSubmitting(true);

    const { data: score, error } = await supabase.rpc("submit_guest_attempt", {
      p_token: token,
      p_ref: ref,
      p_answers: answers,
      p_flagged: [],
      p_started_at: startedAt,
      p_timed_out: timedOut,
    });

    if (error || score === null) {
      alert(error?.message ?? "Failed to submit exam. Please try the link again.");
      setSubmitting(false);
      return;
    }

    setResult(score as number);

    // Best-effort — the score is already safely stored in GATway either
    // way; this just relays it to LingoTrace so it shows up there too.
    fetch("/api/report-result", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ref, examId: exam.id, examTitle: exam.title_en, score }),
    }).catch(() => {
      // Nothing actionable to do here for the student; the score is safe.
    });

    setSubmitting(false);
  }

  if (fetching) return <p className="text-navy/60">Loading exam…</p>;
  if (notFound) return <p className="text-red-600">Exam not found — check the link and try again.</p>;
  if (questions.length === 0) return <p className="text-navy/60">This exam has no questions yet.</p>;

  if (result !== null) {
    return (
      <div className="card mx-auto max-w-sm p-6 text-center">
        <h2 className="mb-2 text-lg font-semibold text-navy">Exam submitted!</h2>
        <p className="mb-1 text-3xl font-bold text-teal">{result}%</p>
        <p className="text-sm text-navy/60">
          Your score has been sent to your teacher. You can close this page now.
        </p>
      </div>
    );
  }

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
          <span className={`font-mono font-bold ${(secondsLeft ?? 0) < 60 ? "text-red-600" : "text-navy"}`}>
            {minutes}:{seconds.toString().padStart(2, "0")}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-border">
          <div className="h-full bg-teal transition-all" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      <div className="card p-6">
        <p className="mb-4 text-lg font-medium text-navy">{q.text_en}</p>
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
                onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: i }))}
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

        {current < questions.length - 1 ? (
          <button
            onClick={() => setCurrent((c) => Math.min(questions.length - 1, c + 1))}
            className="rounded-card bg-navy px-4 py-2 text-white"
          >
            Next
          </button>
        ) : (
          <button
            onClick={() => {
              if (unanswered > 0 && !confirm(`${unanswered} question(s) unanswered. Submit anyway?`)) return;
              void handleSubmit(false);
            }}
            disabled={submitting}
            className="rounded-card bg-teal px-5 py-2 font-medium text-white hover:bg-teal-light disabled:opacity-60"
          >
            {submitting ? "Submitting…" : "Submit exam"}
          </button>
        )}
      </div>
    </div>
  );
}
