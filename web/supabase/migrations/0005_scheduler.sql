-- Udhaar Voice: runs the call dispatcher every minute (lib/server/dispatcher.ts).
-- Supabase cron calls the app's /api/cron/dispatch, which places due calls, creates evening summary
-- calls and checks calls in progress. The app's URL and the shared secret come from Supabase Vault
-- (secrets named app_url and cron_secret), so neither is written in this file.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'udhaar-dispatch',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'app_url') || '/api/cron/dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);
