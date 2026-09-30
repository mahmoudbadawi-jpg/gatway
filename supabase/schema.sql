-- ============================================================
-- GATway database schema
-- Run in the Supabase SQL editor (or via `supabase db push`)
-- ============================================================

create extension if not exists "pgcrypto";

-- Profiles & Roles (ADMIN, INSTRUCTOR, STUDENT, PARENT)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  name text not null,
  role text check (role in ('ADMIN', 'INSTRUCTOR', 'STUDENT', 'PARENT')) default 'STUDENT',
  grade_level int, -- 4 to 12 (for students)
  created_at timestamptz default now()
);

-- Parent-Student Linking
create table parent_student_links (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references profiles(id) on delete cascade,
  student_id uuid references profiles(id) on delete cascade,
  status text check (status in ('PENDING', 'APPROVED')) default 'APPROVED',
  created_at timestamptz default now(),
  unique(parent_id, student_id)
);

-- Categories (Single or Mixed)
create table categories (
  id uuid primary key default gen_random_uuid(),
  name_en text not null,
  name_ar text not null,
  description text
);

-- Shared Question Pool
create table questions (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references profiles(id) on delete set null,
  text_en text not null,
  text_ar text not null,
  options_en jsonb not null,
  options_ar jsonb not null,
  correct_option_index int not null,
  explanation_en text not null,
  explanation_ar text not null,
  difficulty text check (difficulty in ('EASY', 'MEDIUM', 'HARD')) not null,
  target_grade int not null,
  created_at timestamptz default now()
);

create table question_categories (
  question_id uuid references questions(id) on delete cascade,
  category_id uuid references categories(id) on delete cascade,
  primary key (question_id, category_id)
);

create table classes (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid references profiles(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

create table class_students (
  class_id uuid references classes(id) on delete cascade,
  student_id uuid references profiles(id) on delete cascade,
  primary key (class_id, student_id)
);

create table exams (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references profiles(id) on delete cascade,
  title_en text not null,
  title_ar text not null,
  is_public boolean default false,
  question_count int not null,
  calculated_time_minutes int not null,
  share_token uuid unique default gen_random_uuid(),
  created_at timestamptz default now()
);

create table exam_questions (
  exam_id uuid references exams(id) on delete cascade,
  question_id uuid references questions(id) on delete cascade,
  sequence int not null,
  primary key (exam_id, question_id)
);

create table exam_assignments (
  exam_id uuid references exams(id) on delete cascade,
  class_id uuid references classes(id) on delete cascade,
  primary key (exam_id, class_id)
);

create table student_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references profiles(id) on delete cascade,
  exam_id uuid references exams(id) on delete cascade,
  score numeric(5,2),
  answers jsonb,
  flagged jsonb,
  status text check (status in ('IN_PROGRESS', 'SUBMITTED', 'TIMED_OUT')),
  started_at timestamptz default now(),
  submitted_at timestamptz
);

create table question_inquiries (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references profiles(id) on delete cascade,
  question_id uuid references questions(id) on delete cascade,
  message text not null,
  instructor_response text,
  status text default 'OPEN',
  created_at timestamptz default now()
);

-- ============================================================
-- Row Level Security (baseline — refine per module as you build)
-- ============================================================
alter table profiles enable row level security;
alter table parent_student_links enable row level security;
alter table questions enable row level security;
alter table exams enable row level security;
alter table student_attempts enable row level security;
alter table question_inquiries enable row level security;

-- Everyone can read their own profile; admins can read all.
create policy "read own profile" on profiles
  for select using (auth.uid() = id);

create policy "update own profile" on profiles
  for update using (auth.uid() = id);

-- Students can read/write only their own attempts.
create policy "own attempts" on student_attempts
  for all using (auth.uid() = student_id);

-- Public exams are readable by anyone signed in; private exams by creator only.
create policy "read exams" on exams
  for select using (is_public = true or auth.uid() = creator_id);

-- Instructors/Admins manage questions; everyone signed-in can read.
create policy "read questions" on questions
  for select using (auth.role() = 'authenticated');

create policy "instructors insert questions" on questions
  for insert with check (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('ADMIN', 'INSTRUCTOR'))
  );

