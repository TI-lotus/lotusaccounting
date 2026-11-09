BEGIN;

CREATE TABLE IF NOT EXISTS public.document_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  client_period_id uuid REFERENCES public.client_periods(id) ON DELETE CASCADE,
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  document_type text,
  due_date date,
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'uploaded', 'approved', 'rejected', 'waived')),
  document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  rejection_reason text,
  waived_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT document_requests_period_company_match CHECK (client_period_id IS NOT NULL OR company_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_document_requests_tenant_status
ON public.document_requests(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_document_requests_company_period
ON public.document_requests(company_id, client_period_id);

CREATE INDEX IF NOT EXISTS idx_document_requests_document
ON public.document_requests(document_id)
WHERE document_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.touch_document_requests()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();

  IF NEW.status <> 'rejected' THEN
    NEW.rejection_reason := NULL;
  END IF;

  IF NEW.status <> 'waived' THEN
    NEW.waived_reason := NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_document_request_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  doc_company uuid;
  doc_tenant uuid;
BEGIN
  IF NEW.client_period_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.client_periods cp
    WHERE cp.id = NEW.client_period_id
      AND cp.tenant_id = NEW.tenant_id
      AND cp.company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION 'Invalid period reference for document request';
  END IF;

  IF NEW.document_id IS NOT NULL THEN
    SELECT tenant_id, company_id INTO doc_tenant, doc_company
    FROM public.documents
    WHERE id = NEW.document_id;

    IF doc_tenant IS DISTINCT FROM NEW.tenant_id OR doc_company IS DISTINCT FROM NEW.company_id THEN
      RAISE EXCEPTION 'Document must belong to the same workspace and company';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND public.current_user_account_type() = 'client' THEN
    IF OLD.tenant_id IS DISTINCT FROM NEW.tenant_id
      OR OLD.company_id IS DISTINCT FROM NEW.company_id
      OR OLD.client_period_id IS DISTINCT FROM NEW.client_period_id
      OR OLD.requested_by IS DISTINCT FROM NEW.requested_by
      OR OLD.assigned_to IS DISTINCT FROM NEW.assigned_to
      OR OLD.title IS DISTINCT FROM NEW.title
      OR OLD.description IS DISTINCT FROM NEW.description
      OR OLD.document_type IS DISTINCT FROM NEW.document_type
      OR OLD.due_date IS DISTINCT FROM NEW.due_date
      OR OLD.rejection_reason IS DISTINCT FROM NEW.rejection_reason
      OR OLD.waived_reason IS DISTINCT FROM NEW.waived_reason THEN
      RAISE EXCEPTION 'Clients can only attach a document to their own request';
    END IF;

    IF OLD.status NOT IN ('requested', 'rejected') OR NEW.status <> 'uploaded' OR NEW.document_id IS NULL THEN
      RAISE EXCEPTION 'Clients can only mark requested or rejected document requests as uploaded';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_client_period_from_document_requests(target_period_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_requests integer;
  done_requests integer;
  rejected_requests integer;
  uploaded_requests integer;
BEGIN
  IF target_period_id IS NULL THEN
    RETURN;
  END IF;

  SELECT
    count(*),
    count(*) FILTER (WHERE status IN ('approved', 'waived')),
    count(*) FILTER (WHERE status = 'rejected'),
    count(*) FILTER (WHERE status = 'uploaded')
  INTO total_requests, done_requests, rejected_requests, uploaded_requests
  FROM public.document_requests
  WHERE client_period_id = target_period_id;

  IF total_requests = 0 THEN
    RETURN;
  END IF;

  UPDATE public.client_period_steps
  SET
    status = CASE
      WHEN rejected_requests > 0 THEN 'blocked'
      WHEN done_requests = total_requests THEN 'completed'
      WHEN uploaded_requests > 0 OR done_requests > 0 THEN 'in_progress'
      ELSE 'pending'
    END,
    blocked_reason = CASE WHEN rejected_requests > 0 THEN 'Ha documentos recusados nesta competencia.' ELSE NULL END
  WHERE client_period_id = target_period_id
    AND step_key = 'documents';
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_client_period_from_document_requests_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.refresh_client_period_from_document_requests(COALESCE(NEW.client_period_id, OLD.client_period_id));
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_document_request_write ON public.document_requests;
CREATE TRIGGER validate_document_request_write
BEFORE INSERT OR UPDATE ON public.document_requests
FOR EACH ROW EXECUTE FUNCTION public.validate_document_request_write();

DROP TRIGGER IF EXISTS touch_document_requests ON public.document_requests;
CREATE TRIGGER touch_document_requests
BEFORE UPDATE ON public.document_requests
FOR EACH ROW EXECUTE FUNCTION public.touch_document_requests();

DROP TRIGGER IF EXISTS refresh_client_period_from_document_requests ON public.document_requests;
CREATE TRIGGER refresh_client_period_from_document_requests
AFTER INSERT OR UPDATE OR DELETE ON public.document_requests
FOR EACH ROW EXECUTE FUNCTION public.refresh_client_period_from_document_requests_trigger();

ALTER TABLE public.document_requests ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_requests TO authenticated;

CREATE POLICY document_requests_select ON public.document_requests
FOR SELECT TO authenticated
USING (
  tenant_id = public.current_user_tenant_id()
  AND (
    public.can_manage_current_tenant()
    OR company_id = public.current_user_company_id()
  )
);

CREATE POLICY document_requests_insert ON public.document_requests
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
    client_period_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.client_periods cp
      WHERE cp.id = client_period_id
        AND cp.tenant_id = public.current_user_tenant_id()
        AND cp.company_id = company_id
    )
  )
);

