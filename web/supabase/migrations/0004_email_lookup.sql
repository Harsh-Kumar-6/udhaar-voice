-- Udhaar Voice: whether an email already belongs to an account.
-- Supabase Auth only answers "Error updating user" when a profile change picks a taken email,
-- so the server checks first. Server only: it reads auth.users, which no shopkeeper may see.

create function email_in_use(p_email text, p_except uuid default null) returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select exists (
    select 1 from auth.users
    where lower(email) = lower(trim(p_email)) and id is distinct from p_except
  )
$$;

revoke execute on function email_in_use(text, uuid) from public, anon, authenticated;
grant execute on function email_in_use(text, uuid) to service_role;
