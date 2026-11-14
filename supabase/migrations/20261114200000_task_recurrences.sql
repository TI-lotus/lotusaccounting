BEGIN;

CREATE TABLE IF NOT EXISTS public.task_recurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  source_task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  frequency text NOT NULL CHECK (frequency IN ('monthly', 'annual')),
  next_due_date date NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, source_task_id)
);

CREATE TABLE IF NOT EXISTS public.task_recurrence_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  recurrence_id uuid NOT NULL REFERENCES public.task_recurrences(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  period_key date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (recurrence_id, period_key),
  UNIQUE (task_id)
);

CREATE INDEX IF NOT EXISTS idx_task_recurrences_due
  ON public.task_recurrences (tenant_id, active, next_due_date);
CREATE INDEX IF NOT EXISTS idx_task_recurrence_occurrences_recurrence
  ON public.task_recurrence_occurrences (tenant_id, recurrence_id, period_key);

ALTER TABLE public.task_recurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_recurrence_occurrences ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_recurrences TO authenticated;
GRANT SELECT ON public.task_recurrence_occurrences TO authenticated;

DROP TRIGGER IF EXISTS trg_audit_task_recurrences ON public.task_recurrences;
CREATE TRIGGER trg_audit_task_recurrences
AFTER INSERT OR UPDATE OR DELETE ON public.task_recurrences
FOR EACH ROW EXECUTE FUNCTION public.log_entity_activity();

DROP TRIGGER IF EXISTS trg_audit_task_recurrence_occurrences ON public.task_recurrence_occurrences;
CREATE TRIGGER trg_audit_task_recurrence_occurrences
AFTER INSERT OR UPDATE OR DELETE ON public.task_recurrence_occurrences
FOR EACH ROW EXECUTE FUNCTION public.log_entity_activity();

DROP POLICY IF EXISTS task_recurrences_read_permission ON public.task_recurrences;
CREATE POLICY task_recurrences_read_permission ON public.task_recurrences
FOR SELECT TO authenticated
USING (
  tenant_id = public.current_user_tenant_id()
  AND public.has_workspace_permission('tasks', 'read')
);

DROP POLICY IF EXISTS task_recurrences_create_permission ON public.task_recurrences;
CREATE POLICY task_recurrences_create_permission ON public.task_recurrences
FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = public.current_user_tenant_id()
  AND public.has_workspace_permission('tasks', 'create')
);

DROP POLICY IF EXISTS task_recurrences_update_permission ON public.task_recurrences;
CREATE POLICY task_recurrences_update_permission ON public.task_recurrences
FOR UPDATE TO authenticated
USING (
  tenant_id = public.current_user_tenant_id()
  AND public.has_workspace_permission('tasks', 'update')
)
WITH CHECK (
  tenant_id = public.current_user_tenant_id()
  AND public.has_workspace_permission('tasks', 'update')
);

DROP POLICY IF EXISTS task_recurrences_delete_permission ON public.task_recurrences;
CREATE POLICY task_recurrences_delete_permission ON public.task_recurrences
FOR DELETE TO authenticated
USING (
  tenant_id = public.current_user_tenant_id()
  AND public.has_workspace_permission('tasks', 'delete')
);

DROP POLICY IF EXISTS task_recurrence_occurrences_read_permission ON public.task_recurrence_occurrences;
CREATE POLICY task_recurrence_occurrences_read_permission ON public.task_recurrence_occurrences
FOR SELECT TO authenticated
USING (
  tenant_id = public.current_user_tenant_id()
  AND public.has_workspace_permission('tasks', 'read')
);

CREATE OR REPLACE FUNCTION public.task_recurrence_next_date(
  base_date date,
  recurrence_frequency text
)
RETURNS date
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE recurrence_frequency
    WHEN 'annual' THEN (base_date + interval '1 year')::date
    ELSE (base_date + interval '1 month')::date
  END;
$$;

