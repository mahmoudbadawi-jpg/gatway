# GATway

Bilingual (EN/AR) GAT — Qudurat — exam prep platform for Grades 4–12.
Next.js 14 (App Router) + TypeScript + Tailwind + Supabase.

## What's in this scaffold

- **Design system**: navy `#0A2540` / teal `#00A88F` / eye-comfort canvas `#F8FAFC`,
  wired into `tailwind.config.ts` and `app/globals.css` (light + dark/"eye comfort" tokens).
- **Sticky header** with the GATway logo, `EN ⇄ AR` language toggle (flips `dir`
  ltr/rtl live), and an eye-comfort theme switch — `components/Header.tsx`.
- **i18n**: lightweight dictionary-based i18n (no route segments) in `i18n/`,
  `en.json` / `ar.json` + `LanguageProvider`. Add keys as you build more screens.
- **Supabase**: full schema from the spec plus baseline RLS policies in
  `supabase/schema.sql`; browser client in `lib/supabaseClient.ts`.
- **Auth**: Google OAuth via Supabase (`lib/useAuth.ts`), a login page, and a
  `/dashboard` router that redirects each signed-in user to their role's portal.
- **Four portal stubs**: `/admin`, `/instructor`, `/parent`, `/student` — each
  lists its modules from the spec as cards, ready to build out.
- **Exam timer math**: `lib/examTimer.ts` implements `ceil(Q × 25/24)` and the
  30/50/20 easy/medium/hard auto-balance split.
- Footer: "All Rights Reserved © 2026 LingoBite Academy" on every page.

## Run it locally

```bash
npm install
cp .env.local.example .env.local   # fill in your Supabase URL + anon key
npm run dev
```

Then in Supabase: SQL Editor → paste `supabase/schema.sql` → Run. Enable the
Google provider under Authentication → Providers, and set the redirect URL to
`http://localhost:3000/dashboard` (and your production URL once deployed).

## What's NOT built yet (by design — this is a starting scaffold)

This spec describes a large platform. Still to build, module by module:

1. **Question Pool + Bulk CSV Importer** (bilingual parsing, grade/difficulty/category filters)
2. **Dual Print Engine** (`@media print` student sheet vs. teacher key)
3. **Exam Creator** (manual + auto-balanced generator, public/private toggle, share tokens)
4. **Active Exam Runner** (timer bar, flagging, autosave to `student_attempts`, submit warnings)
5. **Post-test review + question inquiries** thread between student and instructor
6. **Parent-child linking flows** (direct email link + class-claim link with student dropdown)
7. **Admin role management UI** + row-level-security hardening per table/role
8. **Class leaderboard + analytics** (score trends, category breakdown, ranking)

The schema, auth, design system, and routing skeleton are in place so each of
these can be built as an isolated feature without re-architecting the base.

## Deploy

- Push to GitHub, import into Vercel.
- Add `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` as Vercel
  environment variables.
- Update the Supabase Google OAuth redirect URL to your Vercel domain.
