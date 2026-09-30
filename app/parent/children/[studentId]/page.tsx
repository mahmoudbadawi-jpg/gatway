"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useRequireRole } from "@/lib/useRequireRole";
import { supabase, Profile } from "@/lib/supabaseClient";
import { StudentAttempt } from "@/lib/types";

export default function ChildHistoryPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const { profile, loading } = useRequireRole(["ADMIN", "PARENT"]);

  const [child, setChild] = useState<Profile | null>(null);
  const [attempts, setAttempts] = useState<(StudentAttempt & { examTitle: string })[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!profile) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, studentId]);

  async function load() {
    setFetching(true);
    const { data: childData } = await supabase.from("profiles").select("*").eq("id", studentId).single();
    setChild(childData as Profile);

    const { data: attemptData } = await supabase
      .from("student_attempts")
      .select("*")
      .eq("student_id", studentId)
      .order("submitted_at", { ascending: false });

    const rows = (attemptData as StudentAttempt[]) ?? [];
    const examIds = Array.from(new Set(rows.map((a) => a.exam_id)));
    const { data: examData } = examIds.length
      ? await supabase.from("exams").select("id, title_en").in("id", examIds)
      : { data: [] as { id: string; title_en: string }[] };
    const titleById = new Map((examData ?? []).map((e: { id: string; title_en: string }) => [e.id, e.title_en]));

    setAttempts(rows.map((a) => ({ ...a, examTitle: titleById.get(a.exam_id) ?? "Exam" })));
    setFetching(false);
  }

  if (loading || fetching) return <p className="text-navy/60">Loading…</p>;
  if (!child) return <p className="text-red-600">This child isn't linked to your account.</p>;

  const submitted = attempts.filter((a) => a.status === "SUBMITTED");
  const avgScore =
    submitted.length > 0
      ? Math.round((submitted.reduce((sum, a) => sum + (a.score ?? 0), 0) / submitted.length) * 100) / 100
      : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy">{child.name}'s History</h1>
        <Link href="/parent/link" className="text-sm text-navy/60 hover:text-teal">
          ← All children
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-teal">{submitted.length}</p>
          <p className="text-sm text-navy/60">Exams completed</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-teal">{avgScore !== null ? `${avgScore}%` : "—"}</p>
          <p className="text-sm text-navy/60">Average score</p>
        </div>
      </div>

      <div className="card flex flex-col gap-2 p-5">
        <p className="font-medium text-navy">Trial history</p>
        {attempts.length === 0 ? (
          <p className="text-sm text-navy/60">No attempts yet.</p>
        ) : (
          attempts.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between border-b border-border py-2.5 text-sm last:border-0"
            >
              <div>
                <p className="text-navy">{a.examTitle}</p>
                <p className="text-xs text-navy/50">
                  {a.submitted_at ? new Date(a.submitted_at).toLocaleDateString() : "In progress"} ·{" "}
                  {a.status}
                </p>
              </div>
              <span className="font-medium text-teal">{a.score !== null ? `${a.score}%` : "—"}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
