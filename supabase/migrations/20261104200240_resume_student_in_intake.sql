-- Keep the original cohort and receipts intact; only the reviewed balance is
-- charged in the new cohort. One transaction prevents incomplete resumptions.
create or replace function public.resume_student_in_intake(
  p_source_enrollment_id uuid,
  p_intake_id uuid,
  p_resumes_from_month integer,
  p_remaining_fee numeric,
  p_learning_mode text
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  source public.enrollments%rowtype;
  original public.students%rowtype;
  target_id uuid;
  slot_id uuid;
  paid numeric;
  remaining numeric;
begin
  if auth.uid() is null or private.current_staff_role() is null then
    raise exception 'Accès personnel BEVA requis.' using errcode = '42501';
  end if;
  -- Serialize all resumptions of this learner, including different courses.
  select s.* into original from public.students s
  join public.enrollments e on e.student_id = s.id
  where e.id = p_source_enrollment_id for update of s;
  if not found or original.status::text <> 'en_attente' then
    raise exception 'Cet apprenant doit être en attente de la prochaine vague.';
  end if;
  select * into source from public.enrollments where id = p_source_enrollment_id for update;
  if source.formation_id is null or source.status::text = 'disponible' then
    raise exception 'Choisissez un dossier de formation existant.';
  end if;
  if p_intake_id is null or p_intake_id = original.intake_id
     or not exists (select 1 from public.intakes where id = p_intake_id) then
    raise exception 'Choisissez une autre vague.';
  end if;
  if p_resumes_from_month is null or p_resumes_from_month not between 1 and 3
     or p_learning_mode is null or p_learning_mode not in ('presentiel', 'en_ligne') then
    raise exception 'Mois de reprise ou mode de suivi invalide.';
  end if;
  select coalesce(sum(amount), 0) into paid from public.payments
  where enrollment_id = source.id and cancelled_at is null;
  remaining := greatest(0, source.agreed_fee - paid);
  if p_remaining_fee is null or p_remaining_fee::text in ('NaN', 'Infinity', '-Infinity')
     or p_remaining_fee < 0 or p_remaining_fee > remaining then
    raise exception 'Le solde doit être compris entre zéro et le reste de l’ancien dossier.';
  end if;
  select id into target_id from public.students
  where returning_from_student_id = original.id and intake_id = p_intake_id
  order by created_at, id limit 1 for update;
  if target_id is not null and exists (
    select 1 from public.enrollments where student_id = target_id
    and resumed_from_enrollment_id = source.id
  ) then
    raise exception 'Ce dossier a déjà été repris dans cette vague.';
  end if;
  if target_id is not null and exists (select 1 from public.students where id = target_id and status::text <> 'actif') then
    raise exception 'Le dossier de reprise existant n’est plus actif.';
  end if;
  if target_id is null then
    insert into public.students (first_name, last_name, sex, birth_date, age, phone, email, address,
      intake_id, status, returning_from_student_id, created_by)
    values (original.first_name, original.last_name, original.sex, original.birth_date, original.age,
      original.phone, original.email, original.address, p_intake_id, 'actif', original.id, auth.uid())
    returning id into target_id;
  end if;
  select id into slot_id from public.enrollments
  where student_id = target_id and status::text = 'disponible' order by slot limit 1 for update;
  if slot_id is null then
    raise exception 'Aucun emplacement disponible dans la nouvelle vague.';
  end if;
  update public.enrollments set formation_id = source.formation_id, status = 'inscrit',
    scholarship_status = source.scholarship_status, agreed_fee = p_remaining_fee,
    monthly_fee = ceil(p_remaining_fee / (4 - p_resumes_from_month)),
    learning_mode = p_learning_mode, enrolled_at = current_date,
    resumed_from_enrollment_id = source.id, resumes_from_month = p_resumes_from_month
  where id = slot_id;
  insert into public.student_notes (student_id, content, created_by)
  values (target_id, format('Reprise du dossier %s à partir du mois %s. Solde reporté : %s FCFA. Anciens paiements conservés dans la vague d’origine.', source.dossier_code, p_resumes_from_month, p_remaining_fee), auth.uid());
  return target_id;
end;
$function$;

revoke all on function public.resume_student_in_intake(uuid, uuid, integer, numeric, text) from public, anon;
grant execute on function public.resume_student_in_intake(uuid, uuid, integer, numeric, text) to authenticated;
