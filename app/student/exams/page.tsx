"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRequireRole } from "@/lib/useRequireRole";
import { supabase } from "@/lib/supabaseClient";
import { Exam, StudentAttempt } from "@/lib/types";

export default function StudentExamsPage() {
  const { profile, loading } = useRequireRole(["ADMIN", "INSTRUCTOR", "STUDENT", "PARENT"]);
  const [publicExams, setPublicExams] = useState<Exam[]>([]);
  const [assignedExams, setAssignedExams] = useState<Exam[]>([]);
  const [attempts, setAttempts] = useState<StudentAttempt[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!profile) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  async function load() {
    setFetching(true);

    const [{ data: examData }, { data: attemptData }, { data: classLinks }] = await Promise.all([
      supabase.from("exams").select("*").eq("is_public", true).order("created_at", { ascending: false }),
      supabase.from("student_attempts").select("*").eq("student_id", profile!.id),
      supabase.from("class_students").select("class_id").eq("student_id", profile!.id),
    ]);

    setAttempts((attemptData as StudentAttempt[]) ?? []);

    const classIds = (classLinks ?? []).map((r: { class_id: string }) => r.class_id);
    let assigned: Exam[] = [];
    if (classIds.length > 0) {
      const { data: assignmentRows } = await supabase
        .from("exam_assignments")
        .select("exam_id")
        .in("class_id", classIds);
      const examIds = Array.from(new Set((assignmentRows ?? []).map((r: { exam_id: string }) => r.exam_id)));
      if (examIds.length > 0) {
        const { data: assignedExamData } = await supabase.from("exams").select("*").in("id", examIds);
        assigned = (assignedExamData as Exam[]) ?? [];
      }
    }
    setAssignedExams(assigned);

    const assignedIds = new Set(assigned.map((e) => e.id));
    setPublicExams(((examData as Exam[]) ?? []).filter((e) => !assignedIds.has(e.id)));

    setFetching(false);
  }

  function attemptFor(examId: string) {
    return attempts.find((a) => a.exam_id === examId && a.status === "SUBMITTED");
  }

  if (loading || !profile) return <p className="text-navy/60">Loading…</p>;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold text-navy">Assigned by Your Class</h1>
        {fetching ? (
          <p className="text-navy/60">Loading…</p>
        ) : assignedExams.length === 0 ? (
          <p className="text-navy/60">No class-assigned exams yet.</p>
        ) : (
          <ExamList exams={assignedExams} attemptFor={attemptFor} />
        )}
      </div>

      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold text-navy">Public Practice Tests</h1>
        {fetching ? (
          <p className="text-navy/60">Loading…</p>
        ) : publicExams.length === 0 ? (
          <p className="text-navy/60">No public exams available yet — check back soon.</p>
        ) : (
          <ExamList exams={publicExams} attemptFor={attemptFor} />
        )}
      </div>
    </div>
  );
}

function ExamList({
  exams,
  attemptFor,
}: {
  exams: Exam[];
  attemptFor: (id: string) => StudentAttempt | undefined;
}) {
  return (
    <div className="flex flex-col gap-3">
      {exams.map((exam) => {
        const done = attemptFor(exam.id);
        return (
          <div key={exam.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
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
  );
}
