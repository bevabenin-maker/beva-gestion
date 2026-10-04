create index if not exists wa_ai_knowledge_updated_by_idx
  on public.wa_ai_knowledge (updated_by)
  where updated_by is not null;

create index if not exists wa_ai_settings_updated_by_idx
  on public.wa_ai_settings (updated_by)
  where updated_by is not null;
