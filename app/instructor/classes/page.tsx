"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRequireRole } from "@/lib/useRequireRole";
import { supabase } from "@/lib/supabaseClient";
import { ClassRow } from "@/lib/types";

export default function ClassesPage() {
  const { profile, loading } = useRequireRole(["ADMIN", "INSTRUCTOR"]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [studentCounts, setStudentCounts] = useState<Record<string, number>>({});
  const [fetching, setFetching] = useState(true);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!profile) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  async function load() {
    setFetching(true);
    const { data } = await supabase
      .from("classes")
      .select("*")
      .eq("instructor_id", profile!.id)
      .order("created_at", { ascending: false });
    const rows = (data as ClassRow[]) ?? [];
    setClasses(rows);

    if (rows.length > 0) {
      const { data: studentRows } = await supabase
        .from("class_students")
        .select("class_id")
        .in("class_id", rows.map((c) => c.id));
      const counts: Record<string, number> = {};
      (studentRows ?? []).forEach((r: { class_id: string }) => {
        counts[r.class_id] = (counts[r.class_id] ?? 0) + 1;
      });
      setStudentCounts(counts);
    }
    setFetching(false);
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    const { error } = await supabase
      .from("classes")
      .insert({ instructor_id: profile!.id, name: newName.trim() });
    setCreating(false);
    if (error) {
      alert(error.message);
      return;
    }
    setNewName("");
    void load();
  }

  function copyClaimLink(classId: string) {
    const url = `${window.location.origin}/parent/claim/${classId}`;
    navigator.clipboard.writeText(url);
    alert("Class Claim Link copied:\n" + url);
  }

  if (loading || !profile) return <p className="text-navy/60">Loading…</p>;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-navy">Classes</h1>

      <div className="card flex flex-wrap items-end gap-3 p-5">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-navy/80">New class name</span>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Grade 7 — Section A"
            className="w-64 rounded-lg border border-border px-3 py-2"
          />
        </label>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="rounded-card bg-teal px-4 py-2 font-medium text-white hover:bg-teal-light disabled:opacity-60"
        >
          {creating ? "Creating…" : "+ Create class"}
        </button>
      </div>

      {fetching ? (
        <p className="text-navy/60">Loading classes…</p>
      ) : classes.length === 0 ? (
        <p className="text-navy/60">No classes yet — create one above.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {classes.map((c) => (
            <div key={c.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium text-navy">{c.name}</p>
                <p className="text-sm text-navy/60">{studentCounts[c.id] ?? 0} students</p>
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/instructor/classes/${c.id}`}
                  className="rounded-card border border-border px-3 py-1.5 text-sm text-navy hover:border-teal"
                >
                  Manage
                </Link>
                <button
                  onClick={() => copyClaimLink(c.id)}
                  className="rounded-card border border-border px-3 py-1.5 text-sm text-navy hover:border-teal"
                >
                  Copy Class Claim Link
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