CREATE OR REPLACE FUNCTION public.register_task_recurrence(p_source_task_id uuid)
RETURNS public.task_recurrences
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  source_task public.tasks%ROWTYPE;
  recurrence public.task_recurrences%ROWTYPE;
  next_date date;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_workspace_permission('tasks', 'create') THEN
    RAISE EXCEPTION 'Task recurrence creation is not allowed' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO source_task
  FROM public.tasks
  WHERE id = p_source_task_id
    AND tenant_id = public.current_user_tenant_id();

  IF NOT FOUND OR source_task.task_type NOT IN ('monthly', 'annual') OR source_task.due_date IS NULL THEN
    RAISE EXCEPTION 'Only monthly or annual tasks with a due date can recur' USING ERRCODE = '23514';
  END IF;

  next_date := public.task_recurrence_next_date(source_task.due_date::date, source_task.task_type);
  INSERT INTO public.task_recurrences (
    tenant_id, source_task_id, frequency, next_due_date, created_by
  ) VALUES (
    source_task.tenant_id, source_task.id, source_task.task_type, next_date, auth.uid()
  )
  ON CONFLICT (tenant_id, source_task_id) DO UPDATE
  SET active = true, frequency = EXCLUDED.frequency, next_due_date = EXCLUDED.next_due_date, updated_at = now()
  RETURNING * INTO recurrence;

  RETURN recurrence;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_task_recurrences(target_date date DEFAULT current_date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  workspace_id uuid := public.current_user_tenant_id();
  recurrence_row public.task_recurrences%ROWTYPE;
  source_task public.tasks%ROWTYPE;
  generated_task_id uuid;
  next_date date;
  generated_count integer := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_workspace_permission('tasks', 'create') THEN
    RAISE EXCEPTION 'Task recurrence generation is not allowed' USING ERRCODE = '42501';
  END IF;
  IF workspace_id IS NULL THEN
    RAISE EXCEPTION 'Workspace not found' USING ERRCODE = '42501';
  END IF;

  FOR recurrence_row IN
    SELECT *
    FROM public.task_recurrences
    WHERE tenant_id = workspace_id
      AND active
      AND next_due_date <= COALESCE(target_date, current_date)
    ORDER BY next_due_date, created_at
    FOR UPDATE
  LOOP
    SELECT * INTO source_task
    FROM public.tasks
    WHERE id = recurrence_row.source_task_id
      AND tenant_id = workspace_id;

    IF NOT FOUND THEN
      UPDATE public.task_recurrences
      SET active = false, updated_at = now()
      WHERE id = recurrence_row.id;
      CONTINUE;
    END IF;

    next_date := recurrence_row.next_due_date;
    WHILE next_date <= COALESCE(target_date, current_date) LOOP
      INSERT INTO public.tasks (
        tenant_id, company_id, document_id, payment_id, assigned_to,
        assigned_to_name, created_by, title, description, task_type, status,
        priority, category, due_date
      ) VALUES (
        workspace_id,
        source_task.company_id,
        source_task.document_id,
        source_task.payment_id,
        CASE
          WHEN source_task.assigned_to IS NULL THEN NULL
          WHEN EXISTS (
            SELECT 1 FROM public.profiles
            WHERE user_id = source_task.assigned_to
              AND tenant_id = workspace_id
              AND status = 'active'
          ) THEN source_task.assigned_to
          ELSE NULL
        END,
        CASE
          WHEN source_task.assigned_to IS NULL THEN NULL
          WHEN EXISTS (
            SELECT 1 FROM public.profiles
            WHERE user_id = source_task.assigned_to
              AND tenant_id = workspace_id
              AND status = 'active'
          ) THEN source_task.assigned_to_name
          ELSE NULL
        END,
        auth.uid(),
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
      ) VALUES (workspace_id, recurrence_row.id, generated_task_id, next_date)
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

REVOKE ALL ON FUNCTION public.task_recurrence_next_date(date, text), public.register_task_recurrence(uuid), public.generate_task_recurrences(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.task_recurrence_next_date(date, text), public.register_task_recurrence(uuid), public.generate_task_recurrences(date) TO authenticated;

COMMIT;
