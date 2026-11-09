BEGIN;

CREATE OR REPLACE FUNCTION public.resolve_client_alert_recipient(
  alert_tenant_id uuid,
  alert_company_id uuid,
  preferred_user_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  recipient uuid;
BEGIN
  IF preferred_user_id IS NOT NULL THEN
    SELECT user_id INTO recipient
    FROM public.profiles
    WHERE user_id = preferred_user_id
      AND tenant_id = alert_tenant_id
      AND company_id = alert_company_id
      AND account_type = 'client'
      AND status = 'active'
    LIMIT 1;
    IF recipient IS NOT NULL THEN
      RETURN recipient;
    END IF;
  END IF;

  SELECT user_id INTO recipient
  FROM public.profiles
  WHERE tenant_id = alert_tenant_id
    AND company_id = alert_company_id
    AND account_type = 'client'
    AND status = 'active'
  ORDER BY created_at ASC
  LIMIT 1;

  RETURN recipient;
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

CREATE OR REPLACE FUNCTION public.sync_document_request_uploaded_alert(target_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  request_row record;
  recipient uuid;
BEGIN
  SELECT dr.*, c.name AS company_name
  INTO request_row
  FROM public.document_requests dr
  JOIN public.companies c ON c.id = dr.company_id
  WHERE dr.id = target_request_id;

  IF request_row.id IS NULL OR request_row.status <> 'uploaded' THEN
    PERFORM public.close_operational_alert('document_request_uploaded', 'document_request_id', target_request_id);
    RETURN;
  END IF;

  recipient := public.resolve_operational_alert_recipient(request_row.tenant_id, request_row.company_id, request_row.assigned_to);
  IF recipient IS NULL THEN RETURN; END IF;

  DELETE FROM public.user_notifications
  WHERE tenant_id = request_row.tenant_id
    AND kind = 'document_request_uploaded'
    AND metadata ->> 'document_request_id' = request_row.id::text;

  INSERT INTO public.user_notifications (tenant_id, user_id, kind, title, body, href, metadata)
  VALUES (
    request_row.tenant_id,
    recipient,
    'document_request_uploaded',
    'Documento enviado pelo cliente',
    format('%s enviou: %s', request_row.company_name, request_row.title),
    '/documents',
    jsonb_build_object(
      'document_request_id', request_row.id,
      'document_id', request_row.document_id,
      'company_id', request_row.company_id,
      'client_period_id', request_row.client_period_id,
      'status', request_row.status
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_document_request_rejected_alert(target_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  request_row record;
  recipient uuid;
BEGIN
  SELECT dr.*, c.name AS company_name
  INTO request_row
  FROM public.document_requests dr
  JOIN public.companies c ON c.id = dr.company_id
  WHERE dr.id = target_request_id;

  IF request_row.id IS NULL OR request_row.status <> 'rejected' THEN
    PERFORM public.close_operational_alert('document_request_rejected', 'document_request_id', target_request_id);
    RETURN;
  END IF;

  recipient := public.resolve_client_alert_recipient(request_row.tenant_id, request_row.company_id, request_row.assigned_to);
  IF recipient IS NULL THEN RETURN; END IF;

  DELETE FROM public.user_notifications
  WHERE tenant_id = request_row.tenant_id
    AND kind = 'document_request_rejected'
    AND metadata ->> 'document_request_id' = request_row.id::text;

  INSERT INTO public.user_notifications (tenant_id, user_id, kind, title, body, href, metadata)
  VALUES (
    request_row.tenant_id,
    recipient,
    'document_request_rejected',
    'Documento recusado',
    format('%s%s', request_row.title, CASE WHEN request_row.rejection_reason IS NULL THEN '' ELSE format(': %s', request_row.rejection_reason) END),
    '/documents',
    jsonb_build_object(
      'document_request_id', request_row.id,
      'company_id', request_row.company_id,
      'client_period_id', request_row.client_period_id,
      'status', request_row.status,
      'rejection_reason', request_row.rejection_reason
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_document_request_status_alerts_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.close_operational_alert('document_request_uploaded', 'document_request_id', OLD.id);
    PERFORM public.close_operational_alert('document_request_rejected', 'document_request_id', OLD.id);
    RETURN OLD;
  END IF;

  PERFORM public.sync_document_request_uploaded_alert(NEW.id);
  PERFORM public.sync_document_request_rejected_alert(NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_client_period_stale_alert(target_period_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  period_row record;
  recipient uuid;
BEGIN
  SELECT cp.*, c.name AS company_name
  INTO period_row
  FROM public.client_periods cp
  JOIN public.companies c ON c.id = cp.company_id
  WHERE cp.id = target_period_id;

  IF period_row.id IS NULL
    OR period_row.status NOT IN ('not_started', 'waiting_documents', 'in_progress', 'in_review')
    OR period_row.updated_at::date > current_date - 7
  THEN
    PERFORM public.close_operational_alert('client_period_stale', 'client_period_id', target_period_id);
    RETURN;
  END IF;

  recipient := public.resolve_operational_alert_recipient(period_row.tenant_id, period_row.company_id, period_row.responsible_user_id);
  IF recipient IS NULL THEN RETURN; END IF;

  DELETE FROM public.user_notifications
  WHERE tenant_id = period_row.tenant_id
    AND kind = 'client_period_stale'
    AND metadata ->> 'client_period_id' = period_row.id::text;

  INSERT INTO public.user_notifications (tenant_id, user_id, kind, title, body, href, metadata)
  VALUES (
    period_row.tenant_id,
    recipient,
    'client_period_stale',
    'Competência parada',
    format('%s · %s/%s sem atualização há pelo menos 7 dias.', period_row.company_name, lpad(period_row.period_month::text, 2, '0'), period_row.period_year),
    '/periods',
    jsonb_build_object(
      'client_period_id', period_row.id,
      'company_id', period_row.company_id,
      'period_month', period_row.period_month,
      'period_year', period_row.period_year,
      'status', period_row.status,
      'last_updated_at', period_row.updated_at
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_client_period_stale_alert_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.close_operational_alert('client_period_stale', 'client_period_id', OLD.id);
    RETURN OLD;
  END IF;

  PERFORM public.sync_client_period_stale_alert(NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_operational_alerts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  item record;
  synced_count integer := 0;
BEGIN
  FOR item IN SELECT id FROM public.document_requests LOOP
    PERFORM public.sync_document_request_overdue_alert(item.id);
    PERFORM public.sync_document_request_uploaded_alert(item.id);
    PERFORM public.sync_document_request_rejected_alert(item.id);
    synced_count := synced_count + 1;
  END LOOP;

  FOR item IN SELECT id FROM public.tasks WHERE status <> 'completed' LOOP
    PERFORM public.sync_task_overdue_alert(item.id);
    synced_count := synced_count + 1;
  END LOOP;

  FOR item IN SELECT id FROM public.task_reviews WHERE status = 'rejected' LOOP
    PERFORM public.sync_task_review_rejected_alert(item.id);
    synced_count := synced_count + 1;
  END LOOP;

  FOR item IN SELECT id FROM public.client_periods WHERE status IN ('not_started', 'waiting_documents', 'in_progress', 'in_review', 'blocked') LOOP
    PERFORM public.sync_client_period_blocked_alert(item.id);
    PERFORM public.sync_client_period_stale_alert(item.id);
    synced_count := synced_count + 1;
  END LOOP;

  FOR item IN SELECT id FROM public.invoices WHERE status NOT IN ('paid', 'cancelled', 'canceled') LOOP
    PERFORM public.sync_invoice_overdue_alert(item.id);
    synced_count := synced_count + 1;
  END LOOP;

  RETURN synced_count;
END;
$$;

DROP TRIGGER IF EXISTS sync_document_request_status_alerts ON public.document_requests;
CREATE TRIGGER sync_document_request_status_alerts
AFTER INSERT OR UPDATE OF status, document_id, assigned_to, rejection_reason OR DELETE ON public.document_requests
FOR EACH ROW EXECUTE FUNCTION public.sync_document_request_status_alerts_trigger();

DROP TRIGGER IF EXISTS sync_client_period_stale_alert ON public.client_periods;
CREATE TRIGGER sync_client_period_stale_alert
AFTER INSERT OR UPDATE OR DELETE ON public.client_periods
FOR EACH ROW EXECUTE FUNCTION public.sync_client_period_stale_alert_trigger();

SELECT public.sync_operational_alerts();

REVOKE ALL ON FUNCTION public.resolve_client_alert_recipient(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_document_request_write() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_document_request_uploaded_alert(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_document_request_rejected_alert(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_document_request_status_alerts_trigger() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_client_period_stale_alert(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_client_period_stale_alert_trigger() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_operational_alerts() FROM PUBLIC, anon, authenticated;

COMMIT;
