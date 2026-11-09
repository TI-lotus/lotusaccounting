BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
DECLARE scheduler_secret text;
BEGIN
  SELECT decrypted_secret INTO scheduler_secret
  FROM vault.decrypted_secrets
  WHERE name = 'lotus_scheduler_key';
  IF scheduler_secret IS NULL THEN
    RAISE EXCEPTION 'Vault secret lotus_scheduler_key is required before scheduling workers';
  END IF;

  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname = 'lotus-integration-scheduler';

  PERFORM cron.schedule(
    'lotus-integration-scheduler',
    '* * * * *',
    format(
      $cron$SELECT net.http_post(
        url := 'https://peguwukoyprqzgfqxhju.supabase.co/functions/v1/run-integration-scheduler',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-lotus-scheduler-key', %L),
        body := '{}'::jsonb
      )$cron$,
      scheduler_secret
    )
  );
END $$;

COMMIT;
