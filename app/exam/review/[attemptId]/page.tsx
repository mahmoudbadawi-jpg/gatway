"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useRequireRole } from "@/lib/useRequireRole";
import { supabase } from "@/lib/supabaseClient";
import { Exam, Question, StudentAttempt } from "@/lib/types";

export default function ExamReviewPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const { profile, loading } = useRequireRole(["ADMIN", "INSTRUCTOR", "STUDENT", "PARENT"]);

  const [attempt, setAttempt] = useState<StudentAttempt | null>(null);
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [fetching, setFetching] = useState(true);
  const [inquiring, setInquiring] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, attemptId]);

  async function load() {
    setFetching(true);
    const { data: attemptData } = await supabase
      .from("student_attempts")
      .select("*")
      .eq("id", attemptId)
      .single();
    if (!attemptData) {
      setFetching(false);
      return;
    }
    setAttempt(attemptData as StudentAttempt);

    const { data: examData } = await supabase
      .from("exams")
      .select("*")
      .eq("id", (attemptData as StudentAttempt).exam_id)
      .single();
    setExam(examData as Exam);

    const { data: linkRows } = await supabase
      .from("exam_questions")
      .select("question_id, sequence")
      .eq("exam_id", (attemptData as StudentAttempt).exam_id)
      .order("sequence", { ascending: true });
    const ids = (linkRows ?? []).map((r: { question_id: string }) => r.question_id);
    if (ids.length > 0) {
      const { data: qData } = await supabase.from("questions").select("*").in("id", ids);
      const byId = new Map((qData as Question[]).map((q) => [q.id, q]));
      setQuestions(ids.map((id: string) => byId.get(id)!).filter(Boolean));
    }
    setFetching(false);
  }

  async function submitInquiry(questionId: string) {
    const message = prompt("What would you like to ask your instructor about this question?");
    if (!message || !message.trim()) return;
    setInquiring(questionId);
    const { error } = await supabase.from("question_inquiries").insert({
      student_id: profile!.id,
      question_id: questionId,
      message: message.trim(),
    });
    setInquiring(null);
    if (error) alert(error.message);
    else alert("Inquiry sent to your instructor.");
  }

  if (loading || fetching) return <p className="text-navy/60">Loading results…</p>;
  if (!attempt || !exam) return <p className="text-red-600">Attempt not found.</p>;

  return (
    <div className="flex flex-col gap-6">
      <div className="card p-6 text-center">
        <p className="text-sm text-navy/60">{exam.title_en}</p>
        <p className="mt-1 text-4xl font-bold text-teal">{attempt.score}%</p>
        <p className="mt-1 text-sm text-navy/60">
          {attempt.status === "TIMED_OUT" ? "Time expired" : "Submitted"} ·{" "}
          {questions.length} questions
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {questions.map((q, i) => {
          const chosen = attempt.answers?.[q.id];
          const isCorrect = chosen === q.correct_option_index;
          return (
            <div key={q.id} className="card p-5">
              <div className="mb-3 flex items-start justify-between gap-3">
                <p className="font-medium text-navy">
                  {i + 1}. {q.text_en}
                </p>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                    isCorrect ? "bg-teal/15 text-teal" : "bg-red-100 text-red-600"
                  }`}
                >
                  {isCorrect ? "Correct" : "Incorrect"}
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                {q.options_en.map((opt, idx) => (
                  <div
                    key={idx}
                    className={`rounded-lg border p-2.5 text-sm ${
                      idx === q.correct_option_index
                        ? "border-teal bg-teal/5"
                        : idx === chosen
                        ? "border-red-300 bg-red-50"
                        : "border-border"
                    }`}
                  >
                    {opt}
                    {idx === q.correct_option_index && (
                      <span className="ml-2 text-xs font-medium text-teal">✓ Correct answer</span>
                    )}
                    {idx === chosen && idx !== q.correct_option_index && (
                      <span className="ml-2 text-xs font-medium text-red-600">Your answer</span>
                    )}
                  </div>
                ))}
              </div>

              <p className="mt-3 rounded-lg bg-canvas-alt p-3 text-sm text-navy/70">
                <strong>Explanation: </strong>
                {q.explanation_en}
              </p>

              <button
                onClick={() => submitInquiry(q.id)}
                disabled={inquiring === q.id}
                className="mt-3 text-sm font-medium text-teal hover:underline disabled:opacity-60"
              >
                {inquiring === q.id ? "Sending…" : "Inquire about this question"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
