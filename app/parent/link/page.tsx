"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRequireRole } from "@/lib/useRequireRole";
import { supabase } from "@/lib/supabaseClient";
import { ParentStudentLink } from "@/lib/types";

interface LinkedChild {
  linkId: string;
  studentId: string;
  name: string;
  email: string;
}

export default function ParentLinkPage() {
  const { profile, loading } = useRequireRole(["ADMIN", "PARENT"]);
  const [children, setChildren] = useState<LinkedChild[]>([]);
  const [fetching, setFetching] = useState(true);
  const [email, setEmail] = useState("");
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  async function load() {
    setFetching(true);
    const { data: links } = await supabase
      .from("parent_student_links")
      .select("*")
      .eq("parent_id", profile!.id);
    const rows = (links as ParentStudentLink[]) ?? [];
    if (rows.length === 0) {
      setChildren([]);
      setFetching(false);
      return;
    }
    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .in("id", rows.map((r) => r.student_id));
    const byId = new Map((profiles ?? []).map((p: { id: string; name: string; email: string }) => [p.id, p]));
    setChildren(
      rows.map((r) => ({
        linkId: r.id,
        studentId: r.student_id,
        name: byId.get(r.student_id)?.name ?? "Student",
        email: byId.get(r.student_id)?.email ?? "",
      }))
    );
    setFetching(false);
  }

  async function handleLink() {
    if (!email.trim()) return;
    setLinking(true);
    setError(null);

    const { data: found, error: rpcErr } = await supabase.rpc("find_user_by_email", {
      target_email: email.trim(),
      expected_role: "STUDENT",
    });

    if (rpcErr || !found || found.length === 0) {
      setError("No student found with that email. Ask your child to sign in to GATway first.");
      setLinking(false);
      return;
    }

    const { error: linkErr } = await supabase.from("parent_student_links").insert({
      parent_id: profile!.id,
      student_id: found[0].id,
      status: "APPROVED",
    });
    setLinking(false);
    if (linkErr) {
      setError(linkErr.message);
      return;
    }
    setEmail("");
    void load();
  }

  async function handleUnlink(linkId: string) {
    if (!confirm("Remove this link?")) return;
    await supabase.from("parent_student_links").delete().eq("id", linkId);
    setChildren((prev) => prev.filter((c) => c.linkId !== linkId));
  }

  if (loading || !profile) return <p className="text-navy/60">Loading…</p>;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-navy">Linked Children</h1>

      <div className="card flex flex-col gap-3 p-5">
        <p className="font-medium text-navy">Link a child by email</p>
        <p className="text-sm text-navy/60">
          Enter your child's registered GATway email — they must have signed in at least once.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="child@example.com"
            className="w-64 rounded-lg border border-border px-3 py-2 text-sm"
          />
          <button
            onClick={handleLink}
            disabled={linking}
            className="rounded-card bg-teal px-4 py-2 text-sm font-medium text-white hover:bg-teal-light disabled:opacity-60"
          >
            {linking ? "Linking…" : "Link child"}
          </button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <p className="text-xs text-navy/50">
          Alternatively, if your child's instructor shared a Class Claim Link with you, open that
          link and select your child from the class roster instead.
        </p>
      </div>

      {fetching ? (
        <p className="text-navy/60">Loading…</p>
      ) : children.length === 0 ? (
        <p className="text-navy/60">No children linked yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {children.map((c) => (
            <div key={c.linkId} className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium text-navy">{c.name}</p>
                <p className="text-sm text-navy/60">{c.email}</p>
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/parent/children/${c.studentId}`}
                  className="rounded-card border border-border px-3 py-1.5 text-sm text-navy hover:border-teal"
                >
                  View history
                </Link>
                <button
                  onClick={() => handleUnlink(c.linkId)}
                  className="rounded-card border border-border px-3 py-1.5 text-sm text-navy/70 hover:border-red-400 hover:text-red-600"
                >
                  Unlink
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