create policy "instructors update questions" on questions
  for update using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('ADMIN', 'INSTRUCTOR'))
  );

create policy "instructors delete questions" on questions
  for delete using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('ADMIN', 'INSTRUCTOR'))
  );

create policy "instructors insert exams" on exams
  for insert with check (
    auth.uid() = creator_id
    and exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('ADMIN', 'INSTRUCTOR'))
  );

create policy "instructors update own exams" on exams
  for update using (auth.uid() = creator_id);

create policy "instructors delete own exams" on exams
  for delete using (auth.uid() = creator_id);
-- ============================================================
-- Patch 004: policies + one RPC function needed for:
--   Admin user/role management, Classes + Parent Linking,
--   Student Progress/Leaderboard, Instructor Inquiry Inbox.
--
-- Also fixes a pre-existing bug: question_inquiries had RLS
-- enabled since the original schema.sql but NO policies at
-- all, so "Inquire about this question" has been silently
-- failing since day one. This adds the missing policies.
-- ============================================================

-- Make sure RLS is on for every table this patch touches (safe to
-- re-run even if already enabled).
alter table classes enable row level security;
alter table class_students enable row level security;
alter table parent_student_links enable row level security;
alter table exam_assignments enable row level security;
alter table question_inquiries enable row level security;

-- ---------- Admin: read/update any profile ----------
create policy "admins read all profiles" on profiles
  for select using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'ADMIN')
  );

create policy "admins update all profiles" on profiles
  for update using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'ADMIN')
  );

-- ---------- Classes ----------
create policy "read classes" on classes
  for select using (auth.role() = 'authenticated');

create policy "instructors insert classes" on classes
  for insert with check (
    auth.uid() = instructor_id
    and exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('ADMIN', 'INSTRUCTOR'))
  );

create policy "instructors update own classes" on classes
  for update using (auth.uid() = instructor_id);

create policy "instructors delete own classes" on classes
  for delete using (auth.uid() = instructor_id);

-- ---------- Class students (roster) ----------
create policy "read class_students" on class_students
  for select using (auth.role() = 'authenticated');

create policy "instructor manage class_students insert" on class_students
  for insert with check (
    exists (select 1 from classes c where c.id = class_students.class_id and c.instructor_id = auth.uid())
  );

create policy "instructor manage class_students delete" on class_students
  for delete using (
    exists (select 1 from classes c where c.id = class_students.class_id and c.instructor_id = auth.uid())
  );

-- Instructors can see the profile (name) of students in their own classes.
create policy "instructors read own class students profiles" on profiles
  for select using (
    exists (
      select 1 from class_students cs
      join classes c on c.id = cs.class_id
      where c.instructor_id = auth.uid() and cs.student_id = profiles.id
    )
  );

-- ---------- Parent-student linking ----------
create policy "read own parent links" on parent_student_links
  for select using (
    auth.uid() = parent_id
    or auth.uid() = student_id
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'ADMIN')
  );

create policy "parent create link" on parent_student_links
  for insert with check (auth.uid() = parent_id);

create policy "parent delete own link" on parent_student_links
  for delete using (auth.uid() = parent_id);

-- Parents can see the profile of a child they're linked to.
create policy "parents read linked children profiles" on profiles
  for select using (
    exists (
      select 1 from parent_student_links l
      where l.parent_id = auth.uid() and l.student_id = profiles.id and l.status = 'APPROVED'
    )
  );

-- Parents can see a linked child's exam attempts (trial history).
create policy "parents read linked children attempts" on student_attempts
  for select using (
    exists (
      select 1 from parent_student_links l
      where l.parent_id = auth.uid() and l.student_id = student_attempts.student_id and l.status = 'APPROVED'
    )
  );

-- ---------- Exam assignments (assign an exam to a class) ----------
create policy "read exam_assignments" on exam_assignments
  for select using (auth.role() = 'authenticated');

