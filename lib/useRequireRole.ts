"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./useAuth";
import { Role } from "./supabaseClient";

export function useRequireRole(allowed: Role[]) {
  const { profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!profile) {
      router.replace("/login");
      return;
    }
    if (!allowed.includes(profile.role)) {
      router.replace("/dashboard");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, loading]);

  return { profile, loading };
}
