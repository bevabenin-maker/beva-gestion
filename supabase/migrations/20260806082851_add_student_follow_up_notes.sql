create table public.student_notes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  content text not null check (char_length(btrim(content)) between 1 and 2000),
  follow_up_on date,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index student_notes_student_created_idx
  on public.student_notes (student_id, created_at desc);

create index student_notes_follow_up_idx
  on public.student_notes (follow_up_on)
  where follow_up_on is not null;

create index student_notes_created_by_idx
  on public.student_notes (created_by);

create index student_notes_updated_by_idx
  on public.student_notes (updated_by);

alter table public.student_notes enable row level security;

grant select, insert, update, delete on public.student_notes to authenticated;
grant all on public.student_notes to service_role;

create policy student_notes_staff_read
  on public.student_notes for select
  to authenticated
  using (private.current_staff_role() is not null);

create policy student_notes_staff_insert
  on public.student_notes for insert
  to authenticated
  with check (
    private.current_staff_role() is not null
    and created_by = (select auth.uid())
  );

create policy student_notes_staff_update
  on public.student_notes for update
  to authenticated
  using (
    private.current_staff_role() = any (array['admin'::staff_role, 'direction'::staff_role])
    or created_by = (select auth.uid())
  )
  with check (
    private.current_staff_role() = any (array['admin'::staff_role, 'direction'::staff_role])
    or created_by = (select auth.uid())
  );

create policy student_notes_staff_delete
  on public.student_notes for delete
  to authenticated
  using (
    private.current_staff_role() = any (array['admin'::staff_role, 'direction'::staff_role])
    or created_by = (select auth.uid())
  );

create trigger student_notes_set_updated_at
before update on public.student_notes
for each row execute function public.set_updated_at();

-- Preserve the notes already stored on student records as the first entries
-- of the new history. The legacy column stays untouched for compatibility.
insert into public.student_notes (student_id, content, created_by, created_at, updated_at)
select
  students.id,
  btrim(students.notes),
  case when auth_users.id is not null then students.created_by else null end,
  students.created_at,
  students.updated_at
from public.students
left join auth.users auth_users on auth_users.id = students.created_by
where nullif(btrim(students.notes), '') is not null;
