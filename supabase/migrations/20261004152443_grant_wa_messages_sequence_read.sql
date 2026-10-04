-- The staff-facing security-invoker view orders equal-time messages with this
-- technical column. Keep the grant column-scoped so message metadata remains
-- inaccessible to authenticated users.
grant select (sequence_index) on table public.wa_messages to authenticated;