create policy "instructor insert exam_assignments" on exam_assignments
  for insert with check (
    exists (select 1 from exams e where e.id = exam_assignments.exam_id and e.creator_id = auth.uid())
  );

create policy "instructor delete exam_assignments" on exam_assignments
  for delete using (
    exists (select 1 from exams e where e.id = exam_assignments.exam_id and e.creator_id = auth.uid())
  );

-- ---------- Leaderboard: classmates can see each other's scores/names ----------
create policy "classmates read attempts for leaderboard" on student_attempts
  for select using (
    exists (
      select 1 from class_students cs1
      join class_students cs2 on cs1.class_id = cs2.class_id
      where cs1.student_id = auth.uid() and cs2.student_id = student_attempts.student_id
    )
  );

create policy "classmates read profiles" on profiles
  for select using (
    exists (
      select 1 from class_students cs1
      join class_students cs2 on cs1.class_id = cs2.class_id
      where cs1.student_id = auth.uid() and cs2.student_id = profiles.id
    )
  );

-- ---------- Question inquiries (this was fully broken before) ----------
create policy "students insert own inquiries" on question_inquiries
  for insert with check (auth.uid() = student_id);

create policy "students read own inquiries" on question_inquiries
  for select using (auth.uid() = student_id);

create policy "instructors read inquiries on their questions" on question_inquiries
  for select using (
    exists (select 1 from questions q where q.id = question_inquiries.question_id and q.author_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'ADMIN')
  );

create policy "instructors update inquiries on their questions" on question_inquiries
  for update using (
    exists (select 1 from questions q where q.id = question_inquiries.question_id and q.author_id = auth.uid())
  );

-- Instructors need to see the name of whoever filed an inquiry on their question.
create policy "instructors read inquirer profiles" on profiles
  for select using (
    exists (
      select 1 from question_inquiries qi
      join questions q on q.id = qi.question_id
      where q.author_id = auth.uid() and qi.student_id = profiles.id
    )
  );

-- ---------- Safe email lookup (for "link by email" flows) ----------
-- Lets a parent look up a student's profile by email (to link),
-- or an instructor look up a student to add to a class, without
-- opening up general profile access. Only returns a match if the
-- target's role matches what's expected, and only exposes
-- id/name/email — nothing sensitive.
create or replace function public.find_user_by_email(target_email text, expected_role text)
returns table(id uuid, name text, email text)
language sql
security definer
set search_path = public
as $$
  select p.id, p.name, p.email
  from profiles p
  where p.email = target_email and p.role = expected_role
  limit 1;
$$;

grant execute on function public.find_user_by_email(text, text) to authenticated;

-- ---------- exam_questions (was missing entirely — added as patch_002) ----------
create policy "read exam_questions for readable exams" on exam_questions
  for select using (
    exists (
      select 1 from exams e
      where e.id = exam_questions.exam_id
        and (e.is_public = true or e.creator_id = auth.uid())
    )
  );

create policy "creator insert exam_questions" on exam_questions
  for insert with check (
    exists (select 1 from exams e where e.id = exam_questions.exam_id and e.creator_id = auth.uid())
  );

create policy "creator delete exam_questions" on exam_questions
  for delete using (
    exists (select 1 from exams e where e.id = exam_questions.exam_id and e.creator_id = auth.uid())
  );

create policy "read categories" on categories
  for select using (auth.role() = 'authenticated');

create policy "instructors insert categories" on categories
  for insert with check (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('ADMIN', 'INSTRUCTOR'))
  );

create policy "read question_categories" on question_categories
  for select using (auth.role() = 'authenticated');

create policy "instructors insert question_categories" on question_categories
  for insert with check (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('ADMIN', 'INSTRUCTOR'))
  );

-- ---------- Needed for exam deletion to cascade correctly (added as patch_003) ----------
create policy "creator delete student_attempts for own exams" on student_attempts
  for delete using (
    exists (select 1 from exams e where e.id = student_attempts.exam_id and e.creator_id = auth.uid())
  );
