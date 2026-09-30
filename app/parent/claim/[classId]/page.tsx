"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useRequireRole } from "@/lib/useRequireRole";
import { supabase, Profile } from "@/lib/supabaseClient";
import { ClassRow } from "@/lib/types";

export default function ClassClaimPage() {
  const { classId } = useParams<{ classId: string }>();
  const { profile, loading } = useRequireRole(["ADMIN", "PARENT"]);
  const router = useRouter();

  const [cls, setCls] = useState<ClassRow | null>(null);
  const [roster, setRoster] = useState<Profile[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [fetching, setFetching] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

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
    }
    setFetching(false);
  }

  async function handleSubmit() {
    if (!selectedStudentId) {
      setError("Select your child from the list.");
      return;
    }
    setSubmitting(true);
    setError(null);

    const { error: err } = await supabase.from("parent_student_links").insert({
      parent_id: profile!.id,
      student_id: selectedStudentId,
      status: "APPROVED",
    });
    setSubmitting(false);
    if (err) {
      setError(err.message);
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/parent/link"), 1500);
  }

  if (loading || fetching) return <p className="text-navy/60">Loading…</p>;
  if (!cls) return <p className="text-red-600">This class link is invalid.</p>;

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <div className="card p-6 text-center">
        <h1 className="text-xl font-bold text-navy">Link Your Child</h1>
        <p className="mt-1 text-sm text-navy/60">Class: {cls.name}</p>
      </div>

      {done ? (
        <p className="text-center font-medium text-teal">Linked! Redirecting…</p>
      ) : (
        <div className="card flex flex-col gap-4 p-6">
          {roster.length === 0 ? (
            <p className="text-navy/60">This class has no enrolled students yet.</p>
          ) : (
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-navy/80">Select your child</span>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="rounded-lg border border-border px-3 py-2"
              >
                <option value="">— Choose —</option>
                {roster.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.email})
                  </option>
                ))}
              </select>
            </label>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            onClick={handleSubmit}
            disabled={submitting || roster.length === 0}
            className="rounded-card bg-teal px-4 py-2.5 font-medium text-white hover:bg-teal-light disabled:opacity-60"
          >
            {submitting ? "Linking…" : "Confirm link"}
          </button>
        </div>
      )}
    </div>
  );
}
