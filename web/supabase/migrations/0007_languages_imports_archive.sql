-- Udhaar Voice: Odia and Marathi, typed and file khata imports, archiving customers, and dropping
-- "pays through" (another customer paying someone's dues), which the app no longer offers.

-- New values can't be used in the same transaction they're added in, so nothing below uses them.
alter type language_code add value if not exists 'or';
alter type language_code add value if not exists 'mr';

-- Imports can now come from typed rows ('manual') and spreadsheets ('file') as well as photos.
alter table khata_imports drop constraint if exists khata_imports_source_check;
alter table khata_imports add constraint khata_imports_source_check check (source in ('upload', 'sample', 'manual', 'file'));

-- Removing a customer archives them: they leave lists and calls, and their history stays.
alter table customers add column if not exists archived_at timestamptz;

alter table customers drop constraint if exists customers_shop_id_pays_through_id_fkey;
alter table customers drop constraint if exists customers_check;
alter table customers drop column if exists pays_through_id;

-- A sign-up whose email was never confirmed: its shop doesn't exist yet, so the email can be
-- signed up again. Server only, like email_in_use.
create or replace function unconfirmed_signup(p_email text) returns uuid
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select id from auth.users
  where lower(email) = lower(trim(p_email)) and email_confirmed_at is null
  limit 1
$$;

revoke execute on function unconfirmed_signup(text) from public, anon, authenticated;
grant execute on function unconfirmed_signup(text) to service_role;
