"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRequireRole } from "@/lib/useRequireRole";
import { supabase } from "@/lib/supabaseClient";
import { Exam } from "@/lib/types";

export default function InstructorExamsPage() {
  const { profile, loading } = useRequireRole(["ADMIN", "INSTRUCTOR"]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!profile) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  async function load() {
    setFetching(true);
    const { data } = await supabase
      .from("exams")
      .select("*")
      .eq("creator_id", profile!.id)
      .order("created_at", { ascending: false });
    setExams((data as Exam[]) ?? []);
    setFetching(false);
  }

  function copyShareLink(token: string) {
    const url = `${window.location.origin}/exam/take/${token}`;
    navigator.clipboard.writeText(url);
    alert("Share link copied:\n" + url);
  }

  if (loading || !profile) return <p className="text-navy/60">Loading…</p>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-navy">Exams</h1>
        <Link
          href="/instructor/exams/new"
          className="rounded-card bg-teal px-4 py-2 font-medium text-white hover:bg-teal-light"
        >
          + New Exam
        </Link>
      </div>

      {fetching ? (
        <p className="text-navy/60">Loading exams…</p>
      ) : exams.length === 0 ? (
        <p className="text-navy/60">No exams yet — create one from your question pool.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {exams.map((exam) => (
            <div key={exam.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium text-navy">{exam.title_en}</p>
                <p className="text-sm text-navy/60">
                  {exam.question_count} questions · {exam.calculated_time_minutes} min ·{" "}
                  {exam.is_public ? "Public" : "Private"}
                </p>
              </div>
              <button
                onClick={() => copyShareLink(exam.share_token)}
                className="rounded-card border border-border px-3 py-1.5 text-sm text-navy hover:border-teal"
              >
                Copy share link
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
