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
