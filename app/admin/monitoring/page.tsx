"use client";

import { useEffect, useState } from "react";
import { useRequireRole } from "@/lib/useRequireRole";
import { supabase, Profile } from "@/lib/supabaseClient";
import { Exam, Question, StudentAttempt } from "@/lib/types";

interface ExamStat extends Exam {
  creatorName: string;
  attemptCount: number;
  avgScore: number | null;
}

interface RecentAttempt {
  id: string;
  studentName: string;
  examTitle: string;
  score: number | null;
  status: string;
  submitted_at: string | null;
}

export default function AdminMonitoringPage() {
  const { profile, loading } = useRequireRole(["ADMIN"]);
  const [fetching, setFetching] = useState(true);

  const [userCounts, setUserCounts] = useState<Record<string, number>>({});
  const [questionCount, setQuestionCount] = useState(0);
  const [examStats, setExamStats] = useState<ExamStat[]>([]);
  const [recentAttempts, setRecentAttempts] = useState<RecentAttempt[]>([]);

  useEffect(() => {
    if (!profile) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  async function load() {
    setFetching(true);

    const [{ data: profiles }, { data: questions }, { data: exams }, { data: attempts }] = await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("questions").select("*"),
      supabase.from("exams").select("*"),
      supabase.from("student_attempts").select("*").order("submitted_at", { ascending: false }),
    ]);

    const profileRows = (profiles as Profile[]) ?? [];
    const counts: Record<string, number> = {};
    profileRows.forEach((p) => (counts[p.role] = (counts[p.role] ?? 0) + 1));
    setUserCounts(counts);
    const profileById = new Map(profileRows.map((p) => [p.id, p]));

    setQuestionCount(((questions as Question[]) ?? []).length);

    const examRows = (exams as Exam[]) ?? [];
    const attemptRows = (attempts as StudentAttempt[]) ?? [];

    const attemptsByExam = new Map<string, number[]>();
    attemptRows.forEach((a) => {
      if (a.status !== "SUBMITTED") return;
      const list = attemptsByExam.get(a.exam_id) ?? [];
      list.push(a.score ?? 0);
      attemptsByExam.set(a.exam_id, list);
    });

    const stats: ExamStat[] = examRows
      .map((e) => {
        const scores = attemptsByExam.get(e.id) ?? [];
        return {
          ...e,
          creatorName: profileById.get(e.creator_id)?.name ?? "Unknown",
          attemptCount: scores.length,
          avgScore: scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100 : null,
        };
      })
      .sort((a, b) => b.attemptCount - a.attemptCount);
    setExamStats(stats);

    const examTitleById = new Map(examRows.map((e) => [e.id, e.title_en]));
    setRecentAttempts(
      attemptRows.slice(0, 15).map((a) => ({
        id: a.id,
        studentName: profileById.get(a.student_id)?.name ?? "Student",
        examTitle: examTitleById.get(a.exam_id) ?? "Exam",
        score: a.score,
        status: a.status,
        submitted_at: a.submitted_at,
      }))
    );

    setFetching(false);
  }

  if (loading || !profile) return <p className="text-navy/60">Loading…</p>;

  const totalUsers = Object.values(userCounts).reduce((a, b) => a + b, 0);
  const publicExams = examStats.filter((e) => e.is_public).length;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-navy">Global Monitoring</h1>

      {fetching ? (
        <p className="text-navy/60">Loading platform data…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Total users" value={totalUsers} />
            <StatCard label="Instructors" value={userCounts.INSTRUCTOR ?? 0} />
            <StatCard label="Students" value={userCounts.STUDENT ?? 0} />
            <StatCard label="Parents" value={userCounts.PARENT ?? 0} />
            <StatCard label="Questions in pool" value={questionCount} />
            <StatCard label="Total exams" value={examStats.length} />
            <StatCard label="Public exams" value={publicExams} />
            <StatCard label="Total attempts" value={recentAttempts.length > 0 ? examStats.reduce((s, e) => s + e.attemptCount, 0) : 0} />
          </div>

          <div className="card overflow-x-auto p-2">
            <p className="px-3 pt-3 font-medium text-navy">All exams</p>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-navy/60">
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2">Creator</th>
                  <th className="px-3 py-2">Visibility</th>
                  <th className="px-3 py-2">Questions</th>
                  <th className="px-3 py-2">Attempts</th>
                  <th className="px-3 py-2">Avg score</th>
                </tr>
              </thead>
              <tbody>
                {examStats.map((e) => (
                  <tr key={e.id} className="border-t border-border">
                    <td className="px-3 py-2 text-navy">{e.title_en}</td>
                    <td className="px-3 py-2 text-navy/70">{e.creatorName}</td>
                    <td className="px-3 py-2 text-navy/70">{e.is_public ? "Public" : "Private"}</td>
                    <td className="px-3 py-2 text-navy/70">{e.question_count}</td>
                    <td className="px-3 py-2 text-navy/70">{e.attemptCount}</td>
                    <td className="px-3 py-2 text-navy/70">{e.avgScore !== null ? `${e.avgScore}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card flex flex-col gap-2 p-5">
            <p className="font-medium text-navy">Recent attempts (platform-wide)</p>
            {recentAttempts.length === 0 ? (
              <p className="text-sm text-navy/60">No attempts yet.</p>
            ) : (
              recentAttempts.map((a) => (
                <div key={a.id} className="flex items-center justify-between border-b border-border py-2 text-sm last:border-0">
                  <div>
                    <span className="text-navy">{a.studentName}</span>
                    <span className="text-navy/50"> · {a.examTitle}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-navy/50">{a.status}</span>
                    <span className="font-medium text-teal">{a.score !== null ? `${a.score}%` : "—"}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-4 text-center">
      <p className="text-2xl font-bold text-teal">{value}</p>
      <p className="text-sm text-navy/60">{label}</p>
    </div>
  );
}
