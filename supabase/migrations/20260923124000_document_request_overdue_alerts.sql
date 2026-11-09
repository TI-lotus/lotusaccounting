BEGIN;

CREATE OR REPLACE FUNCTION public.sync_document_request_overdue_alert(target_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  request_tenant_id uuid;
  request_company_id uuid;
  request_period_id uuid;
  request_assigned_to uuid;
  request_title text;
  request_due_date date;
  request_status text;
  company_name text;
  recipient uuid := NULL;
BEGIN
  IF target_request_id IS NULL THEN
    RETURN;
  END IF;

  SELECT tenant_id, company_id, client_period_id, assigned_to, title, due_date, status
  INTO request_tenant_id, request_company_id, request_period_id, request_assigned_to, request_title, request_due_date, request_status
  FROM public.document_requests
  WHERE id = target_request_id;

  IF request_tenant_id IS NULL THEN
    IF auth.role() IS DISTINCT FROM 'service_role' THEN
      RETURN;
    END IF;

    UPDATE public.user_notifications
    SET read_at = COALESCE(read_at, now())
    WHERE kind = 'document_request_overdue'
      AND metadata ->> 'document_request_id' = target_request_id::text
      AND read_at IS NULL;
    RETURN;
  END IF;

  IF auth.role() IS DISTINCT FROM 'service_role'
    AND request_tenant_id IS DISTINCT FROM public.current_user_tenant_id() THEN
    RAISE EXCEPTION 'Cannot sync document request alert for another workspace' USING ERRCODE = '42501';
  END IF;

  IF request_due_date IS NULL
    OR request_due_date >= current_date
    OR request_status IN ('approved', 'waived', 'uploaded') THEN
    UPDATE public.user_notifications
    SET read_at = COALESCE(read_at, now())
    WHERE tenant_id = request_tenant_id
      AND kind = 'document_request_overdue'
      AND metadata ->> 'document_request_id' = target_request_id::text
      AND read_at IS NULL;
    RETURN;
  END IF;

  SELECT name INTO company_name
  FROM public.companies
  WHERE id = request_company_id;

  SELECT user_id INTO recipient
  FROM public.profiles
  WHERE user_id = request_assigned_to
    AND tenant_id = request_tenant_id
    AND account_type <> 'client'
  LIMIT 1;

  IF recipient IS NULL THEN
    SELECT responsible_user_id INTO recipient
    FROM public.companies
    WHERE id = request_company_id;
  END IF;

  IF recipient IS NULL THEN
    SELECT user_id INTO recipient
    FROM public.profiles
    WHERE tenant_id = request_tenant_id
      AND account_type = 'admin'
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  IF recipient IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM public.user_notifications
  WHERE tenant_id = request_tenant_id
    AND kind = 'document_request_overdue'
    AND metadata ->> 'document_request_id' = target_request_id::text;

  INSERT INTO public.user_notifications (tenant_id, user_id, kind, title, body, href, metadata)
  VALUES (
    request_tenant_id,
    recipient,
    'document_request_overdue',
    'Documento solicitado vencido',
    format('%s precisa enviar: %s', COALESCE(company_name, 'Cliente'), request_title),
    '/documents',
    jsonb_build_object(
      'document_request_id', target_request_id,
      'company_id', request_company_id,
      'client_period_id', request_period_id,
      'due_date', request_due_date,
      'status', request_status
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_overdue_document_request_alerts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  request_record record;
  synced_count integer := 0;
BEGIN
  FOR request_record IN
    SELECT id
    FROM public.document_requests
    WHERE due_date IS NOT NULL
      AND due_date < current_date
      AND status NOT IN ('approved', 'waived', 'uploaded')
  LOOP
    PERFORM public.sync_document_request_overdue_alert(request_record.id);
    synced_count := synced_count + 1;
  END LOOP;

  RETURN synced_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_document_request_overdue_alert_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.user_notifications
    SET read_at = COALESCE(read_at, now())
    WHERE tenant_id = OLD.tenant_id
      AND kind = 'document_request_overdue'
      AND metadata ->> 'document_request_id' = OLD.id::text
      AND read_at IS NULL;
    RETURN OLD;
  END IF;

  PERFORM public.sync_document_request_overdue_alert(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_document_request_overdue_alert ON public.document_requests;
CREATE TRIGGER sync_document_request_overdue_alert
AFTER INSERT OR UPDATE OR DELETE ON public.document_requests
FOR EACH ROW EXECUTE FUNCTION public.sync_document_request_overdue_alert_trigger();

SELECT public.sync_overdue_document_request_alerts();

REVOKE ALL ON FUNCTION public.sync_document_request_overdue_alert(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_overdue_document_request_alerts() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_document_request_overdue_alert_trigger() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_document_request_overdue_alert(uuid) TO authenticated;

COMMIT;
