"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useRequireRole } from "@/lib/useRequireRole";
import { supabase } from "@/lib/supabaseClient";
import { Exam, Question } from "@/lib/types";

const LETTERS = ["A", "B", "C", "D"];

export default function ExamPrintPage() {
  const { examId } = useParams<{ examId: string }>();
  const { profile, loading } = useRequireRole(["ADMIN", "INSTRUCTOR"]);

  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [mode, setMode] = useState<"STUDENT" | "TEACHER">("STUDENT");
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!profile) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, examId]);

  async function load() {
    setFetching(true);
    const { data: examData } = await supabase.from("exams").select("*").eq("id", examId).single();
    setExam(examData as Exam);

    const { data: linkRows } = await supabase
      .from("exam_questions")
      .select("question_id, sequence")
      .eq("exam_id", examId)
      .order("sequence", { ascending: true });

    const ids = (linkRows ?? []).map((r: { question_id: string }) => r.question_id);
    if (ids.length > 0) {
      const { data: qData } = await supabase.from("questions").select("*").in("id", ids);
      const byId = new Map((qData as Question[]).map((q) => [q.id, q]));
      setQuestions(ids.map((id: string) => byId.get(id)!).filter(Boolean));
    }
    setFetching(false);
  }

  if (loading || fetching) return <p className="text-navy/60">Loading…</p>;
  if (!exam) return <p className="text-red-600">Exam not found.</p>;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-navy">Print: {exam.title_en}</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setMode("STUDENT")}
            className={`rounded-card px-4 py-2 text-sm font-medium ${
              mode === "STUDENT" ? "bg-navy text-white" : "border border-border text-navy"
            }`}
          >
            Student Exam Mode
          </button>
          <button
            onClick={() => setMode("TEACHER")}
            className={`rounded-card px-4 py-2 text-sm font-medium ${
              mode === "TEACHER" ? "bg-navy text-white" : "border border-border text-navy"
            }`}
          >
            Teacher Key Mode
          </button>
          <button
            onClick={() => window.print()}
            className="rounded-card bg-teal px-4 py-2 text-sm font-medium text-white hover:bg-teal-light"
          >
            Print / Save as PDF
          </button>
        </div>
      </div>

      {/* Printable sheet */}
      <div className="print-sheet flex flex-col gap-6 bg-white p-8 text-black">
        <div className="flex items-center justify-between border-b-2 border-black pb-3">
          <div>
            <p className="text-xl font-bold">{exam.title_en}</p>
            <p className="text-sm text-gray-600">
              {questions.length} questions · {exam.calculated_time_minutes} minutes
              {mode === "TEACHER" ? " · TEACHER ANSWER KEY" : ""}
            </p>
          </div>
          <div className="text-right text-xs text-gray-500">GATway</div>
        </div>

        {mode === "STUDENT" && (
          <div className="grid grid-cols-2 gap-4 border-b border-gray-300 pb-4 text-sm">
            <p>Name: ________________________________</p>
            <p>Date: ________________________________</p>
          </div>
        )}

        <div className="flex flex-col gap-6">
          {questions.map((q, i) => (
            <div key={q.id} className="break-inside-avoid">
              <div className="mb-1 flex items-baseline justify-between">
                <p className="font-medium">
                  {i + 1}. {q.text_en}
                </p>
                {mode === "TEACHER" && (
                  <span className="shrink-0 rounded-full border border-black px-2 py-0.5 text-xs">
                    {q.difficulty}
                  </span>
                )}
              </div>
              <p className="mb-2 text-sm text-gray-600" dir="rtl">
                {q.text_ar}
              </p>

              <div className="ml-4 flex flex-col gap-1">
                {q.options_en.map((opt, idx) => {
                  const isCorrect = idx === q.correct_option_index;
                  return (
                    <div
                      key={idx}
                      className={`flex items-center gap-2 text-sm ${
                        mode === "TEACHER" && isCorrect ? "font-bold" : ""
                      }`}
                    >
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center border border-black text-xs">
                        {mode === "TEACHER" && isCorrect ? "✓" : LETTERS[idx]}
                      </span>
                      <span>{opt}</span>
                    </div>
                  );
                })}
              </div>

              {mode === "TEACHER" && (
                <div className="ml-4 mt-2 border-l-2 border-gray-300 pl-3 text-sm text-gray-700">
                  <p>
                    <strong>Why:</strong> {q.explanation_en}
                  </p>
                  <p dir="rtl" className="mt-1 text-gray-500">
                    {q.explanation_ar}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page {
            margin: 1.5cm;
          }
          body {
            background: white !important;
          }
          .print-sheet {
            padding: 0 !important;
          }
          .break-inside-avoid {
            break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}
