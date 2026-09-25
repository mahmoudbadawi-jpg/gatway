"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRequireRole } from "@/lib/useRequireRole";
import { supabase } from "@/lib/supabaseClient";
import { Exam, StudentAttempt } from "@/lib/types";

export default function StudentExamsPage() {
  const { profile, loading } = useRequireRole(["ADMIN", "INSTRUCTOR", "STUDENT", "PARENT"]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [attempts, setAttempts] = useState<StudentAttempt[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!profile) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  async function load() {
    setFetching(true);
    const [{ data: examData }, { data: attemptData }] = await Promise.all([
      supabase.from("exams").select("*").eq("is_public", true).order("created_at", { ascending: false }),
      supabase.from("student_attempts").select("*").eq("student_id", profile!.id),
    ]);
    setExams((examData as Exam[]) ?? []);
    setAttempts((attemptData as StudentAttempt[]) ?? []);
    setFetching(false);
  }

  function attemptFor(examId: string) {
    return attempts.find((a) => a.exam_id === examId && a.status === "SUBMITTED");
  }

  if (loading || !profile) return <p className="text-navy/60">Loading…</p>;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-navy">Public Practice Tests</h1>

      {fetching ? (
        <p className="text-navy/60">Loading exams…</p>
      ) : exams.length === 0 ? (
        <p className="text-navy/60">No public exams available yet — check back soon.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {exams.map((exam) => {
            const done = attemptFor(exam.id);
            return (
              <div
                key={exam.id}
                className="card flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div>
                  <p className="font-medium text-navy">{exam.title_en}</p>
                  <p className="text-sm text-navy/60">
                    {exam.question_count} questions · {exam.calculated_time_minutes} min
                    {done ? ` · Last score: ${done.score}%` : ""}
                  </p>
                </div>
                <Link
                  href={`/exam/take/${exam.share_token}`}
                  className="rounded-card bg-teal px-4 py-2 text-sm font-medium text-white hover:bg-teal-light"
                >
                  {done ? "Retake" : "Start"}
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
