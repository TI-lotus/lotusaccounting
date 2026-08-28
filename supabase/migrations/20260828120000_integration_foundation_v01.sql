CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname
  INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.integration_connections'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%status%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.integration_connections DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE public.integration_connections
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_account_id text,
  ADD COLUMN IF NOT EXISTS provider_account_name text,
  ADD COLUMN IF NOT EXISTS scopes text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error_at timestamptz,
  ADD COLUMN IF NOT EXISTS credential_reference text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_by uuid;

UPDATE public.integration_connections
SET
  provider = COALESCE(provider, integration_id),
  metadata = COALESCE(metadata, '{}'::jsonb),
  credentials = '[]'::jsonb
WHERE provider IS NULL OR credentials <> '[]'::jsonb;

ALTER TABLE public.integration_connections
  ALTER COLUMN provider SET NOT NULL,
  ADD CONSTRAINT integration_connections_status_check
    CHECK (status IN ('disconnected', 'connecting', 'connected', 'error', 'expired', 'disabled', 'pending'));

CREATE INDEX IF NOT EXISTS idx_integration_connections_provider_status
  ON public.integration_connections(tenant_id, provider, status);

CREATE UNIQUE INDEX IF NOT EXISTS uq_integration_connections_provider_account
  ON public.integration_connections(tenant_id, provider, COALESCE(provider_account_id, 'default'));

COMMENT ON COLUMN public.integration_connections.credentials IS
  'Public credential metadata only. Secrets must live in integration_credentials and be read only by Edge Functions/service role.';

CREATE TABLE IF NOT EXISTS public.integration_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.integration_connections(id) ON DELETE CASCADE,
  provider text NOT NULL,
  secret_type text NOT NULL,
  secret_payload jsonb NOT NULL,
  expires_at timestamptz,
  rotated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connection_id, secret_type)
);

CREATE TABLE IF NOT EXISTS public.integration_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES public.integration_connections(id) ON DELETE SET NULL,
  provider text NOT NULL,
  event_type text NOT NULL,
  external_event_id text,
  entity_type text,
  entity_id uuid,
  status text NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'processing', 'processed', 'failed', 'ignored')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  normalized_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0,
  error_code text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_integration_events_external_event
  ON public.integration_events(provider, external_event_id)
  WHERE external_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_integration_events_tenant_provider_status
  ON public.integration_events(tenant_id, provider, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_integration_events_connection
  ON public.integration_events(connection_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.integration_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES public.integration_connections(id) ON DELETE SET NULL,
  provider text NOT NULL,
  external_event_id text,
  headers jsonb NOT NULL DEFAULT '{}'::jsonb,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  signature_valid boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'processing', 'processed', 'failed', 'ignored')),
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_integration_webhooks_external_event
  ON public.integration_webhook_events(provider, external_event_id)
  WHERE external_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_integration_webhooks_tenant_provider_status
  ON public.integration_webhook_events(tenant_id, provider, status, received_at DESC);

