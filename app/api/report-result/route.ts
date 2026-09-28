import { NextRequest, NextResponse } from "next/server";
import { reportResultToLingoTrace } from "@/lib/lingotraceReport";

/**
 * Shared bridge into LingoTrace, called two different ways:
 *
 * 1. GATway's own GuestExamRunner calls this directly (same-origin fetch)
 *    right after scoring a guest attempt. Flat body: { ref, examId,
 *    examTitle, score }. No secret needed — a same-origin call can't
 *    safely carry one anyway (anything in the client bundle isn't secret).
 *
 * 2. LingoBite Play has no server of its own, so instead a Supabase
 *    Database Webhook (configured in Play's Supabase dashboard, not code)
 *    calls this URL whenever a row lands in `guest_game_results`. That
 *    request comes from Supabase's infrastructure, not a browser, so it
 *    CAN safely carry a secret — set one on the webhook's custom header
 *    and set the same value as WEBHOOK_SHARED_SECRET here. Supabase's
 *    default webhook payload shape is { type, table, record, schema }.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid JSON" }, { status: 400 });

  const isSupabaseWebhook = typeof body.record === "object" && body.record !== null;

  let payload: { ref: string; source: "gatway" | "play"; title: string; score: number };

  if (isSupabaseWebhook) {
    const expected = process.env.WEBHOOK_SHARED_SECRET;
    const provided = request.headers.get("x-webhook-secret");
    if (expected && provided !== expected) {
      return NextResponse.json({ error: "invalid webhook secret" }, { status: 401 });
    }

    const record = body.record;
    if (typeof record.ref_token !== "string" || typeof record.accuracy !== "number") {
      return NextResponse.json({ error: "unexpected webhook payload" }, { status: 400 });
    }
    payload = {
      ref: record.ref_token,
      source: "play",
      title: typeof record.content_set_title === "string" ? record.content_set_title : "",
      score: record.accuracy,
    };
  } else {
    const { ref, examId, examTitle, score } = body;
    if (typeof ref !== "string" || typeof examId !== "string" || typeof score !== "number") {
      return NextResponse.json({ error: "ref, examId, and score are required" }, { status: 400 });
    }
    payload = {
      ref,
      source: "gatway",
      title: typeof examTitle === "string" ? examTitle : "",
      score,
    };
  }

  try {
    await reportResultToLingoTrace(payload);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to report result to LingoTrace:", err);
    return NextResponse.json({ error: "Failed to reach LingoTrace" }, { status: 502 });
  }
}
