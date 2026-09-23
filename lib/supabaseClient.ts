import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fails loudly in dev if .env.local hasn't been set up yet.
  console.warn(
    "Supabase env vars are missing. Copy .env.local.example to .env.local and fill in your project's URL/anon key."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Role = "ADMIN" | "INSTRUCTOR" | "STUDENT" | "PARENT";

export interface Profile {
  id: string;
  email: string;
  name: string;
  role: Role;
  grade_level: number | null;
  created_at: string;
}
