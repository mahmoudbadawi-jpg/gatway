"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  admin: "Admin",
  instructor: "Instructor",
  parent: "Parent",
  student: "Student",
  questions: "Questions",
  exams: "Exams",
  new: "New",
  edit: "Edit",
  print: "Print",
  import: "Bulk Import",
  exam: "Exam",
  take: "Take",
  review: "Review",
};

function labelFor(segment: string) {
  return LABELS[segment] ?? segment.charAt(0).toUpperCase() + segment.slice(1);
}

export function Breadcrumbs() {
  const pathname = usePathname();
  if (!pathname || pathname === "/" || pathname === "/login") return null;

  const parts = pathname.split("/").filter(Boolean);
  let acc = "";
  const crumbs = parts
    .map((part) => {
      acc += `/${part}`;
      if (UUID_RE.test(part)) return null; // hide raw ids, but keep them in the href chain
      return { href: acc, label: labelFor(part) };
    })
    .filter((c): c is { href: string; label: string } => c !== null);

  if (crumbs.length === 0) return null;

  return (
    <nav className="no-print mb-4 flex flex-wrap items-center gap-1.5 text-sm text-navy/50">
      <Link href="/dashboard" className="hover:text-teal">
        Home
      </Link>
      {crumbs.map((c, i) => (
        <span key={c.href} className="flex items-center gap-1.5">
          <span aria-hidden>/</span>
          {i === crumbs.length - 1 ? (
            <span className="font-medium text-navy">{c.label}</span>
          ) : (
            <Link href={c.href} className="hover:text-teal">
              {c.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
