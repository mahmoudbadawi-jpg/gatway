"use client";

import { useEffect, useState } from "react";
import { useRequireRole } from "@/lib/useRequireRole";
import { supabase, Profile, Role } from "@/lib/supabaseClient";

const ROLES: Role[] = ["STUDENT", "INSTRUCTOR", "PARENT", "ADMIN"];

export default function AdminUsersPage() {
  const { profile, loading } = useRequireRole(["ADMIN"]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [fetching, setFetching] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  async function load() {
    setFetching(true);
    const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    setUsers((data as Profile[]) ?? []);
    setFetching(false);
  }

  async function changeRole(userId: string, role: Role) {
    setSavingId(userId);
    const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
    setSavingId(null);
    if (error) {
      alert(error.message);
      return;
    }
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
  }

  const counts = ROLES.reduce<Record<string, number>>((acc, r) => {
    acc[r] = users.filter((u) => u.role === r).length;
    return acc;
  }, {});

  if (loading || !profile) return <p className="text-navy/60">Loading…</p>;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-navy">User & Role Management</h1>

      <div className="flex flex-wrap gap-3">
        {ROLES.map((r) => (
          <div key={r} className="card px-4 py-2.5 text-sm">
            <span className="font-semibold text-navy">{counts[r] ?? 0}</span>{" "}
            <span className="text-navy/60">{r}</span>
          </div>
        ))}
      </div>

      {fetching ? (
        <p className="text-navy/60">Loading users…</p>
      ) : (
        <div className="card overflow-x-auto p-2">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-navy/60">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Grade</th>
                <th className="px-3 py-2">Role</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-border">
                  <td className="px-3 py-2 text-navy">{u.name}</td>
                  <td className="px-3 py-2 text-navy/70">{u.email}</td>
                  <td className="px-3 py-2 text-navy/70">{u.grade_level ?? "—"}</td>
                  <td className="px-3 py-2">
                    <select
                      value={u.role}
                      disabled={savingId === u.id}
                      onChange={(e) => changeRole(u.id, e.target.value as Role)}
                      className="rounded-lg border border-border px-2 py-1.5"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
