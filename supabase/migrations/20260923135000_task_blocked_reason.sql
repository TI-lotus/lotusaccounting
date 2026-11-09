BEGIN;

ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS blocked_reason text;

CREATE INDEX IF NOT EXISTS idx_tasks_tenant_blocked
ON public.tasks(tenant_id, status)
WHERE status = 'blocked';

CREATE OR REPLACE FUNCTION public.normalize_task_blocked_reason()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'blocked' THEN
    IF NULLIF(trim(COALESCE(NEW.blocked_reason, '')), '') IS NULL THEN
      RAISE EXCEPTION 'Blocked tasks require a reason' USING ERRCODE = '23514';
    END IF;
    NEW.blocked_reason := trim(NEW.blocked_reason);
    NEW.completed_at := NULL;
  ELSE
    NEW.blocked_reason := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_task_blocked_reason ON public.tasks;
CREATE TRIGGER normalize_task_blocked_reason
BEFORE INSERT OR UPDATE OF status, blocked_reason ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.normalize_task_blocked_reason();

REVOKE ALL ON FUNCTION public.normalize_task_blocked_reason() FROM PUBLIC, anon, authenticated;

COMMIT;
