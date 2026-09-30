"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useRequireRole } from "@/lib/useRequireRole";
import { supabase, Profile } from "@/lib/supabaseClient";
import { ClassRow, Exam } from "@/lib/types";

export default function ClassDetailPage() {
  const { classId } = useParams<{ classId: string }>();
  const { profile, loading } = useRequireRole(["ADMIN", "INSTRUCTOR"]);

  const [cls, setCls] = useState<ClassRow | null>(null);
  const [roster, setRoster] = useState<Profile[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [assignedExamIds, setAssignedExamIds] = useState<Set<string>>(new Set());
  const [emailInput, setEmailInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!profile) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, classId]);

  async function load() {
    setFetching(true);
    const { data: classData } = await supabase.from("classes").select("*").eq("id", classId).single();
    setCls(classData as ClassRow);

    const { data: rosterLinks } = await supabase
      .from("class_students")
      .select("student_id")
      .eq("class_id", classId);
    const studentIds = (rosterLinks ?? []).map((r: { student_id: string }) => r.student_id);
    if (studentIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("*").in("id", studentIds);
      setRoster((profiles as Profile[]) ?? []);
    } else {
      setRoster([]);
    }

    const { data: examData } = await supabase
      .from("exams")
      .select("*")
      .eq("creator_id", profile!.id)
      .order("created_at", { ascending: false });
    setExams((examData as Exam[]) ?? []);

    const { data: assignments } = await supabase
      .from("exam_assignments")
      .select("exam_id")
      .eq("class_id", classId);
    setAssignedExamIds(new Set((assignments ?? []).map((a: { exam_id: string }) => a.exam_id)));

    setFetching(false);
  }

  async function handleAddStudent() {
    if (!emailInput.trim()) return;
    setAdding(true);
    setAddError(null);

    const { data: found, error: rpcErr } = await supabase.rpc("find_user_by_email", {
      target_email: emailInput.trim(),
      expected_role: "STUDENT",
    });

    if (rpcErr || !found || found.length === 0) {
      setAddError("No student found with that email.");
      setAdding(false);
      return;
    }

    const studentId = found[0].id;
    const { error } = await supabase.from("class_students").insert({
      class_id: classId,
      student_id: studentId,
    });
    setAdding(false);
    if (error) {
      setAddError(error.message);
      return;
    }
    setEmailInput("");
    void load();
  }

  async function handleRemoveStudent(studentId: string) {
    if (!confirm("Remove this student from the class?")) return;
    await supabase.from("class_students").delete().eq("class_id", classId).eq("student_id", studentId);
    setRoster((prev) => prev.filter((r) => r.id !== studentId));
  }

  async function toggleAssignment(examId: string) {
    if (assignedExamIds.has(examId)) {
      await supabase.from("exam_assignments").delete().eq("exam_id", examId).eq("class_id", classId);
      setAssignedExamIds((prev) => {
        const next = new Set(prev);
        next.delete(examId);
        return next;
      });
    } else {
      const { error } = await supabase.from("exam_assignments").insert({ exam_id: examId, class_id: classId });
      if (error) {
        alert(error.message);
        return;
      }
      setAssignedExamIds((prev) => new Set(prev).add(examId));
    }
  }

  if (loading || fetching) return <p className="text-navy/60">Loading…</p>;
  if (!cls) return <p className="text-red-600">Class not found.</p>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy">{cls.name}</h1>
        <Link href="/instructor/classes" className="text-sm text-navy/60 hover:text-teal">
          ← All classes
        </Link>
      </div>

      <div className="card flex flex-col gap-3 p-5">
        <p className="font-medium text-navy">Roster ({roster.length} students)</p>
        {roster.length === 0 ? (
          <p className="text-sm text-navy/60">No students yet — add one by email below.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {roster.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-lg border border-border p-2.5 text-sm">
                <span>
                  {s.name} <span className="text-navy/50">({s.email})</span>
                </span>
                <button
                  onClick={() => handleRemoveStudent(s.id)}
                  className="text-red-600 hover:underline"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-end gap-2 pt-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-navy/80">Add student by email</span>
            <input
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="student@example.com"
              className="w-64 rounded-lg border border-border px-3 py-2"
            />
          </label>
          <button
            onClick={handleAddStudent}
            disabled={adding}
            className="rounded-card bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-light disabled:opacity-60"
          >
            {adding ? "Adding…" : "Add"}
          </button>
        </div>
        {addError && <p className="text-sm text-red-600">{addError}</p>}
        <p className="text-xs text-navy/50">
          The student must already have signed into GATway at least once (so their account exists)
          before you can add them by email.
        </p>
      </div>

      <div className="card flex flex-col gap-3 p-5">
        <p className="font-medium text-navy">Assign exams to this class</p>
        {exams.length === 0 ? (
          <p className="text-sm text-navy/60">You haven't created any exams yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {exams.map((exam) => (
              <label
                key={exam.id}
                className="flex items-center gap-3 rounded-lg border border-border p-2.5 text-sm"
              >
                <input
                  type="checkbox"
                  checked={assignedExamIds.has(exam.id)}
                  onChange={() => toggleAssignment(exam.id)}
                  className="h-4 w-4 accent-teal"
                />
                {exam.title_en}
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
