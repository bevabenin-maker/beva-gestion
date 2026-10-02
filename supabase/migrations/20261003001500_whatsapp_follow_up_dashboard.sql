-- Tableau de suivi WhatsApp BEVA.
-- Les données restent privées : seuls les membres actifs du personnel peuvent
-- les consulter et seuls les champs de suivi peuvent être modifiés depuis
-- l'application de gestion.

alter table public.wa_contacts
  add column if not exists commercial_status text not null default 'a_qualifier'
    check (commercial_status = any (array[
      'a_qualifier',
      'interesse',
      'a_relancer',
      'visite_prevue',
      'inscription_en_cours',
      'inscrit',
      'non_interesse'
    ])),
  add column if not exists assigned_to uuid references public.staff_members(user_id) on delete set null,
  add column if not exists next_follow_up_at timestamptz,
  add column if not exists internal_note text check (internal_note is null or char_length(internal_note) <= 4000),
  add column if not exists attention_reason text
    check (attention_reason is null or attention_reason = any (array[
      'conseiller',
      'appel_demande',
      'message_demande',
      'justificatif_paiement',
      'inscription',
      'question_libre'
    ])),
  add column if not exists last_reviewed_at timestamptz,
  add column if not exists last_reviewed_by uuid references auth.users(id) on delete set null;

create index if not exists wa_contacts_status_idx
  on public.wa_contacts (statut_whatsapp, suivi_reponse);
create index if not exists wa_contacts_last_message_idx
  on public.wa_contacts (last_message_at desc);
create index if not exists wa_contacts_first_seen_idx
  on public.wa_contacts (first_seen_at desc);
create index if not exists wa_contacts_assigned_idx
  on public.wa_contacts (assigned_to)
  where assigned_to is not null;
create index if not exists wa_contacts_follow_up_idx
  on public.wa_contacts (next_follow_up_at)
  where next_follow_up_at is not null;
create index if not exists wa_contacts_attention_idx
  on public.wa_contacts (attention_reason)
  where attention_reason is not null;
create index if not exists wa_contacts_last_reviewed_by_idx
  on public.wa_contacts (last_reviewed_by)
  where last_reviewed_by is not null;
create index if not exists wa_messages_contact_time_idx
  on public.wa_messages (contact_id, occurred_at desc);
create index if not exists wa_flow_submissions_contact_time_idx
  on public.wa_flow_submissions (contact_id, submitted_at desc);

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'wa_contacts_set_updated_at'
      and tgrelid = 'public.wa_contacts'::regclass
  ) then
    create trigger wa_contacts_set_updated_at
    before update on public.wa_contacts
    for each row execute function public.set_updated_at();
  end if;
end $$;

drop view if exists public.wa_contact_overview;
create view public.wa_contact_overview
with (security_invoker = true)
as
select
  c.id,
  c.phone,
  c.wa_id,
  c.profile_name,
  c.has_inbound,
  c.has_outbound,
  c.statut_whatsapp,
  c.suivi_reponse,
  c.last_message_direction,
  c.last_message_at,
  c.first_seen_at,
  c.updated_at,
  c.commercial_status,
  c.assigned_to,
  c.next_follow_up_at,
  c.internal_note,
  c.attention_reason,
  c.last_reviewed_at,
  c.last_reviewed_by,
  last_message.body as last_message_body,
  last_message.message_type as last_message_type,
  last_message.delivery_status as last_delivery_status,
  last_submission.id as last_submission_id,
  last_submission.nom_complet as registration_name,
  last_submission.telephone as registration_phone,
  last_submission.formations as registration_formations,
  last_submission.mode_cours as registration_mode,
  last_submission.horaire as registration_schedule,
  last_submission.date_passage as registration_visit_date,
  last_submission.submitted_at as registration_submitted_at
from public.wa_contacts c
left join lateral (
  select m.body, m.message_type, m.delivery_status
  from public.wa_messages m
  where m.contact_id = c.id
  order by m.occurred_at desc
  limit 1
) last_message on true
left join lateral (
  select f.id, f.nom_complet, f.telephone, f.formations, f.mode_cours,
         f.horaire, f.date_passage, f.submitted_at
  from public.wa_flow_submissions f
  where f.contact_id = c.id
  order by f.submitted_at desc
  limit 1
) last_submission on true;

alter table public.wa_contacts enable row level security;
alter table public.wa_messages enable row level security;
alter table public.wa_flow_submissions enable row level security;

revoke all on public.wa_contacts from anon, authenticated;
revoke all on public.wa_messages from anon, authenticated;
revoke all on public.wa_flow_submissions from anon, authenticated;
revoke all on public.wa_message_statuses from anon, authenticated;
revoke all on public.wa_webhook_events from anon, authenticated;
revoke all on public.wa_contact_overview from anon, authenticated;

grant select on public.wa_contacts to authenticated;
grant update (
  statut_whatsapp,
  suivi_reponse,
  commercial_status,
  assigned_to,
  next_follow_up_at,
  internal_note,
  attention_reason,
  last_reviewed_at,
  last_reviewed_by
) on public.wa_contacts to authenticated;
grant select (
  id,
  contact_id,
  meta_message_id,
  direction,
  message_type,
  body,
  delivery_status,
  occurred_at,
  created_at
) on public.wa_messages to authenticated;
grant select (
  id,
  contact_id,
  meta_message_id,
  flow_id,
  flow_name,
  nom_complet,
  telephone,
  formations,
  mode_cours,
  horaire,
  date_passage,
  submitted_at,
  created_at
) on public.wa_flow_submissions to authenticated;
grant select on public.wa_contact_overview to authenticated;

drop policy if exists wa_contacts_staff_read on public.wa_contacts;
drop policy if exists wa_contacts_staff_update on public.wa_contacts;
drop policy if exists wa_messages_staff_read on public.wa_messages;
drop policy if exists wa_flow_submissions_staff_read on public.wa_flow_submissions;

create policy wa_contacts_staff_read
  on public.wa_contacts for select
  to authenticated
  using ((select private.current_staff_role()) is not null);

create policy wa_contacts_staff_update
  on public.wa_contacts for update
  to authenticated
  using ((select private.current_staff_role()) is not null)
  with check ((select private.current_staff_role()) is not null);

create policy wa_messages_staff_read
  on public.wa_messages for select
  to authenticated
  using ((select private.current_staff_role()) is not null);

create policy wa_flow_submissions_staff_read
  on public.wa_flow_submissions for select
  to authenticated
  using ((select private.current_staff_role()) is not null);
