create or replace function public.import_students_from_excel(
  p_intake_id uuid,
  p_rows jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  row_item jsonb;
  enrollment_item jsonb;
  imported_count integer := 0;
  source_row integer;
  new_student_id uuid;
  formation_record public.formations%rowtype;
  target_slot smallint;
  target_status public.enrollment_status;
  target_mode text;
  target_scholarship boolean;
  target_fee numeric;
  clean_phone text;
  clean_email text;
  phone_digits text;
begin
  if auth.uid() is null or private.current_staff_role() is null then
    raise exception 'Accès personnel BEVA requis.' using errcode = '42501';
  end if;

  if not exists (select 1 from public.intakes where id = p_intake_id) then
    raise exception 'La vague sélectionnée est introuvable.' using errcode = '22023';
  end if;

  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Le contenu de l''import doit être une liste.' using errcode = '22023';
  end if;

  if jsonb_array_length(p_rows) < 1 or jsonb_array_length(p_rows) > 500 then
    raise exception 'L''import doit contenir entre 1 et 500 élèves.' using errcode = '22023';
  end if;

  for row_item in select value from jsonb_array_elements(p_rows)
  loop
    source_row := coalesce((row_item ->> 'source_row')::integer, imported_count + 1);
    clean_phone := nullif(btrim(row_item ->> 'phone'), '');
    clean_email := nullif(lower(btrim(row_item ->> 'email')), '');
    phone_digits := regexp_replace(coalesce(clean_phone, ''), '\D', '', 'g');

    if nullif(btrim(row_item ->> 'last_name'), '') is null
       or nullif(btrim(row_item ->> 'first_name'), '') is null then
      raise exception 'Ligne % : nom et prénom obligatoires.', source_row using errcode = '22023';
    end if;

    if clean_phone is not null and length(phone_digits) >= 8 and exists (
      select 1 from public.students s
      where s.intake_id = p_intake_id
        and right(regexp_replace(coalesce(s.phone, ''), '\D', '', 'g'), 8) = right(phone_digits, 8)
    ) then
      raise exception 'Ligne % : ce téléphone existe déjà dans la vague.', source_row using errcode = '23505';
    end if;

    if clean_email is not null and exists (
      select 1 from public.students s
      where s.intake_id = p_intake_id and lower(btrim(coalesce(s.email, ''))) = clean_email
    ) then
      raise exception 'Ligne % : cet e-mail existe déjà dans la vague.', source_row using errcode = '23505';
    end if;

    if nullif(row_item ->> 'birth_date', '') is not null and exists (
      select 1 from public.students s
      where s.intake_id = p_intake_id
        and lower(btrim(s.last_name)) = lower(btrim(row_item ->> 'last_name'))
        and lower(btrim(s.first_name)) = lower(btrim(row_item ->> 'first_name'))
        and s.birth_date = (row_item ->> 'birth_date')::date
    ) then
      raise exception 'Ligne % : même nom, prénom et date de naissance dans la vague.', source_row using errcode = '23505';
    end if;

    insert into public.students (
      last_name, first_name, phone, email, sex, birth_date, address, status, intake_id, created_by
    ) values (
      btrim(row_item ->> 'last_name'),
      btrim(row_item ->> 'first_name'),
      clean_phone,
      clean_email,
      nullif(btrim(row_item ->> 'sex'), ''),
      nullif(row_item ->> 'birth_date', '')::date,
      nullif(btrim(row_item ->> 'address'), ''),
      coalesce(nullif(row_item ->> 'status', ''), 'actif')::public.student_status,
      p_intake_id,
      auth.uid()
    ) returning id into new_student_id;

    for enrollment_item in select value from jsonb_array_elements(coalesce(row_item -> 'enrollments', '[]'::jsonb))
    loop
      target_slot := (enrollment_item ->> 'slot')::smallint;
      target_status := coalesce(nullif(enrollment_item ->> 'status', ''), 'disponible')::public.enrollment_status;
      target_mode := coalesce(nullif(enrollment_item ->> 'learning_mode', ''), 'presentiel');
      target_scholarship := coalesce((enrollment_item ->> 'scholarship_status')::boolean, false);

      if target_slot < 1 or target_slot > 4 then
        raise exception 'Ligne % : numéro de dossier invalide.', source_row using errcode = '22023';
      end if;
      if target_status not in ('disponible', 'inscrit') then
        raise exception 'Ligne % : statut de formation invalide.', source_row using errcode = '22023';
      end if;
      if target_mode not in ('presentiel', 'en_ligne') then
        raise exception 'Ligne % : mode de formation invalide.', source_row using errcode = '22023';
      end if;

      select * into formation_record
      from public.formations
      where id = (enrollment_item ->> 'formation_id')::uuid and active = true;
      if not found then
        raise exception 'Ligne % : formation introuvable ou inactive.', source_row using errcode = '22023';
      end if;

      target_fee := case when target_scholarship then formation_record.scholarship_fee else formation_record.standard_fee end;
      update public.enrollments
      set formation_id = formation_record.id,
          status = target_status,
          learning_mode = target_mode,
          scholarship_status = target_scholarship,
          agreed_fee = target_fee,
          monthly_fee = ceil(target_fee / greatest(coalesce(formation_record.duration_months, 3), 1)),
          enrolled_at = case when target_status = 'inscrit' then current_date else null end
      where student_id = new_student_id and slot = target_slot;

      if not found then
        raise exception 'Ligne % : dossier % introuvable.', source_row, target_slot using errcode = 'P0001';
      end if;
    end loop;

    if nullif(btrim(row_item ->> 'note'), '') is not null then
      insert into public.student_notes (student_id, content, follow_up_on, created_by)
      values (
        new_student_id,
        btrim(row_item ->> 'note'),
        nullif(row_item ->> 'follow_up_on', '')::date,
        auth.uid()
      );
    end if;

    imported_count := imported_count + 1;
  end loop;

  return jsonb_build_object('imported_count', imported_count);
end;
$$;

revoke all on function public.import_students_from_excel(uuid, jsonb) from public;
revoke all on function public.import_students_from_excel(uuid, jsonb) from anon;
grant execute on function public.import_students_from_excel(uuid, jsonb) to authenticated;

comment on function public.import_students_from_excel(uuid, jsonb)
is 'Imports validated BEVA students and their selected formations atomically from the Excel workflow.';
