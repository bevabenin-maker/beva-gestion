-- Suivi des présences BEVA
-- Les comptes professeurs sont volontairement séparés des comptes du personnel :
-- ils ne donnent accès qu'au portail d'appel de leur formation.

create table public.teacher_access_accounts (
  id uuid primary key default gen_random_uuid(),
  formation_id uuid not null unique references public.formations(id) on delete cascade,
  professor_name text not null check (char_length(btrim(professor_name)) >= 2),
  active boolean not null default true,
  password_configured boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.teacher_access_accounts is 'Comptes pédagogiques limités à une formation.';

create table public.teacher_account_credentials (
  teacher_account_id uuid primary key references public.teacher_access_accounts(id) on delete cascade,
  password_hash text not null,
  password_salt text not null,
  failed_attempts smallint not null default 0 check (failed_attempts >= 0),
  locked_until timestamptz,
  password_changed_at timestamptz not null default now()
);

create table public.teacher_access_sessions (
  id uuid primary key default gen_random_uuid(),
  teacher_account_id uuid not null references public.teacher_access_accounts(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.attendance_schedules (
  id uuid primary key default gen_random_uuid(),
  formation_id uuid not null references public.formations(id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  start_time time not null,
  end_time time not null,
  label text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time),
  unique (formation_id, weekday, start_time)
);

comment on table public.attendance_schedules is 'Séances obligatoires récurrentes. Les rattrapages restent libres.';

create table public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  formation_id uuid not null references public.formations(id) on delete restrict,
  intake_id uuid not null references public.intakes(id) on delete cascade,
  schedule_id uuid references public.attendance_schedules(id) on delete set null,
  session_date date not null,
  status text not null check (status in ('held', 'cancelled')),
  scheduled_start time,
  scheduled_end time,
  cancel_reason text,
  recorded_by_teacher_account_id uuid references public.teacher_access_accounts(id) on delete set null,
  recorded_by_staff_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (intake_id, formation_id, schedule_id, session_date),
  check ((status = 'cancelled') or cancel_reason is null)
);

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.attendance_sessions(id) on delete cascade,
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  status text not null check (status in ('present', 'late', 'absent')),
  notice_status text not null default 'not_notified' check (notice_status in ('not_notified', 'notified')),
  reason_code text check (reason_code is null or reason_code in ('sante', 'travail', 'famille', 'transport', 'connexion', 'finance', 'deplacement', 'autre')),
  note text check (note is null or char_length(note) <= 500),
  learning_mode text not null default 'presentiel' check (learning_mode in ('presentiel', 'en_ligne')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, enrollment_id)
);

create table public.attendance_makeups (
  id uuid primary key default gen_random_uuid(),
  attendance_record_id uuid not null unique references public.attendance_records(id) on delete cascade,
  completed_on date not null default current_date,
  recorded_by_teacher_account_id uuid references public.teacher_access_accounts(id) on delete set null,
  recorded_by_staff_id uuid references auth.users(id) on delete set null,
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now()
);

create index attendance_schedules_formation_idx on public.attendance_schedules(formation_id, active, weekday);
create index attendance_sessions_week_idx on public.attendance_sessions(intake_id, session_date, formation_id);
create index attendance_records_student_idx on public.attendance_records(student_id, status);
create index attendance_records_session_idx on public.attendance_records(session_id);
create index attendance_makeups_date_idx on public.attendance_makeups(completed_on);
create index teacher_access_sessions_lookup_idx on public.teacher_access_sessions(token_hash, expires_at) where revoked_at is null;

alter table public.teacher_access_accounts enable row level security;
alter table public.teacher_account_credentials enable row level security;
alter table public.teacher_access_sessions enable row level security;
alter table public.attendance_schedules enable row level security;
alter table public.attendance_sessions enable row level security;
alter table public.attendance_records enable row level security;
alter table public.attendance_makeups enable row level security;

-- Les secrets ne sont accessibles qu'au service_role de la fonction Edge.
revoke all on public.teacher_account_credentials from anon, authenticated;
revoke all on public.teacher_access_sessions from anon, authenticated;
grant all on public.teacher_account_credentials to service_role;
grant all on public.teacher_access_sessions to service_role;

create policy teacher_accounts_staff_read on public.teacher_access_accounts
  for select to authenticated
  using (private.current_staff_role() is not null);

create policy teacher_accounts_management_insert on public.teacher_access_accounts
  for insert to authenticated
  with check (private.current_staff_role() in ('admin'::staff_role, 'direction'::staff_role));

create policy teacher_accounts_management_update on public.teacher_access_accounts
  for update to authenticated
  using (private.current_staff_role() in ('admin'::staff_role, 'direction'::staff_role))
  with check (private.current_staff_role() in ('admin'::staff_role, 'direction'::staff_role));

create policy teacher_accounts_admin_delete on public.teacher_access_accounts
  for delete to authenticated
  using (private.current_staff_role() = 'admin'::staff_role);

create policy attendance_schedules_staff_read on public.attendance_schedules
  for select to authenticated using (private.current_staff_role() is not null);
create policy attendance_schedules_management_insert on public.attendance_schedules
  for insert to authenticated with check (private.current_staff_role() in ('admin'::staff_role, 'direction'::staff_role));
create policy attendance_schedules_management_update on public.attendance_schedules
  for update to authenticated
  using (private.current_staff_role() in ('admin'::staff_role, 'direction'::staff_role))
  with check (private.current_staff_role() in ('admin'::staff_role, 'direction'::staff_role));
create policy attendance_schedules_admin_delete on public.attendance_schedules
  for delete to authenticated using (private.current_staff_role() = 'admin'::staff_role);

create policy attendance_sessions_staff_read on public.attendance_sessions
  for select to authenticated using (private.current_staff_role() is not null);
create policy attendance_sessions_management_update on public.attendance_sessions
  for update to authenticated
  using (private.current_staff_role() in ('admin'::staff_role, 'direction'::staff_role))
  with check (private.current_staff_role() in ('admin'::staff_role, 'direction'::staff_role));
create policy attendance_sessions_management_delete on public.attendance_sessions
  for delete to authenticated using (private.current_staff_role() = 'admin'::staff_role);

create policy attendance_records_staff_read on public.attendance_records
  for select to authenticated using (private.current_staff_role() is not null);
create policy attendance_records_management_update on public.attendance_records
  for update to authenticated
  using (private.current_staff_role() in ('admin'::staff_role, 'direction'::staff_role))
  with check (private.current_staff_role() in ('admin'::staff_role, 'direction'::staff_role));
create policy attendance_records_management_delete on public.attendance_records
  for delete to authenticated using (private.current_staff_role() = 'admin'::staff_role);

create policy attendance_makeups_staff_read on public.attendance_makeups
  for select to authenticated using (private.current_staff_role() is not null);
create policy attendance_makeups_management_insert on public.attendance_makeups
  for insert to authenticated
  with check (private.current_staff_role() in ('admin'::staff_role, 'direction'::staff_role));
create policy attendance_makeups_management_update on public.attendance_makeups
  for update to authenticated
  using (private.current_staff_role() in ('admin'::staff_role, 'direction'::staff_role))
  with check (private.current_staff_role() in ('admin'::staff_role, 'direction'::staff_role));
create policy attendance_makeups_admin_delete on public.attendance_makeups
  for delete to authenticated using (private.current_staff_role() = 'admin'::staff_role);

-- Comptes pédagogiques initiaux, sans mot de passe. La direction configure le mot de passe dans l'application.
insert into public.teacher_access_accounts (formation_id, professor_name)
select id,
  case
    when lower(name) like '%anglais%' then 'Marie Luce BOTCHI'
    when lower(name) like '%japonais%' then 'MIGAN Vini'
    when lower(name) like '%montage%' then 'Modeste NOUTCHET'
    when lower(name) like '%graph%' or lower(name) like '%design%' then 'Pascal Belankou'
    when lower(name) like '%intelligence%' or lower(name) like '%ia%' then 'Kim'
    else 'Professeur BEVA'
  end
from public.formations
where active
on conflict (formation_id) do nothing;

-- Planning obligatoire communiqué par BEVA. Aucun créneau de rattrapage n'est figé.
insert into public.attendance_schedules (formation_id, weekday, start_time, end_time, label)
select f.id, s.weekday, s.start_time::time, s.end_time::time, s.label
from public.formations f
join (values
  ('anglais', 2, '10:00', '12:00', 'Speaking & Phonetics'),
  ('anglais', 4, '10:00', '12:00', 'Classe principale'),
  ('anglais', 6, '19:00', '21:00', 'Classe principale'),
  ('japonais', 3, '19:00', '21:00', 'Classe unique'),
  ('japonais', 6, '10:00', '12:00', 'Classe unique'),
  ('montage', 2, '19:00', '21:00', 'Classe A'),
  ('montage', 4, '19:00', '21:00', 'Classe A'),
  ('graph', 1, '19:00', '21:00', 'Classe unique'),
  ('graph', 5, '19:00', '21:00', 'Classe unique'),
  ('intelligence', 4, '19:00', '21:00', 'Classe unique'),
  ('intelligence', 6, '12:00', '14:00', 'Classe unique')
) as s(name_key, weekday, start_time, end_time, label)
  on lower(f.name) like '%' || s.name_key || '%'
on conflict (formation_id, weekday, start_time) do nothing;