CREATE POLICY document_requests_staff_update ON public.document_requests
FOR UPDATE TO authenticated
USING (
  tenant_id = public.current_user_tenant_id()
  AND public.can_manage_current_tenant()
)
WITH CHECK (
  tenant_id = public.current_user_tenant_id()
  AND public.can_manage_current_tenant()
);

CREATE POLICY document_requests_client_upload ON public.document_requests
FOR UPDATE TO authenticated
USING (
  tenant_id = public.current_user_tenant_id()
  AND company_id = public.current_user_company_id()
)
WITH CHECK (
  tenant_id = public.current_user_tenant_id()
  AND company_id = public.current_user_company_id()
);

CREATE POLICY document_requests_admin_delete ON public.document_requests
FOR DELETE TO authenticated
USING (
  tenant_id = public.current_user_tenant_id()
  AND public.current_user_account_type() = 'admin'
);

CREATE POLICY document_requests_collaborator_read_permission ON public.document_requests AS RESTRICTIVE
FOR SELECT TO authenticated
USING (
  public.current_user_account_type() <> 'collaborator'
  OR public.has_workspace_permission('documents', 'read')
);

CREATE POLICY document_requests_collaborator_insert_permission ON public.document_requests AS RESTRICTIVE
FOR INSERT TO authenticated
WITH CHECK (
  public.current_user_account_type() <> 'collaborator'
  OR public.has_workspace_permission('documents', 'create')
);

CREATE POLICY document_requests_collaborator_update_permission ON public.document_requests AS RESTRICTIVE
FOR UPDATE TO authenticated
USING (
  public.current_user_account_type() <> 'collaborator'
  OR public.has_workspace_permission('documents', 'update')
)
WITH CHECK (
  public.current_user_account_type() <> 'collaborator'
  OR public.has_workspace_permission('documents', 'update')
);

CREATE POLICY document_requests_collaborator_delete_permission ON public.document_requests AS RESTRICTIVE
FOR DELETE TO authenticated
USING (
  public.current_user_account_type() <> 'collaborator'
  OR public.has_workspace_permission('documents', 'delete')
);

REVOKE ALL ON FUNCTION public.touch_document_requests() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_document_request_write() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_client_period_from_document_requests(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_client_period_from_document_requests_trigger() FROM PUBLIC, anon, authenticated;

COMMIT;
