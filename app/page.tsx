import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center gap-6 py-16 text-center">
      <h1 className="text-4xl font-bold text-navy">GATway</h1>
      <p className="max-w-md text-navy/70">
        Bilingual GAT (Qudurat) exam prep for Grades 4–12 — question banks, timed exams, and
        progress tracking for students, instructors, and parents.
      </p>
      <Link
        href="/login"
        className="rounded-card bg-teal px-6 py-2.5 font-medium text-white transition hover:bg-teal-light"
      >
        Get started
      </Link>
    </div>
  );
}
