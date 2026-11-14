BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

DO $$
BEGIN
  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname = 'lotus-task-recurrence-maintenance';

  PERFORM cron.schedule(
    'lotus-task-recurrence-maintenance',
    '15 0 * * *',
    $cron$SELECT public.generate_task_recurrences_for_all_workspaces(current_date);$cron$
  );
END $$;

COMMIT;