CREATE TABLE IF NOT EXISTS public.integration_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES public.integration_connections(id) ON DELETE SET NULL,
  provider text NOT NULL,
  sync_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'partial', 'failed')),
  started_at timestamptz,
  finished_at timestamptz,
  cursor text,
  items_received integer NOT NULL DEFAULT 0,
  items_processed integer NOT NULL DEFAULT 0,
  items_failed integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_code text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integration_sync_runs_tenant_provider_status
  ON public.integration_sync_runs(tenant_id, provider, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.integration_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES public.integration_connections(id) ON DELETE SET NULL,
  provider text NOT NULL,
  source text NOT NULL,
  operation text NOT NULL,
  error_code text,
  error_message text,
  retryable boolean NOT NULL DEFAULT false,
  attempt_number integer NOT NULL DEFAULT 1,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integration_errors_tenant_provider_resolved
  ON public.integration_errors(tenant_id, provider, resolved, created_at DESC);

CREATE TABLE IF NOT EXISTS public.integration_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES public.integration_connections(id) ON DELETE SET NULL,
  job_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'dead_letter')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  priority integer NOT NULL DEFAULT 5,
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  attempt_count integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 4,
  locked_at timestamptz,
  locked_by text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_integration_jobs_ready
  ON public.integration_jobs(status, scheduled_for, priority, created_at)
  WHERE status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS idx_integration_jobs_tenant_type_status
  ON public.integration_jobs(tenant_id, job_type, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.domain_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  entity_type text,
  entity_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'processed', 'failed', 'ignored')),
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_domain_events_tenant_status
  ON public.domain_events(tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_domain_events_type
  ON public.domain_events(event_type, created_at DESC);

CREATE TABLE IF NOT EXISTS public.automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  trigger_event_type text NOT NULL,
  conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  action_type text NOT NULL,
  action_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_rules_tenant_enabled
  ON public.automation_rules(tenant_id, enabled, trigger_event_type);

CREATE TABLE IF NOT EXISTS public.automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  rule_id uuid REFERENCES public.automation_rules(id) ON DELETE SET NULL,
  domain_event_id uuid REFERENCES public.domain_events(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
  started_at timestamptz,
  finished_at timestamptz,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_runs_tenant_status
  ON public.automation_runs(tenant_id, status, created_at DESC);

ALTER TABLE public.integration_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.touch_integration_foundation_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_integration_credentials_updated_at ON public.integration_credentials;
CREATE TRIGGER trg_touch_integration_credentials_updated_at
BEFORE UPDATE ON public.integration_credentials
FOR EACH ROW EXECUTE FUNCTION public.touch_integration_foundation_updated_at();

DROP TRIGGER IF EXISTS trg_touch_integration_events_updated_at ON public.integration_events;
CREATE TRIGGER trg_touch_integration_events_updated_at
BEFORE UPDATE ON public.integration_events
FOR EACH ROW EXECUTE FUNCTION public.touch_integration_foundation_updated_at();

DROP TRIGGER IF EXISTS trg_touch_integration_jobs_updated_at ON public.integration_jobs;
CREATE TRIGGER trg_touch_integration_jobs_updated_at
BEFORE UPDATE ON public.integration_jobs
FOR EACH ROW EXECUTE FUNCTION public.touch_integration_foundation_updated_at();

DROP TRIGGER IF EXISTS trg_touch_automation_rules_updated_at ON public.automation_rules;
CREATE TRIGGER trg_touch_automation_rules_updated_at
BEFORE UPDATE ON public.automation_rules
FOR EACH ROW EXECUTE FUNCTION public.touch_integration_foundation_updated_at();

CREATE OR REPLACE FUNCTION public.integration_next_retry_at(attempt_number integer)
RETURNS timestamptz
LANGUAGE sql
STABLE
AS $$
  SELECT now() + CASE
    WHEN attempt_number <= 1 THEN interval '30 seconds'
    WHEN attempt_number = 2 THEN interval '2 minutes'
    WHEN attempt_number = 3 THEN interval '10 minutes'
    ELSE interval '30 minutes'
  END
$$;

CREATE OR REPLACE FUNCTION public.claim_next_integration_job(worker_id text)
RETURNS public.integration_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  claimed public.integration_jobs;
BEGIN
  UPDATE public.integration_jobs
  SET
    status = 'processing',
    locked_at = now(),
    locked_by = worker_id,
    attempt_count = attempt_count + 1,
    updated_at = now()
  WHERE id = (
    SELECT id
    FROM public.integration_jobs
    WHERE status IN ('pending', 'failed')
      AND scheduled_for <= now()
      AND attempt_count < max_attempts
      AND (locked_at IS NULL OR locked_at < now() - interval '10 minutes')
    ORDER BY priority ASC, scheduled_for ASC, created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  RETURNING * INTO claimed;

  RETURN claimed;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_integration_job(job_id uuid)
RETURNS public.integration_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  updated_job public.integration_jobs;
BEGIN
  UPDATE public.integration_jobs
  SET
    status = 'completed',
    completed_at = now(),
    locked_at = NULL,
    locked_by = NULL,
    last_error = NULL,
    updated_at = now()
  WHERE id = job_id
  RETURNING * INTO updated_job;

  RETURN updated_job;
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_integration_job(job_id uuid, error_message text)
RETURNS public.integration_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  updated_job public.integration_jobs;
BEGIN
  UPDATE public.integration_jobs
  SET
    status = CASE
      WHEN attempt_count >= max_attempts THEN 'dead_letter'
      ELSE 'failed'
    END,
    scheduled_for = CASE
      WHEN attempt_count >= max_attempts THEN scheduled_for
      ELSE public.integration_next_retry_at(attempt_count)
    END,
    locked_at = NULL,
    locked_by = NULL,
    last_error = left(error_message, 1000),
    updated_at = now()
  WHERE id = job_id
  RETURNING * INTO updated_job;

  RETURN updated_job;
END;
$$;

CREATE OR REPLACE FUNCTION public.sanitize_integration_headers(headers jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  result jsonb := COALESCE(headers, '{}'::jsonb);
BEGIN
  result := result - 'authorization' - 'Authorization';
  result := result - 'cookie' - 'Cookie';
  result := result - 'x-api-key' - 'X-API-Key';
  result := result - 'x-hub-signature' - 'x-hub-signature-256';
  RETURN result;
END;
$$;

DROP POLICY IF EXISTS integration_events_select ON public.integration_events;
DROP POLICY IF EXISTS integration_events_insert ON public.integration_events;
DROP POLICY IF EXISTS integration_events_update ON public.integration_events;
DROP POLICY IF EXISTS integration_webhook_events_select ON public.integration_webhook_events;
DROP POLICY IF EXISTS integration_sync_runs_select ON public.integration_sync_runs;
DROP POLICY IF EXISTS integration_errors_select ON public.integration_errors;
DROP POLICY IF EXISTS integration_jobs_select ON public.integration_jobs;
DROP POLICY IF EXISTS domain_events_select ON public.domain_events;
DROP POLICY IF EXISTS automation_rules_select ON public.automation_rules;
DROP POLICY IF EXISTS automation_rules_insert ON public.automation_rules;
DROP POLICY IF EXISTS automation_rules_update ON public.automation_rules;
DROP POLICY IF EXISTS automation_runs_select ON public.automation_runs;

CREATE POLICY integration_events_select ON public.integration_events
FOR SELECT TO authenticated
USING (tenant_id = public.current_user_tenant_id() AND public.can_manage_current_tenant());

CREATE POLICY integration_events_insert ON public.integration_events
FOR INSERT TO authenticated
WITH CHECK (tenant_id = public.current_user_tenant_id() AND public.can_manage_current_tenant());

CREATE POLICY integration_events_update ON public.integration_events
FOR UPDATE TO authenticated
USING (tenant_id = public.current_user_tenant_id() AND public.can_manage_current_tenant())
WITH CHECK (tenant_id = public.current_user_tenant_id() AND public.can_manage_current_tenant());

CREATE POLICY integration_webhook_events_select ON public.integration_webhook_events
FOR SELECT TO authenticated
USING (tenant_id = public.current_user_tenant_id() AND public.can_manage_current_tenant());

CREATE POLICY integration_sync_runs_select ON public.integration_sync_runs
FOR SELECT TO authenticated
USING (tenant_id = public.current_user_tenant_id() AND public.can_manage_current_tenant());

CREATE POLICY integration_errors_select ON public.integration_errors
FOR SELECT TO authenticated
USING (tenant_id = public.current_user_tenant_id() AND public.can_manage_current_tenant());

CREATE POLICY integration_jobs_select ON public.integration_jobs
FOR SELECT TO authenticated
USING (tenant_id = public.current_user_tenant_id() AND public.can_manage_current_tenant());

CREATE POLICY domain_events_select ON public.domain_events
FOR SELECT TO authenticated
USING (tenant_id = public.current_user_tenant_id() AND public.can_manage_current_tenant());

CREATE POLICY automation_rules_select ON public.automation_rules
FOR SELECT TO authenticated
USING (tenant_id = public.current_user_tenant_id() AND public.can_manage_current_tenant());

CREATE POLICY automation_rules_insert ON public.automation_rules
FOR INSERT TO authenticated
WITH CHECK (tenant_id = public.current_user_tenant_id() AND public.can_manage_current_tenant());

CREATE POLICY automation_rules_update ON public.automation_rules
FOR UPDATE TO authenticated
USING (tenant_id = public.current_user_tenant_id() AND public.can_manage_current_tenant())
WITH CHECK (tenant_id = public.current_user_tenant_id() AND public.can_manage_current_tenant());

CREATE POLICY automation_runs_select ON public.automation_runs
FOR SELECT TO authenticated
USING (tenant_id = public.current_user_tenant_id() AND public.can_manage_current_tenant());

REVOKE ALL ON public.integration_credentials FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_next_integration_job(text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_integration_job(uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_integration_job(uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.integration_next_retry_at(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sanitize_integration_headers(jsonb) TO authenticated;
