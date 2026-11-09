BEGIN;

CREATE TABLE IF NOT EXISTS public.client_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  period_month integer NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year integer NOT NULL CHECK (period_year BETWEEN 2000 AND 2100),
  status text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'waiting_documents', 'in_progress', 'in_review', 'delivered', 'closed', 'blocked')),
  progress_percent integer NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
  started_at timestamptz,
  delivered_at timestamptz,
  closed_at timestamptz,
  blocked_reason text,
  responsible_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_periods_unique_period UNIQUE (tenant_id, company_id, period_month, period_year)
);

CREATE INDEX IF NOT EXISTS idx_client_periods_tenant_period
ON public.client_periods(tenant_id, period_year, period_month);

CREATE INDEX IF NOT EXISTS idx_client_periods_company_period
ON public.client_periods(company_id, period_year, period_month);

CREATE INDEX IF NOT EXISTS idx_client_periods_status
ON public.client_periods(tenant_id, status);

CREATE OR REPLACE FUNCTION public.touch_client_periods()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.status = 'not_started' THEN
    NEW.started_at := NULL;
  ELSIF NEW.started_at IS NULL THEN
    NEW.started_at := now();
  END IF;

  IF NEW.status = 'delivered' AND NEW.delivered_at IS NULL THEN
    NEW.delivered_at := now();
  ELSIF NEW.status <> 'delivered' AND NEW.status <> 'closed' THEN
    NEW.delivered_at := NULL;
  END IF;

  IF NEW.status = 'closed' AND NEW.closed_at IS NULL THEN
    NEW.closed_at := now();
    NEW.delivered_at := COALESCE(NEW.delivered_at, now());
    NEW.progress_percent := 100;
  ELSIF NEW.status <> 'closed' THEN
    NEW.closed_at := NULL;
  END IF;

  IF NEW.status <> 'blocked' THEN
    NEW.blocked_reason := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_client_periods ON public.client_periods;
CREATE TRIGGER touch_client_periods
BEFORE UPDATE ON public.client_periods
FOR EACH ROW EXECUTE FUNCTION public.touch_client_periods();

ALTER TABLE public.client_periods ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_periods TO authenticated;

DROP POLICY IF EXISTS client_periods_select ON public.client_periods;
DROP POLICY IF EXISTS client_periods_insert ON public.client_periods;
DROP POLICY IF EXISTS client_periods_update ON public.client_periods;
DROP POLICY IF EXISTS client_periods_delete ON public.client_periods;
DROP POLICY IF EXISTS client_periods_collaborator_read_permission ON public.client_periods;
DROP POLICY IF EXISTS client_periods_collaborator_insert_permission ON public.client_periods;
DROP POLICY IF EXISTS client_periods_collaborator_update_permission ON public.client_periods;
DROP POLICY IF EXISTS client_periods_collaborator_delete_permission ON public.client_periods;

CREATE POLICY client_periods_select ON public.client_periods
FOR SELECT TO authenticated
USING (
  tenant_id = public.current_user_tenant_id()
  AND (
    public.can_manage_current_tenant()
    OR company_id = public.current_user_company_id()
  )
);

CREATE POLICY client_periods_insert ON public.client_periods
FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = public.current_user_tenant_id()
  AND public.can_manage_current_tenant()
  AND EXISTS (
    SELECT 1
    FROM public.companies c
    WHERE c.id = company_id
      AND c.tenant_id = public.current_user_tenant_id()
      AND c.status = 'active'
  )
  AND (
    responsible_user_id IS NULL
    OR public.profile_belongs_to_current_workspace(responsible_user_id)
  )
);

CREATE POLICY client_periods_update ON public.client_periods
FOR UPDATE TO authenticated
USING (
  tenant_id = public.current_user_tenant_id()
  AND public.can_manage_current_tenant()
)
WITH CHECK (
  tenant_id = public.current_user_tenant_id()
  AND public.can_manage_current_tenant()
  AND EXISTS (
    SELECT 1
    FROM public.companies c
    WHERE c.id = company_id
      AND c.tenant_id = public.current_user_tenant_id()
  )
  AND (
    responsible_user_id IS NULL
    OR public.profile_belongs_to_current_workspace(responsible_user_id)
  )
);

CREATE POLICY client_periods_delete ON public.client_periods
FOR DELETE TO authenticated
USING (
  tenant_id = public.current_user_tenant_id()
  AND public.current_user_account_type() = 'admin'
);

CREATE POLICY client_periods_collaborator_read_permission ON public.client_periods AS RESTRICTIVE
FOR SELECT TO authenticated
USING (
  public.current_user_account_type() <> 'collaborator'
  OR public.has_workspace_permission('clients', 'read')
  OR public.has_workspace_permission('tasks', 'read')
);

CREATE POLICY client_periods_collaborator_insert_permission ON public.client_periods AS RESTRICTIVE
FOR INSERT TO authenticated
WITH CHECK (
  public.current_user_account_type() <> 'collaborator'
  OR public.has_workspace_permission('clients', 'create')
  OR public.has_workspace_permission('tasks', 'create')
);

CREATE POLICY client_periods_collaborator_update_permission ON public.client_periods AS RESTRICTIVE
FOR UPDATE TO authenticated
USING (
  public.current_user_account_type() <> 'collaborator'
  OR public.has_workspace_permission('clients', 'update')
  OR public.has_workspace_permission('tasks', 'update')
)
WITH CHECK (
  public.current_user_account_type() <> 'collaborator'
  OR public.has_workspace_permission('clients', 'update')
  OR public.has_workspace_permission('tasks', 'update')
);

CREATE POLICY client_periods_collaborator_delete_permission ON public.client_periods AS RESTRICTIVE
FOR DELETE TO authenticated
USING (
  public.current_user_account_type() <> 'collaborator'
  OR public.has_workspace_permission('clients', 'delete')
);

REVOKE ALL ON FUNCTION public.touch_client_periods() FROM PUBLIC, anon, authenticated;

COMMIT;
