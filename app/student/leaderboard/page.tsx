"use client";

import { useEffect, useState } from "react";
import { useRequireRole } from "@/lib/useRequireRole";
import { supabase, Profile } from "@/lib/supabaseClient";
import { ClassRow, StudentAttempt } from "@/lib/types";

interface Ranked {
  studentId: string;
  name: string;
  avgScore: number;
  attemptCount: number;
}

export default function LeaderboardPage() {
  const { profile, loading } = useRequireRole(["ADMIN", "INSTRUCTOR", "STUDENT", "PARENT"]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [ranked, setRanked] = useState<Ranked[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!profile) return;
    void loadClasses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  useEffect(() => {
    if (selectedClass) void loadLeaderboard(selectedClass);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClass]);

  async function loadClasses() {
    setFetching(true);
    const { data: links } = await supabase
      .from("class_students")
      .select("class_id")
      .eq("student_id", profile!.id);
    const classIds = (links ?? []).map((r: { class_id: string }) => r.class_id);
    if (classIds.length === 0) {
      setFetching(false);
      return;
    }
    const { data: classData } = await supabase.from("classes").select("*").in("id", classIds);
    setClasses((classData as ClassRow[]) ?? []);
    setSelectedClass(classIds[0]);
  }

  async function loadLeaderboard(classId: string) {
    setFetching(true);
    const { data: rosterLinks } = await supabase
      .from("class_students")
      .select("student_id")
      .eq("class_id", classId);
    const studentIds = (rosterLinks ?? []).map((r: { student_id: string }) => r.student_id);
    if (studentIds.length === 0) {
      setRanked([]);
      setFetching(false);
      return;
    }

    const [{ data: profiles }, { data: attempts }] = await Promise.all([
      supabase.from("profiles").select("*").in("id", studentIds),
      supabase
        .from("student_attempts")
        .select("*")
        .in("student_id", studentIds)
        .eq("status", "SUBMITTED"),
    ]);

    const nameById = new Map((profiles as Profile[]).map((p) => [p.id, p.name]));
    const byStudent = new Map<string, number[]>();
    (attempts as StudentAttempt[]).forEach((a) => {
      const list = byStudent.get(a.student_id) ?? [];
      list.push(a.score ?? 0);
      byStudent.set(a.student_id, list);
    });

    const rows: Ranked[] = studentIds.map((id) => {
      const scores = byStudent.get(id) ?? [];
      const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      return {
        studentId: id,
        name: nameById.get(id) ?? "Student",
        avgScore: Math.round(avg * 100) / 100,
        attemptCount: scores.length,
      };
    });

    rows.sort((a, b) => b.avgScore - a.avgScore);
    setRanked(rows);
    setFetching(false);
  }

  if (loading || !profile) return <p className="text-navy/60">Loading…</p>;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-navy">Class Leaderboard</h1>

      {classes.length === 0 && !fetching ? (
        <p className="text-navy/60">You're not enrolled in a class yet — ask your instructor to add you.</p>
      ) : (
        <>
          {classes.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {classes.map((c) => (
                <span
                  key={c.id}
                  className="pill-card"
                  data-selected={selectedClass === c.id}
                  onClick={() => setSelectedClass(c.id)}
                >
                  {c.name}
                </span>
              ))}
            </div>
          )}

          {fetching ? (
            <p className="text-navy/60">Loading rankings…</p>
          ) : (
            <div className="card overflow-hidden">
              {ranked.map((r, i) => (
                <div
                  key={r.studentId}
                  className={`flex items-center justify-between border-b border-border p-4 last:border-0 ${
                    r.studentId === profile.id ? "bg-teal/5" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-center font-semibold text-navy/50">{i + 1}</span>
                    <span className="text-navy">
                      {r.name}
                      {r.studentId === profile.id ? " (you)" : ""}
                    </span>
                  </div>
                  <span className="font-medium text-teal">
                    {r.attemptCount > 0 ? `${r.avgScore}% avg` : "No attempts yet"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
