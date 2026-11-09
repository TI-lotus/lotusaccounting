BEGIN;

ALTER TABLE public.domain_events
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS locked_by text,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.automation_runs
  ADD COLUMN IF NOT EXISTS effect_key text;

ALTER TABLE public.integration_jobs
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_automation_runs_effect_key
  ON public.automation_runs(effect_key)
  WHERE effect_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_integration_jobs_idempotency_key
  ON public.integration_jobs(tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_domain_events_ready
  ON public.domain_events(tenant_id, scheduled_for, created_at)
  WHERE status IN ('pending', 'failed', 'processing');

DO $$
DECLARE constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.domain_events'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%status%';
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.domain_events DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE public.domain_events
  ADD CONSTRAINT domain_events_status_check
  CHECK (status IN ('pending', 'processing', 'processed', 'failed', 'ignored', 'dead_letter'));

CREATE OR REPLACE FUNCTION public.touch_domain_event_updated_at()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_touch_domain_event_updated_at ON public.domain_events;
CREATE TRIGGER trg_touch_domain_event_updated_at
BEFORE UPDATE ON public.domain_events
FOR EACH ROW EXECUTE FUNCTION public.touch_domain_event_updated_at();

CREATE OR REPLACE FUNCTION public.domain_event_next_retry_at(attempt_number integer)
RETURNS timestamptz LANGUAGE sql STABLE
AS $$
  SELECT now() + CASE
    WHEN attempt_number <= 1 THEN interval '30 seconds'
    WHEN attempt_number = 2 THEN interval '2 minutes'
    WHEN attempt_number = 3 THEN interval '10 minutes'
    ELSE interval '30 minutes'
  END
$$;

CREATE OR REPLACE FUNCTION public.claim_workspace_domain_events(
  worker_id text,
  workspace_id uuid,
  batch_size integer DEFAULT 10
)
RETURNS SETOF public.domain_events
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF worker_id IS NULL OR length(trim(worker_id)) = 0 THEN
    RAISE EXCEPTION 'Worker required';
  END IF;
  IF workspace_id IS NULL THEN
    RAISE EXCEPTION 'Workspace required';
  END IF;

  UPDATE public.domain_events
  SET status = 'dead_letter', locked_at = NULL, locked_by = NULL,
      last_error = 'Worker lease expired after maximum attempts'
  WHERE tenant_id = workspace_id
    AND status = 'processing'
    AND locked_at < now() - interval '10 minutes'
    AND attempt_count >= max_attempts;

  RETURN QUERY
  WITH candidates AS (
    SELECT id
    FROM public.domain_events
    WHERE tenant_id = workspace_id
      AND attempt_count < max_attempts
      AND (
        (status IN ('pending', 'failed') AND scheduled_for <= now())
        OR (status = 'processing' AND locked_at < now() - interval '10 minutes')
      )
    ORDER BY scheduled_for, created_at
    FOR UPDATE SKIP LOCKED
    LIMIT greatest(1, least(batch_size, 50))
  )
  UPDATE public.domain_events event
  SET status = 'processing', locked_at = now(), locked_by = worker_id,
      attempt_count = event.attempt_count + 1
  FROM candidates
  WHERE event.id = candidates.id
  RETURNING event.*;
END $$;

CREATE OR REPLACE FUNCTION public.complete_workspace_domain_event(
  event_id uuid,
  workspace_id uuid
)
RETURNS public.domain_events
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE updated_event public.domain_events;
BEGIN
  UPDATE public.domain_events
  SET status = 'processed', processed_at = now(), locked_at = NULL,
      locked_by = NULL, last_error = NULL
  WHERE id = event_id AND tenant_id = workspace_id AND status = 'processing'
  RETURNING * INTO updated_event;
  IF updated_event.id IS NULL THEN RAISE EXCEPTION 'Event is not claimed by this workspace'; END IF;
  RETURN updated_event;
END $$;

CREATE OR REPLACE FUNCTION public.fail_workspace_domain_event(
  event_id uuid,
  workspace_id uuid,
  error_message text
)
RETURNS public.domain_events
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE updated_event public.domain_events;
BEGIN
  UPDATE public.domain_events
  SET status = CASE WHEN attempt_count >= max_attempts THEN 'dead_letter' ELSE 'failed' END,
      scheduled_for = CASE WHEN attempt_count >= max_attempts THEN scheduled_for ELSE public.domain_event_next_retry_at(attempt_count) END,
      locked_at = NULL, locked_by = NULL, last_error = left(error_message, 1000)
  WHERE id = event_id AND tenant_id = workspace_id AND status = 'processing'
  RETURNING * INTO updated_event;
  IF updated_event.id IS NULL THEN RAISE EXCEPTION 'Event is not claimed by this workspace'; END IF;
  RETURN updated_event;
END $$;

CREATE OR REPLACE FUNCTION public.automation_conditions_match(
  event_payload jsonb,
  rule_conditions jsonb
)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE condition_key text; expected jsonb; actual jsonb;
BEGIN
  IF rule_conditions IS NULL OR rule_conditions = '{}'::jsonb THEN RETURN true; END IF;
  IF jsonb_typeof(rule_conditions) <> 'object' THEN RETURN false; END IF;
  FOR condition_key, expected IN SELECT key, value FROM jsonb_each(rule_conditions) LOOP
    actual := event_payload -> condition_key;
    IF jsonb_typeof(expected) = 'object' THEN
      IF expected ? 'equals' AND actual IS DISTINCT FROM expected -> 'equals' THEN RETURN false; END IF;
      IF expected ? 'notEquals' AND actual = expected -> 'notEquals' THEN RETURN false; END IF;
      IF expected ? 'exists' AND ((expected ->> 'exists')::boolean IS DISTINCT FROM (actual IS NOT NULL)) THEN RETURN false; END IF;
    ELSIF actual IS DISTINCT FROM expected THEN
      RETURN false;
    END IF;
  END LOOP;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.execute_task_automation(
  event_id uuid,
  rule_id uuid,
  workspace_id uuid
)
RETURNS public.automation_runs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE event_row public.domain_events; rule_row public.automation_rules;
  run_row public.automation_runs; task_id uuid; due_days integer;
  effect text := rule_id::text || ':' || event_id::text;
BEGIN
  SELECT * INTO event_row FROM public.domain_events
  WHERE id = event_id AND tenant_id = workspace_id AND status = 'processing';
  SELECT * INTO rule_row FROM public.automation_rules
  WHERE id = rule_id AND tenant_id = workspace_id AND enabled;
  IF event_row.id IS NULL OR rule_row.id IS NULL THEN RAISE EXCEPTION 'Event or rule is unavailable'; END IF;
  IF rule_row.action_type <> 'create_task' THEN RAISE EXCEPTION 'Unsupported automation action: %', rule_row.action_type; END IF;

  SELECT * INTO run_row FROM public.automation_runs WHERE effect_key = effect;
  IF run_row.id IS NOT NULL THEN RETURN run_row; END IF;

  INSERT INTO public.automation_runs(tenant_id, rule_id, domain_event_id, effect_key, status, started_at)
  VALUES (workspace_id, rule_id, event_id, effect, 'running', now())
  ON CONFLICT (effect_key) WHERE effect_key IS NOT NULL DO NOTHING
  RETURNING * INTO run_row;
  IF run_row.id IS NULL THEN
    SELECT * INTO run_row FROM public.automation_runs WHERE effect_key = effect;
    RETURN run_row;
  END IF;

  IF NOT public.automation_conditions_match(event_row.payload, rule_row.conditions) THEN
    UPDATE public.automation_runs SET status = 'skipped', finished_at = now(), result = jsonb_build_object('reason', 'conditions_not_met')
    WHERE id = run_row.id RETURNING * INTO run_row;
    RETURN run_row;
  END IF;

  due_days := greatest(0, least(COALESCE(NULLIF(rule_row.action_payload ->> 'dueDays', '')::integer, 1), 365));
  INSERT INTO public.tasks(tenant_id, company_id, title, description, task_type, status, priority, category, due_date)
  VALUES (
    workspace_id,
    NULLIF(event_row.payload ->> 'company_id', '')::uuid,
    COALESCE(NULLIF(rule_row.action_payload ->> 'title', ''), rule_row.name),
    COALESCE(NULLIF(rule_row.action_payload ->> 'description', ''), 'Tarefa criada automaticamente pelo evento ' || event_row.event_type || '.'),
    'one_time', 'pending', COALESCE(NULLIF(rule_row.action_payload ->> 'priority', ''), 'medium'),
    COALESCE(NULLIF(rule_row.action_payload ->> 'category', ''), 'Automacao'), now() + make_interval(days => due_days)
  ) RETURNING id INTO task_id;

  UPDATE public.automation_runs SET status = 'completed', finished_at = now(), result = jsonb_build_object('task_id', task_id)
  WHERE id = run_row.id RETURNING * INTO run_row;
  RETURN run_row;
END $$;

REVOKE ALL ON FUNCTION public.claim_workspace_domain_events(text, uuid, integer), public.complete_workspace_domain_event(uuid, uuid), public.fail_workspace_domain_event(uuid, uuid, text), public.execute_task_automation(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_workspace_domain_events(text, uuid, integer), public.complete_workspace_domain_event(uuid, uuid), public.fail_workspace_domain_event(uuid, uuid, text), public.execute_task_automation(uuid, uuid, uuid) TO service_role;
REVOKE ALL ON FUNCTION public.automation_conditions_match(jsonb, jsonb), public.domain_event_next_retry_at(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.automation_conditions_match(jsonb, jsonb), public.domain_event_next_retry_at(integer) TO authenticated, service_role;

COMMIT;
