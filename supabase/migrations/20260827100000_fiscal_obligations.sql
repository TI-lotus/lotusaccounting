CREATE TABLE IF NOT EXISTS public.fiscal_obligations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  tax_regime text,
  recurrence text NOT NULL DEFAULT 'monthly',
  period_month int,
  period_year int,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  priority text NOT NULL DEFAULT 'medium',
  completed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fiscal_obligations ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_fiscal_obligations_tenant_id
  ON public.fiscal_obligations(tenant_id);

CREATE INDEX IF NOT EXISTS idx_fiscal_obligations_company_id
  ON public.fiscal_obligations(company_id);

CREATE INDEX IF NOT EXISTS idx_fiscal_obligations_due_date
  ON public.fiscal_obligations(due_date);

CREATE INDEX IF NOT EXISTS idx_fiscal_obligations_status
  ON public.fiscal_obligations(status);

DROP POLICY IF EXISTS fiscal_obligations_tenant_select ON public.fiscal_obligations;
CREATE POLICY fiscal_obligations_tenant_select
ON public.fiscal_obligations
FOR SELECT TO authenticated
USING (tenant_id = public.current_user_tenant_id());

DROP POLICY IF EXISTS fiscal_obligations_tenant_insert ON public.fiscal_obligations;
CREATE POLICY fiscal_obligations_tenant_insert
ON public.fiscal_obligations
FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = public.current_user_tenant_id()
  AND public.current_user_account_type() IN ('admin', 'collaborator')
);

DROP POLICY IF EXISTS fiscal_obligations_tenant_update ON public.fiscal_obligations;
CREATE POLICY fiscal_obligations_tenant_update
ON public.fiscal_obligations
FOR UPDATE TO authenticated
USING (
  tenant_id = public.current_user_tenant_id()
  AND public.current_user_account_type() IN ('admin', 'collaborator')
)
WITH CHECK (
  tenant_id = public.current_user_tenant_id()
  AND public.current_user_account_type() IN ('admin', 'collaborator')
);

DROP POLICY IF EXISTS fiscal_obligations_tenant_delete ON public.fiscal_obligations;
CREATE POLICY fiscal_obligations_tenant_delete
ON public.fiscal_obligations
FOR DELETE TO authenticated
USING (
  tenant_id = public.current_user_tenant_id()
  AND public.current_user_account_type() IN ('admin', 'collaborator')
);

DROP POLICY IF EXISTS client_scope_fiscal_obligations ON public.fiscal_obligations;
CREATE POLICY client_scope_fiscal_obligations ON public.fiscal_obligations
AS RESTRICTIVE
FOR ALL TO authenticated
USING (
  public.current_user_account_type() <> 'client'
  OR company_id = public.current_user_company_id()
)
WITH CHECK (
  public.current_user_account_type() <> 'client'
  OR company_id = public.current_user_company_id()
);

CREATE OR REPLACE FUNCTION public.touch_fiscal_obligations_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_fiscal_obligations_updated_at ON public.fiscal_obligations;
CREATE TRIGGER trg_touch_fiscal_obligations_updated_at
BEFORE UPDATE ON public.fiscal_obligations
FOR EACH ROW
EXECUTE FUNCTION public.touch_fiscal_obligations_updated_at();

CREATE OR REPLACE FUNCTION public.log_fiscal_obligation_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  action_name text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    action_name := 'created';
  ELSIF TG_OP = 'UPDATE' THEN
    action_name := 'updated';
  ELSE
    action_name := 'deleted';
  END IF;

  INSERT INTO public.activity_logs (
    tenant_id,
    company_id,
    user_id,
    entity,
    entity_id,
    action,
    metadata
  )
  VALUES (
    COALESCE(NEW.tenant_id, OLD.tenant_id),
    COALESCE(NEW.company_id, OLD.company_id),
    auth.uid(),
    'fiscal_obligation',
    COALESCE(NEW.id, OLD.id),
    action_name,
    jsonb_build_object(
      'name', COALESCE(NEW.name, OLD.name),
      'status', COALESCE(NEW.status, OLD.status),
      'due_date', COALESCE(NEW.due_date, OLD.due_date)
    )
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_fiscal_obligation_activity ON public.fiscal_obligations;
CREATE TRIGGER trg_log_fiscal_obligation_activity
AFTER INSERT OR UPDATE OR DELETE ON public.fiscal_obligations
FOR EACH ROW
EXECUTE FUNCTION public.log_fiscal_obligation_activity();
