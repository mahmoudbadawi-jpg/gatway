import "server-only";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

/**
 * Server-only bridge that writes a completed exam/game result into
 * LingoTrace's Firestore project, so the score shows up in the LingoTrace
 * teacher dashboard and parent/student portals without either app needing
 * direct access to the other's database or auth. Shared by both GATway's
 * own client (same-origin call) and LingoBite Play's Supabase Database
 * Webhook (see /api/report-result/route.ts for how each authenticates).
 *
 * Requires the LINGOTRACE_FIREBASE_SERVICE_ACCOUNT env var: the full JSON
 * of a Firebase service account key for the LingoTrace project (Firebase
 * Console → Project Settings → Service Accounts → Generate new private
 * key), stored as a single-line JSON string. Never expose this key to the
 * client — it only ever runs here, in a server route.
 */
function getLingoTraceDb() {
  const raw = process.env.LINGOTRACE_FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    throw new Error(
      "LINGOTRACE_FIREBASE_SERVICE_ACCOUNT is not set — cannot report results to LingoTrace."
    );
  }
  const serviceAccount = JSON.parse(raw);
  const app =
    getApps().find((a) => a.name === "lingotrace") ??
    initializeApp({ credential: cert(serviceAccount) }, "lingotrace");
  return getFirestore(app);
}

/**
 * Writes/overwrites `linkedResults/{ref}` in LingoTrace's Firestore. Doc id
 * is the same `ref` token LingoTrace generated for the assignment+student,
 * so a resubmitted attempt just updates the same doc instead of duplicating.
 */
export async function reportResultToLingoTrace(params: {
  ref: string;
  source: "gatway" | "play";
  title: string;
  score: number;
}) {
  const db = getLingoTraceDb();
  await db
    .collection("linkedResults")
    .doc(params.ref)
    .set({
      source: params.source,
      title: params.title,
      score: params.score,
      completedAt: Date.now(),
    });
}
