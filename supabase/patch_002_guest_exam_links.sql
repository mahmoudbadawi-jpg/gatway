-- ============================================================
-- Guest exam-taking for LingoTrace-assigned exams.
--
-- LingoTrace teachers assign an exam by pasting its share link. The
-- student/parent opens that link with a `?ref=` token attached (LingoTrace
-- generates it, e.g. "{assignmentId}_{studentId}") and takes the exam
-- WITHOUT a GATway login. The score is scored server-side (never trust a
-- client-submitted score) and handed back to LingoTrace via a webhook —
-- see app/api/report-result/route.ts.
-- ============================================================

create table if not exists guest_attempts (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid references exams(id) on delete cascade,
  ref_token text not null,
  score numeric(5,2) not null,
  answers jsonb not null,
  flagged jsonb,
  status text check (status in ('SUBMITTED', 'TIMED_OUT')) not null,
  started_at timestamptz not null,
  submitted_at timestamptz default now(),
  unique (exam_id, ref_token) -- one attempt per assignment+student; resubmits overwrite
);

alter table guest_attempts enable row level security;
-- No direct client access at all — every read/write for guest attempts
-- goes through the two security-definer functions below, so RLS on this
-- table can stay fully closed.

-- Returns the single exam (+ its questions) matching a share token,
-- regardless of is_public/creator — safe because it only ever returns
-- the one row the caller already has the token for, never a list.
create or replace function get_exam_for_taking(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exam exams%rowtype;
  v_questions jsonb;
begin
  select * into v_exam from exams where share_token = p_token;
  if not found then
    return null;
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'id', q.id,
      'text_en', q.text_en,
      'text_ar', q.text_ar,
      'options_en', q.options_en,
      'options_ar', q.options_ar,
      'correct_option_index', q.correct_option_index
    ) order by eq.sequence
  )
  into v_questions
  from exam_questions eq
  join questions q on q.id = eq.question_id
  where eq.exam_id = v_exam.id;

  return jsonb_build_object(
    'exam', jsonb_build_object(
      'id', v_exam.id,
      'title_en', v_exam.title_en,
      'title_ar', v_exam.title_ar,
      'calculated_time_minutes', v_exam.calculated_time_minutes
    ),
    'questions', coalesce(v_questions, '[]'::jsonb)
  );
end;
$$;

grant execute on function get_exam_for_taking(uuid) to anon, authenticated;

-- Scores the attempt SERVER-SIDE (client only ever sends its answers, never
-- a score) and stores it. Returns the computed score so the exam page can
-- show a result screen immediately.
-- Postgres won't let CREATE OR REPLACE change a return type, and this
-- function already exists from the first run of this file (as `returns
-- numeric`) — drop it first so the fixed version below can replace it.
drop function if exists submit_guest_attempt(uuid, text, jsonb, jsonb, timestamptz, boolean);

create function submit_guest_attempt(
  p_token uuid,
  p_ref text,
  p_answers jsonb,      -- {"<question_id>": <option_index>, ...}
  p_flagged jsonb,
  p_started_at timestamptz,
  p_timed_out boolean
)
-- double precision, not numeric: Supabase/PostgREST serializes `numeric`
-- as a JSON STRING (e.g. "88.00") to avoid float rounding loss, which
-- silently failed the typeof score === "number" check in
-- /api/report-result and made every GATway score vanish with no error
-- anywhere. double precision serializes as a real JSON number instead.
returns double precision
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exam_id uuid;
  v_total int;
  v_correct int := 0;
  v_score numeric(5,2);
begin
  select id into v_exam_id from exams where share_token = p_token;
  if v_exam_id is null then
    raise exception 'exam not found for token';
  end if;

  select count(*) into v_total from exam_questions where exam_id = v_exam_id;

  select count(*) into v_correct
  from exam_questions eq
  join questions q on q.id = eq.question_id
  where eq.exam_id = v_exam_id
    and (p_answers ->> q.id::text)::int = q.correct_option_index;

  v_score := case when v_total > 0 then round((v_correct::numeric / v_total) * 10000) / 100 else 0 end;

  insert into guest_attempts (exam_id, ref_token, score, answers, flagged, status, started_at)
  values (
    v_exam_id, p_ref, v_score, p_answers, p_flagged,
    case when p_timed_out then 'TIMED_OUT' else 'SUBMITTED' end,
    p_started_at
  )
  on conflict (exam_id, ref_token) do update
    set score = excluded.score,
        answers = excluded.answers,
        flagged = excluded.flagged,
        status = excluded.status,
        submitted_at = now();

  return v_score::double precision;
end;
$$;

grant execute on function submit_guest_attempt(uuid, text, jsonb, jsonb, timestamptz, boolean) to anon, authenticated;
