"use client";

import { useEffect, useState } from "react";
import { useRequireRole } from "@/lib/useRequireRole";
import { supabase, Profile } from "@/lib/supabaseClient";
import { QuestionInquiry, Question } from "@/lib/types";

interface EnrichedInquiry extends QuestionInquiry {
  questionText: string;
  studentName: string;
}

export default function InquiriesInboxPage() {
  const { profile, loading } = useRequireRole(["ADMIN", "INSTRUCTOR"]);
  const [inquiries, setInquiries] = useState<EnrichedInquiry[]>([]);
  const [fetching, setFetching] = useState(true);
  const [filter, setFilter] = useState<"OPEN" | "RESOLVED" | "ALL">("OPEN");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  async function load() {
    setFetching(true);
    const { data } = await supabase
      .from("question_inquiries")
      .select("*")
      .order("created_at", { ascending: false });
    const rows = (data as QuestionInquiry[]) ?? [];

    const questionIds = Array.from(new Set(rows.map((r) => r.question_id)));
    const studentIds = Array.from(new Set(rows.map((r) => r.student_id)));

    const [{ data: questions }, { data: students }] = await Promise.all([
      questionIds.length
        ? supabase.from("questions").select("*").in("id", questionIds)
        : Promise.resolve({ data: [] as Question[] }),
      studentIds.length
        ? supabase.from("profiles").select("*").in("id", studentIds)
        : Promise.resolve({ data: [] as Profile[] }),
    ]);

    const qById = new Map((questions as Question[]).map((q) => [q.id, q]));
    const sById = new Map((students as Profile[]).map((s) => [s.id, s]));

    setInquiries(
      rows.map((r) => ({
        ...r,
        questionText: qById.get(r.question_id)?.text_en ?? "(question removed)",
        studentName: sById.get(r.student_id)?.name ?? "Student",
      }))
    );
    setFetching(false);
  }

  async function handleReply(inquiryId: string) {
    const message = replyDrafts[inquiryId]?.trim();
    if (!message) return;
    setSaving(inquiryId);
    const { error } = await supabase
      .from("question_inquiries")
      .update({ instructor_response: message, status: "RESOLVED" })
      .eq("id", inquiryId);
    setSaving(null);
    if (error) {
      alert(error.message);
      return;
    }
    setInquiries((prev) =>
      prev.map((i) => (i.id === inquiryId ? { ...i, instructor_response: message, status: "RESOLVED" } : i))
    );
  }

  const filtered = inquiries.filter((i) => (filter === "ALL" ? true : i.status === filter));

  if (loading || !profile) return <p className="text-navy/60">Loading…</p>;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-navy">Question Inquiries</h1>

      <div className="flex gap-2">
        {(["OPEN", "RESOLVED", "ALL"] as const).map((f) => (
          <span key={f} className="pill-card" data-selected={filter === f} onClick={() => setFilter(f)}>
            {f === "OPEN" ? "Open" : f === "RESOLVED" ? "Resolved" : "All"}
          </span>
        ))}
      </div>

      {fetching ? (
        <p className="text-navy/60">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-navy/60">No inquiries here.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map((inq) => (
            <div key={inq.id} className="card flex flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-navy/50">
                    {inq.studentName} · {new Date(inq.created_at).toLocaleDateString()}
                  </p>
                  <p className="mt-1 font-medium text-navy">{inq.questionText}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                    inq.status === "OPEN" ? "bg-teal/15 text-teal" : "bg-border text-navy/60"
                  }`}
                >
                  {inq.status}
                </span>
              </div>

              <div className="rounded-lg bg-canvas-alt p-3 text-sm text-navy/80">{inq.message}</div>

              {inq.instructor_response ? (
                <div className="rounded-lg border border-teal/30 bg-teal/5 p-3 text-sm">
                  <p className="mb-1 text-xs font-medium text-teal">Your reply</p>
                  {inq.instructor_response}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <textarea
                    value={replyDrafts[inq.id] ?? ""}
                    onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [inq.id]: e.target.value }))}
                    placeholder="Write a reply…"
                    className="min-h-[70px] rounded-lg border border-border px-3 py-2 text-sm"
                  />
                  <button
                    onClick={() => handleReply(inq.id)}
                    disabled={saving === inq.id}
                    className="self-start rounded-card bg-teal px-4 py-2 text-sm font-medium text-white hover:bg-teal-light disabled:opacity-60"
                  >
                    {saving === inq.id ? "Sending…" : "Send reply & mark resolved"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
