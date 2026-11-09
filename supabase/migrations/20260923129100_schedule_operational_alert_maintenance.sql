BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

DO $$
BEGIN
  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname = 'lotus-operational-alert-maintenance';

  PERFORM cron.schedule(
    'lotus-operational-alert-maintenance',
    '*/15 * * * *',
    $cron$SELECT public.run_operational_notification_maintenance();$cron$
  );
END $$;

COMMIT;
