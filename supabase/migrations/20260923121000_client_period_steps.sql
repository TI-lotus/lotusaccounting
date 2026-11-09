BEGIN;

CREATE TABLE IF NOT EXISTS public.client_period_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_period_id uuid NOT NULL REFERENCES public.client_periods(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  step_key text NOT NULL CHECK (step_key IN ('documents', 'classification', 'fiscal', 'accounting', 'review', 'delivery')),
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked', 'waived')),
  due_date date,
  completed_at timestamptz,
  blocked_reason text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_period_steps_unique_key UNIQUE (client_period_id, step_key)
);

CREATE INDEX IF NOT EXISTS idx_client_period_steps_period
ON public.client_period_steps(client_period_id, position);

CREATE INDEX IF NOT EXISTS idx_client_period_steps_tenant_status
ON public.client_period_steps(tenant_id, status);

CREATE OR REPLACE FUNCTION public.touch_client_period_steps()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();

  IF NEW.status = 'completed' AND NEW.completed_at IS NULL THEN
    NEW.completed_at := now();
  ELSIF NEW.status <> 'completed' THEN
    NEW.completed_at := NULL;
  END IF;

  IF NEW.status <> 'blocked' THEN
    NEW.blocked_reason := NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_default_client_period_steps()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.client_period_steps (
    tenant_id,
    client_period_id,
    company_id,
    step_key,
    title,
    description,
    position
  )
  VALUES
    (NEW.tenant_id, NEW.id, NEW.company_id, 'documents', 'Documentos recebidos', 'Coletar documentos e pendencias do cliente.', 10),
    (NEW.tenant_id, NEW.id, NEW.company_id, 'classification', 'Classificacao conferida', 'Validar classificacao e vinculo dos documentos.', 20),
    (NEW.tenant_id, NEW.id, NEW.company_id, 'fiscal', 'Fiscal executado', 'Executar rotinas fiscais internas da competencia.', 30),
    (NEW.tenant_id, NEW.id, NEW.company_id, 'accounting', 'Contabil executado', 'Executar conciliacoes e rotinas contabeis internas.', 40),
    (NEW.tenant_id, NEW.id, NEW.company_id, 'review', 'Revisao tecnica', 'Revisar pontos criticos antes da entrega.', 50),
    (NEW.tenant_id, NEW.id, NEW.company_id, 'delivery', 'Entrega ao cliente', 'Registrar entrega e evidencias de fechamento.', 60)
  ON CONFLICT (client_period_id, step_key) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_client_period_from_steps(target_period_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_steps integer;
  done_steps integer;
  blocked_steps integer;
  active_steps integer;
  next_status text;
  next_progress integer;
BEGIN
  SELECT
    count(*),
    count(*) FILTER (WHERE status IN ('completed', 'waived')),
    count(*) FILTER (WHERE status = 'blocked'),
    count(*) FILTER (WHERE status = 'in_progress')
  INTO total_steps, done_steps, blocked_steps, active_steps
  FROM public.client_period_steps
  WHERE client_period_id = target_period_id;

  IF total_steps = 0 THEN
    RETURN;
  END IF;

  next_progress := round((done_steps::numeric / total_steps::numeric) * 100)::integer;

  IF blocked_steps > 0 THEN
    next_status := 'blocked';
  ELSIF done_steps = total_steps THEN
    next_status := 'closed';
  ELSIF active_steps > 0 OR done_steps > 0 THEN
    next_status := 'in_progress';
  ELSE
    next_status := 'waiting_documents';
  END IF;

  UPDATE public.client_periods
  SET
    progress_percent = next_progress,
    status = CASE
      WHEN status IN ('delivered', 'closed') AND next_status <> 'blocked' THEN status
      ELSE next_status
    END,
    blocked_reason = CASE WHEN next_status = 'blocked' THEN 'Ha etapas bloqueadas nesta competencia.' ELSE NULL END
  WHERE id = target_period_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_client_period_from_steps_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.refresh_client_period_from_steps(COALESCE(NEW.client_period_id, OLD.client_period_id));
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_client_period_steps ON public.client_period_steps;
CREATE TRIGGER touch_client_period_steps
BEFORE UPDATE ON public.client_period_steps
FOR EACH ROW EXECUTE FUNCTION public.touch_client_period_steps();

DROP TRIGGER IF EXISTS create_default_client_period_steps ON public.client_periods;
CREATE TRIGGER create_default_client_period_steps
AFTER INSERT ON public.client_periods
FOR EACH ROW EXECUTE FUNCTION public.create_default_client_period_steps();

DROP TRIGGER IF EXISTS refresh_client_period_from_steps ON public.client_period_steps;
CREATE TRIGGER refresh_client_period_from_steps
AFTER INSERT OR UPDATE OR DELETE ON public.client_period_steps
FOR EACH ROW EXECUTE FUNCTION public.refresh_client_period_from_steps_trigger();

ALTER TABLE public.client_period_steps ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_period_steps TO authenticated;

DROP POLICY IF EXISTS client_period_steps_select ON public.client_period_steps;
DROP POLICY IF EXISTS client_period_steps_insert ON public.client_period_steps;
DROP POLICY IF EXISTS client_period_steps_update ON public.client_period_steps;
DROP POLICY IF EXISTS client_period_steps_delete ON public.client_period_steps;
DROP POLICY IF EXISTS client_period_steps_collaborator_read_permission ON public.client_period_steps;
DROP POLICY IF EXISTS client_period_steps_collaborator_insert_permission ON public.client_period_steps;
DROP POLICY IF EXISTS client_period_steps_collaborator_update_permission ON public.client_period_steps;
DROP POLICY IF EXISTS client_period_steps_collaborator_delete_permission ON public.client_period_steps;

CREATE POLICY client_period_steps_select ON public.client_period_steps
FOR SELECT TO authenticated
USING (
  tenant_id = public.current_user_tenant_id()
  AND (
    public.can_manage_current_tenant()
    OR company_id = public.current_user_company_id()
  )
);

CREATE POLICY client_period_steps_insert ON public.client_period_steps
FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = public.current_user_tenant_id()
  AND public.can_manage_current_tenant()
  AND EXISTS (
    SELECT 1
    FROM public.client_periods cp
    WHERE cp.id = client_period_id
      AND cp.tenant_id = public.current_user_tenant_id()
      AND cp.company_id = company_id
  )
);

