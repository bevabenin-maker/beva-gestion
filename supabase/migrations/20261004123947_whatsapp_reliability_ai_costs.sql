-- Fiabilisation du chatbot WhatsApp et mesure des coûts d'intelligence artificielle.
-- Les données restent privées et accessibles uniquement au personnel BEVA actif.

alter table public.wa_contacts
  add column if not exists attention_opened_at timestamptz,
  add column if not exists attention_resolved_at timestamptz,
  add column if not exists attention_resolved_by uuid references auth.users(id) on delete set null,
  add column if not exists awaiting_payment_proof_until timestamptz;

alter table public.wa_messages
  add column if not exists trigger_message_id text,
  add column if not exists sequence_index integer not null default 0
    check (sequence_index >= 0),
  add column if not exists sequence_total integer not null default 1
    check (sequence_total >= 1 and sequence_index < sequence_total);

alter table public.wa_webhook_events
  add column if not exists event_hash text,
  add column if not exists processing_started_at timestamptz,
  add column if not exists processed_at timestamptz;

update public.wa_messages
set
  trigger_message_id = nullif(raw_payload ->> 'trigger_message_id', ''),
  sequence_index = coalesce((raw_payload ->> 'sequence_index')::integer, 0),
  sequence_total = greatest(coalesce((raw_payload ->> 'sequence_total')::integer, 1), 1)
where direction = 'outbound'
  and trigger_message_id is null
  and raw_payload ? 'trigger_message_id';

create unique index if not exists wa_webhook_events_event_hash_uidx
  on public.wa_webhook_events (event_hash);
create index if not exists wa_webhook_events_processing_idx
  on public.wa_webhook_events (processed, processing_started_at, received_at desc);
create index if not exists wa_messages_trigger_idx
  on public.wa_messages (trigger_message_id, sequence_index)
  where trigger_message_id is not null;
create index if not exists wa_contacts_open_attention_idx
  on public.wa_contacts (attention_opened_at)
  where attention_reason is not null;
create index if not exists wa_contacts_payment_proof_idx
  on public.wa_contacts (awaiting_payment_proof_until)
  where awaiting_payment_proof_until is not null;
create index if not exists wa_contacts_attention_resolved_by_idx
  on public.wa_contacts (attention_resolved_by)
  where attention_resolved_by is not null;

create table if not exists public.wa_ai_requests (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.wa_contacts(id) on delete cascade,
  trigger_message_id text not null unique,
  provider text not null default 'cloudflare'
    check (provider in ('cloudflare')),
  model text not null,
  status text not null default 'processing'
    check (status in ('processing', 'succeeded', 'failed')),
  prompt_tokens integer not null default 0 check (prompt_tokens >= 0),
  completion_tokens integer not null default 0 check (completion_tokens >= 0),
  total_tokens integer not null default 0 check (total_tokens >= 0),
  input_cost_usd numeric(18, 10) not null default 0 check (input_cost_usd >= 0),
  output_cost_usd numeric(18, 10) not null default 0 check (output_cost_usd >= 0),
  total_cost_usd numeric(18, 10) not null default 0 check (total_cost_usd >= 0),
  estimated_neurons numeric(18, 6) not null default 0 check (estimated_neurons >= 0),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  route_intents text[] not null default '{}',
  route_confidence numeric(5, 4)
    check (route_confidence is null or route_confidence between 0 and 1),
  error_message text,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists wa_ai_requests_requested_idx
  on public.wa_ai_requests (requested_at desc);
create index if not exists wa_ai_requests_contact_idx
  on public.wa_ai_requests (contact_id, requested_at desc);
create index if not exists wa_ai_requests_status_idx
  on public.wa_ai_requests (status, requested_at desc);

alter table public.wa_ai_requests enable row level security;
revoke all on public.wa_ai_requests from anon, authenticated;
grant select (
  id,
  contact_id,
  trigger_message_id,
  provider,
  model,
  status,
  prompt_tokens,
  completion_tokens,
  total_tokens,
  input_cost_usd,
  output_cost_usd,
  total_cost_usd,
  estimated_neurons,
  latency_ms,
  route_intents,
  route_confidence,
  error_message,
  requested_at,
  completed_at,
  created_at
) on public.wa_ai_requests to authenticated;

drop policy if exists wa_ai_requests_staff_read on public.wa_ai_requests;
create policy wa_ai_requests_staff_read
  on public.wa_ai_requests for select
  to authenticated
  using ((select private.current_staff_role()) is not null);

grant update (
  statut_whatsapp,
  suivi_reponse,
  commercial_status,
  assigned_to,
  next_follow_up_at,
  internal_note,
  attention_reason,
  attention_opened_at,
  attention_resolved_at,
  attention_resolved_by,
  awaiting_payment_proof_until,
  last_reviewed_at,
  last_reviewed_by
) on public.wa_contacts to authenticated;

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
  c.attention_opened_at,
  c.attention_resolved_at,
  c.attention_resolved_by,
  c.awaiting_payment_proof_until,
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
  order by m.occurred_at desc, m.created_at desc, m.sequence_index desc
  limit 1
) last_message on true
left join lateral (
  select f.id, f.nom_complet, f.telephone, f.formations, f.mode_cours,
         f.horaire, f.date_passage, f.submitted_at
  from public.wa_flow_submissions f
  where f.contact_id = c.id
  order by f.submitted_at desc, f.created_at desc
  limit 1
) last_submission on true;

grant select on public.wa_contact_overview to authenticated;

create or replace view public.wa_ai_usage_daily
with (security_invoker = true)
as
select
  (requested_at at time zone 'Africa/Porto-Novo')::date as usage_day,
  count(*)::integer as request_count,
  count(*) filter (where status = 'succeeded')::integer as succeeded_count,
  count(*) filter (where status = 'failed')::integer as failed_count,
  coalesce(sum(prompt_tokens), 0)::bigint as prompt_tokens,
  coalesce(sum(completion_tokens), 0)::bigint as completion_tokens,
  coalesce(sum(total_tokens), 0)::bigint as total_tokens,
  coalesce(sum(total_cost_usd), 0)::numeric(18, 10) as total_cost_usd,
  coalesce(sum(estimated_neurons), 0)::numeric(18, 6) as estimated_neurons,
  coalesce(avg(latency_ms) filter (where latency_ms is not null), 0)::numeric(12, 2) as average_latency_ms
from public.wa_ai_requests
group by (requested_at at time zone 'Africa/Porto-Novo')::date;

revoke all on public.wa_ai_usage_daily from anon, authenticated;
grant select on public.wa_ai_usage_daily to authenticated;
