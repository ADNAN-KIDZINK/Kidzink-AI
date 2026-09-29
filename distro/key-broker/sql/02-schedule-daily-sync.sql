-- Kidzink AI: run the key broker's daily sync (disable keys of people removed from the staff
-- list, apply limit and model-group changes). Run after 01-kidzink-ai-schema.sql and after the
-- kidzink-ai-key Edge Function is deployed.
--
-- Needs the pg_cron and pg_net extensions (Database -> Extensions). The job's secret is kept in
-- Supabase Vault rather than in the job text. Replace the placeholder with the same value as the
-- Edge Function secret CRON_SECRET, run once, and never commit the real value.

select vault.create_secret('<CRON_SECRET>', 'kidzink_ai_cron_secret');

select cron.schedule(
    'kidzink-ai-key-sync',
    '15 2 * * *', -- 02:15 UTC daily
    $$
    select net.http_post(
        url := 'https://hxpabclqbqrukmfqdahz.supabase.co/functions/v1/kidzink-ai-key/sync',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'X-Cron-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'kidzink_ai_cron_secret')
        ),
        body := '{}'::jsonb
    );
    $$
);
