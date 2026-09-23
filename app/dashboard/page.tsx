"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";

const roleRoute: Record<string, string> = {
  ADMIN: "/admin",
  INSTRUCTOR: "/instructor",
  PARENT: "/parent",
  STUDENT: "/student",
};

export default function DashboardRouter() {
  const { profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!profile) {
      router.replace("/login");
      return;
    }
    router.replace(roleRoute[profile.role] ?? "/student");
  }, [profile, loading, router]);

  return <p className="text-center text-navy/60">Loading your dashboard…</p>;
}