CREATE POLICY client_period_steps_update ON public.client_period_steps
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
    FROM public.client_periods cp
    WHERE cp.id = client_period_id
      AND cp.tenant_id = public.current_user_tenant_id()
      AND cp.company_id = company_id
  )
);

CREATE POLICY client_period_steps_delete ON public.client_period_steps
FOR DELETE TO authenticated
USING (
  tenant_id = public.current_user_tenant_id()
  AND public.current_user_account_type() = 'admin'
);

CREATE POLICY client_period_steps_collaborator_read_permission ON public.client_period_steps AS RESTRICTIVE
FOR SELECT TO authenticated
USING (
  public.current_user_account_type() <> 'collaborator'
  OR public.has_workspace_permission('tasks', 'read')
  OR public.has_workspace_permission('clients', 'read')
);

CREATE POLICY client_period_steps_collaborator_insert_permission ON public.client_period_steps AS RESTRICTIVE
FOR INSERT TO authenticated
WITH CHECK (
  public.current_user_account_type() <> 'collaborator'
  OR public.has_workspace_permission('tasks', 'create')
  OR public.has_workspace_permission('clients', 'create')
);

CREATE POLICY client_period_steps_collaborator_update_permission ON public.client_period_steps AS RESTRICTIVE
FOR UPDATE TO authenticated
USING (
  public.current_user_account_type() <> 'collaborator'
  OR public.has_workspace_permission('tasks', 'update')
  OR public.has_workspace_permission('clients', 'update')
)
WITH CHECK (
  public.current_user_account_type() <> 'collaborator'
  OR public.has_workspace_permission('tasks', 'update')
  OR public.has_workspace_permission('clients', 'update')
);

CREATE POLICY client_period_steps_collaborator_delete_permission ON public.client_period_steps AS RESTRICTIVE
FOR DELETE TO authenticated
USING (
  public.current_user_account_type() <> 'collaborator'
  OR public.has_workspace_permission('tasks', 'delete')
  OR public.has_workspace_permission('clients', 'delete')
);

REVOKE ALL ON FUNCTION public.touch_client_period_steps() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_default_client_period_steps() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_client_period_from_steps(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_client_period_from_steps_trigger() FROM PUBLIC, anon, authenticated;

COMMIT;
