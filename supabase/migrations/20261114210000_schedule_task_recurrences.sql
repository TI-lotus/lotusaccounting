BEGIN;

-- Shared worker implementation. It is intentionally not granted to browser
-- roles; the user-facing RPC below performs the workspace permission check.
CREATE OR REPLACE FUNCTION public.generate_task_recurrences_for_tenant(
  target_tenant_id uuid,
  target_date date DEFAULT current_date,
  actor_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  recurrence_row public.task_recurrences%ROWTYPE;
  source_task public.tasks%ROWTYPE;
  generated_task_id uuid;
  next_date date;
  generation_date date := COALESCE(target_date, current_date);
  generated_count integer := 0;
BEGIN
  IF target_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Workspace is required' USING ERRCODE = '22023';
  END IF;

  FOR recurrence_row IN
    SELECT *
    FROM public.task_recurrences
    WHERE tenant_id = target_tenant_id
      AND active
      AND next_due_date <= generation_date
    ORDER BY next_due_date, created_at
    FOR UPDATE
  LOOP
    SELECT * INTO source_task
    FROM public.tasks
    WHERE id = recurrence_row.source_task_id
      AND tenant_id = target_tenant_id;

    IF NOT FOUND THEN
      UPDATE public.task_recurrences
      SET active = false, updated_at = now()
      WHERE id = recurrence_row.id;
      CONTINUE;
    END IF;

    next_date := recurrence_row.next_due_date;
    WHILE next_date <= generation_date LOOP
      INSERT INTO public.tasks (
        tenant_id, company_id, document_id, payment_id, assigned_to,
        assigned_to_name, created_by, title, description, task_type, status,
        priority, category, due_date
      ) VALUES (
        target_tenant_id,
        source_task.company_id,
        source_task.document_id,
        source_task.payment_id,
        CASE
          WHEN source_task.assigned_to IS NULL THEN NULL
          WHEN EXISTS (
            SELECT 1 FROM public.profiles
            WHERE user_id = source_task.assigned_to
              AND tenant_id = target_tenant_id
              AND status = 'active'
          ) THEN source_task.assigned_to
          ELSE NULL
        END,
        CASE
          WHEN source_task.assigned_to IS NULL THEN NULL
          WHEN EXISTS (
            SELECT 1 FROM public.profiles
            WHERE user_id = source_task.assigned_to
              AND tenant_id = target_tenant_id
              AND status = 'active'
          ) THEN source_task.assigned_to_name
          ELSE NULL
        END,
        actor_id,
        source_task.title,
        source_task.description,
        source_task.task_type,
        'pending',
        source_task.priority,
        source_task.category,
        next_date::timestamptz
      ) RETURNING id INTO generated_task_id;

      INSERT INTO public.task_recurrence_occurrences (
        tenant_id, recurrence_id, task_id, period_key
      ) VALUES (target_tenant_id, recurrence_row.id, generated_task_id, next_date)
      ON CONFLICT (recurrence_id, period_key) DO NOTHING;

      generated_count := generated_count + 1;
      next_date := public.task_recurrence_next_date(next_date, recurrence_row.frequency);
    END LOOP;

    UPDATE public.task_recurrences
    SET next_due_date = next_date, updated_at = now()
    WHERE id = recurrence_row.id;
  END LOOP;

  RETURN generated_count;
END;
$$;

-- Keep the browser RPC scoped to the active user's workspace while sharing
-- the same idempotent implementation with the worker.
CREATE OR REPLACE FUNCTION public.generate_task_recurrences(target_date date DEFAULT current_date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  workspace_id uuid := public.current_user_tenant_id();
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_workspace_permission('tasks', 'create') THEN
    RAISE EXCEPTION 'Task recurrence generation is not allowed' USING ERRCODE = '42501';
  END IF;
  IF workspace_id IS NULL THEN
    RAISE EXCEPTION 'Workspace not found' USING ERRCODE = '42501';
  END IF;

  RETURN public.generate_task_recurrences_for_tenant(workspace_id, target_date, auth.uid());
END;
$$;

-- Worker-only bulk entrypoint used by the internal scheduler. The explicit
-- grant is required by Supabase's service-role execution path; browser roles
-- remain unable to invoke it directly.
CREATE OR REPLACE FUNCTION public.generate_task_recurrences_for_all_workspaces(
  target_date date DEFAULT current_date
)
RETURNS TABLE (workspace_id uuid, tasks_created integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  workspace record;
BEGIN
  -- Supabase's pg_cron executes SQL as the privileged postgres role without
  -- request.jwt.claim.role; the HTTP worker uses service_role instead.
  IF auth.role() IS DISTINCT FROM 'service_role'
    AND current_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Service role is required to generate scheduled task recurrences' USING ERRCODE = '42501';
  END IF;

  FOR workspace IN SELECT id FROM public.tenants LOOP
    RETURN QUERY
    SELECT workspace.id, public.generate_task_recurrences_for_tenant(workspace.id, target_date, NULL);
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_task_recurrences_for_tenant(uuid, date, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_task_recurrences(date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.generate_task_recurrences_for_all_workspaces(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_task_recurrences(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_task_recurrences_for_all_workspaces(date) TO service_role;

COMMIT;
