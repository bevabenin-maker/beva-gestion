-- Suppression définitive du projet WhatsApp / chatbot.
-- Les tables métier de BEVA Gestion ne sont pas concernées.

drop view if exists public.wa_ai_usage_daily;
drop view if exists public.wa_contact_overview;

drop table if exists public.wa_ai_requests;
drop table if exists public.wa_flow_submissions;
drop table if exists public.wa_messages;
drop table if exists public.wa_message_statuses;
drop table if exists public.wa_webhook_events;
drop table if exists public.wa_contacts;
drop table if exists public.wa_ai_knowledge;
drop table if exists public.wa_ai_settings;
