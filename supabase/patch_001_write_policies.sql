-- Run this once in the SQL Editor to allow instructors/admins to actually
-- create questions and exams (the original schema only allowed reading them).

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
