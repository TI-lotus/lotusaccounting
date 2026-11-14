BEGIN;

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

  IF NEW.status IN ('uploaded', 'approved') AND NEW.document_id IS NULL THEN
    RAISE EXCEPTION 'Document request status % requires an attached document', NEW.status;
  END IF;

  IF NEW.status = 'rejected' AND NULLIF(btrim(COALESCE(NEW.rejection_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Rejected document requests require a reason';
  END IF;

  IF NEW.status = 'waived' AND NULLIF(btrim(COALESCE(NEW.waived_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Waived document requests require a reason';
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
      OR (
        OLD.rejection_reason IS DISTINCT FROM NEW.rejection_reason
        AND NOT (OLD.status = 'rejected' AND NEW.status = 'uploaded' AND NEW.rejection_reason IS NULL)
      )
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

REVOKE ALL ON FUNCTION public.validate_document_request_write() FROM PUBLIC, anon, authenticated;

COMMIT;
