CREATE OR REPLACE FUNCTION public.prevent_completed_task_assignment_changes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'completed'
    AND (
      NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
      OR NEW.assigned_to_name IS DISTINCT FROM OLD.assigned_to_name
    ) THEN
    RAISE EXCEPTION 'Completed tasks cannot be reassigned. Reopen the task first.' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_completed_task_assignment_changes ON public.tasks;
CREATE TRIGGER prevent_completed_task_assignment_changes
BEFORE UPDATE OF assigned_to, assigned_to_name ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.prevent_completed_task_assignment_changes();

REVOKE ALL ON FUNCTION public.prevent_completed_task_assignment_changes() FROM PUBLIC, anon, authenticated;
