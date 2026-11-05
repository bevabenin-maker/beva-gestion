-- Plaintext never goes in teacher_access_accounts or browser-readable tables.
-- Existing password hashes keep working; old passwords cannot be reconstructed.
alter table public.teacher_account_credentials
  add column password_secret_id uuid references vault.secrets(id);

create function private.save_teacher_password(
  p_account_id uuid, p_password text, p_hash text, p_salt text, p_staff_id uuid
) returns void language plpgsql security definer set search_path = '' as $$
declare secret_id uuid;
begin
  if not exists (select 1 from public.staff_members where user_id=p_staff_id and active and role::text in ('admin','direction')) then
    raise exception 'STAFF_FORBIDDEN';
  end if;
  if p_password is null or char_length(p_password)<8 or p_hash is null or p_salt is null then
    raise exception 'PASSWORD_TOO_SHORT';
  end if;
  perform 1 from public.teacher_access_accounts where id=p_account_id for update;
  if not found then raise exception 'INVALID_TEACHER_ACCOUNT'; end if;
  select password_secret_id into secret_id from public.teacher_account_credentials where teacher_account_id=p_account_id;
  if secret_id is null then
    secret_id := vault.create_secret(p_password, null, 'BEVA teacher access password');
  else
    perform vault.update_secret(secret_id, p_password);
  end if;
  insert into public.teacher_account_credentials(teacher_account_id,password_hash,password_salt,password_secret_id,failed_attempts,locked_until,password_changed_at)
  values(p_account_id,p_hash,p_salt,secret_id,0,null,now())
  on conflict(teacher_account_id) do update set password_hash=excluded.password_hash,
    password_salt=excluded.password_salt,password_secret_id=excluded.password_secret_id,
    failed_attempts=0,locked_until=null,password_changed_at=now();
  update public.teacher_access_accounts set password_configured=true where id=p_account_id;
  update public.teacher_access_sessions set revoked_at=now() where teacher_account_id=p_account_id and revoked_at is null;
end;
$$;

create function private.read_teacher_password(p_account_id uuid, p_staff_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare result text;
begin
  if not exists(select 1 from public.staff_members where user_id=p_staff_id and active and role::text in ('admin','direction','agent')) then
    raise exception 'STAFF_FORBIDDEN';
  end if;
  select v.decrypted_secret into result from public.teacher_account_credentials c
  join vault.decrypted_secrets v on v.id=c.password_secret_id where c.teacher_account_id=p_account_id;
  return result;
end;
$$;

-- Only the authenticated Edge Function service may invoke these wrappers.
-- The Edge Function verifies the caller JWT and active staff membership first.
create function public.save_teacher_password(p_account_id uuid, p_password text, p_hash text, p_salt text, p_staff_id uuid)
returns void language sql security invoker set search_path = '' as $$
  select private.save_teacher_password(p_account_id,p_password,p_hash,p_salt,p_staff_id);
$$;
create function public.read_teacher_password(p_account_id uuid, p_staff_id uuid)
returns text language sql security invoker set search_path = '' as $$
  select private.read_teacher_password(p_account_id,p_staff_id);
$$;
revoke all on function private.save_teacher_password(uuid,text,text,text,uuid) from public,anon,authenticated;
revoke all on function private.read_teacher_password(uuid,uuid) from public,anon,authenticated;
revoke all on function public.save_teacher_password(uuid,text,text,text,uuid) from public,anon,authenticated;
revoke all on function public.read_teacher_password(uuid,uuid) from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function private.save_teacher_password(uuid,text,text,text,uuid) to service_role;
grant execute on function private.read_teacher_password(uuid,uuid) to service_role;
grant execute on function public.save_teacher_password(uuid,text,text,text,uuid) to service_role;
grant execute on function public.read_teacher_password(uuid,uuid) to service_role;

-- Removing an account also removes its encrypted password from Vault.
create function private.delete_teacher_password_secret()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.password_secret_id is not null then
    delete from vault.secrets where id=old.password_secret_id;
  end if;
  return old;
end;
$$;
revoke all on function private.delete_teacher_password_secret() from public,anon,authenticated;
create trigger teacher_password_secret_cleanup after delete on public.teacher_account_credentials
for each row execute function private.delete_teacher_password_secret();
