BEGIN;

CREATE OR REPLACE FUNCTION public.resolve_operational_alert_recipient(
  alert_tenant_id uuid,
  alert_company_id uuid DEFAULT NULL,
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
      AND account_type <> 'client'
      AND status = 'active'
    LIMIT 1;
    IF recipient IS NOT NULL THEN
      RETURN recipient;
    END IF;
  END IF;

  IF alert_company_id IS NOT NULL THEN
    SELECT p.user_id INTO recipient
    FROM public.companies c
    JOIN public.profiles p ON p.user_id = c.responsible_user_id
    WHERE c.id = alert_company_id
      AND c.tenant_id = alert_tenant_id
      AND p.tenant_id = alert_tenant_id
      AND p.account_type <> 'client'
      AND p.status = 'active'
    LIMIT 1;
    IF recipient IS NOT NULL THEN
      RETURN recipient;
    END IF;
  END IF;

  SELECT user_id INTO recipient
  FROM public.profiles
  WHERE tenant_id = alert_tenant_id
    AND account_type = 'admin'
    AND status = 'active'
  ORDER BY created_at ASC
  LIMIT 1;

  RETURN recipient;
END;
$$;

CREATE OR REPLACE FUNCTION public.close_operational_alert(
  alert_kind text,
  metadata_key text,
  metadata_value uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  UPDATE public.user_notifications
  SET read_at = COALESCE(read_at, now())
  WHERE kind = alert_kind
    AND metadata ->> metadata_key = metadata_value::text
    AND read_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_task_overdue_alert(target_task_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  task_row record;
  recipient uuid;
BEGIN
  SELECT t.*, c.name AS company_name
  INTO task_row
  FROM public.tasks t
  LEFT JOIN public.companies c ON c.id = t.company_id
  WHERE t.id = target_task_id;

  IF task_row.id IS NULL THEN
    PERFORM public.close_operational_alert('task_overdue', 'task_id', target_task_id);
    RETURN;
  END IF;

  IF task_row.due_date IS NULL
    OR task_row.due_date::date >= current_date
    OR task_row.status = 'completed'
  THEN
    PERFORM public.close_operational_alert('task_overdue', 'task_id', target_task_id);
    RETURN;
  END IF;

  recipient := public.resolve_operational_alert_recipient(task_row.tenant_id, task_row.company_id, task_row.assigned_to);
  IF recipient IS NULL THEN RETURN; END IF;

  DELETE FROM public.user_notifications
  WHERE tenant_id = task_row.tenant_id
    AND kind = 'task_overdue'
    AND metadata ->> 'task_id' = task_row.id::text;

  INSERT INTO public.user_notifications (tenant_id, user_id, kind, title, body, href, metadata)
  VALUES (
    task_row.tenant_id,
    recipient,
    'task_overdue',
    'Tarefa atrasada',
    format('%s%s', task_row.title, CASE WHEN task_row.company_name IS NULL THEN '' ELSE format(' · %s', task_row.company_name) END),
    '/work-queue',
    jsonb_build_object('task_id', task_row.id, 'company_id', task_row.company_id, 'due_date', task_row.due_date::date, 'status', task_row.status)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_task_overdue_alert_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.close_operational_alert('task_overdue', 'task_id', OLD.id);
    RETURN OLD;
  END IF;

  PERFORM public.sync_task_overdue_alert(NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_task_review_rejected_alert(target_review_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  review_row record;
  recipient uuid;
BEGIN
  SELECT r.*, t.title AS task_title, t.company_id, t.assigned_to, c.name AS company_name
  INTO review_row
  FROM public.task_reviews r
  JOIN public.tasks t ON t.id = r.task_id
  LEFT JOIN public.companies c ON c.id = t.company_id
  WHERE r.id = target_review_id;

  IF review_row.id IS NULL OR review_row.status <> 'rejected' THEN
    PERFORM public.close_operational_alert('task_review_rejected', 'task_review_id', target_review_id);
    RETURN;
  END IF;

  recipient := public.resolve_operational_alert_recipient(review_row.tenant_id, review_row.company_id, review_row.assigned_to);
  IF recipient IS NULL THEN RETURN; END IF;

  DELETE FROM public.user_notifications
  WHERE tenant_id = review_row.tenant_id
    AND kind = 'task_review_rejected'
    AND metadata ->> 'task_review_id' = review_row.id::text;

  INSERT INTO public.user_notifications (tenant_id, user_id, kind, title, body, href, metadata)
  VALUES (
    review_row.tenant_id,
    recipient,
    'task_review_rejected',
    'Revisão reprovada',
    format('%s%s%s', review_row.task_title, CASE WHEN review_row.company_name IS NULL THEN '' ELSE format(' · %s', review_row.company_name) END, CASE WHEN review_row.comment IS NULL THEN '' ELSE format(': %s', review_row.comment) END),
    '/work-queue',
    jsonb_build_object('task_review_id', review_row.id, 'task_id', review_row.task_id, 'company_id', review_row.company_id, 'comment', review_row.comment)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_task_review_rejected_alert_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.close_operational_alert('task_review_rejected', 'task_review_id', OLD.id);
    RETURN OLD;
  END IF;

  PERFORM public.sync_task_review_rejected_alert(NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_client_period_blocked_alert(target_period_id uuid)
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

  IF period_row.id IS NULL OR period_row.status <> 'blocked' THEN
    PERFORM public.close_operational_alert('client_period_blocked', 'client_period_id', target_period_id);
    RETURN;
  END IF;

  recipient := public.resolve_operational_alert_recipient(period_row.tenant_id, period_row.company_id, period_row.responsible_user_id);
  IF recipient IS NULL THEN RETURN; END IF;

  DELETE FROM public.user_notifications
  WHERE tenant_id = period_row.tenant_id
    AND kind = 'client_period_blocked'
    AND metadata ->> 'client_period_id' = period_row.id::text;

  INSERT INTO public.user_notifications (tenant_id, user_id, kind, title, body, href, metadata)
  VALUES (
    period_row.tenant_id,
    recipient,
    'client_period_blocked',
    'Competência bloqueada',
    format('%s · %s/%s%s', period_row.company_name, lpad(period_row.period_month::text, 2, '0'), period_row.period_year, CASE WHEN period_row.blocked_reason IS NULL THEN '' ELSE format(': %s', period_row.blocked_reason) END),
    '/periods',
    jsonb_build_object('client_period_id', period_row.id, 'company_id', period_row.company_id, 'period_month', period_row.period_month, 'period_year', period_row.period_year, 'blocked_reason', period_row.blocked_reason)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_client_period_blocked_alert_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.close_operational_alert('client_period_blocked', 'client_period_id', OLD.id);
    RETURN OLD;
  END IF;

  PERFORM public.sync_client_period_blocked_alert(NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_invoice_overdue_alert(target_invoice_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  invoice_row record;
  recipient uuid;
BEGIN
  SELECT i.*, c.name AS company_name
  INTO invoice_row
  FROM public.invoices i
  LEFT JOIN public.companies c ON c.id = i.company_id
  WHERE i.id = target_invoice_id;

  IF invoice_row.id IS NULL THEN
    PERFORM public.close_operational_alert('invoice_overdue', 'invoice_id', target_invoice_id);
    RETURN;
  END IF;

  IF invoice_row.due_date IS NULL
    OR invoice_row.status IN ('paid', 'cancelled', 'canceled')
    OR (invoice_row.status <> 'overdue' AND invoice_row.due_date >= current_date)
  THEN
    PERFORM public.close_operational_alert('invoice_overdue', 'invoice_id', target_invoice_id);
    RETURN;
  END IF;

  recipient := public.resolve_operational_alert_recipient(invoice_row.tenant_id, invoice_row.company_id, NULL);
  IF recipient IS NULL THEN RETURN; END IF;

  DELETE FROM public.user_notifications
  WHERE tenant_id = invoice_row.tenant_id
    AND kind = 'invoice_overdue'
    AND metadata ->> 'invoice_id' = invoice_row.id::text;

  INSERT INTO public.user_notifications (tenant_id, user_id, kind, title, body, href, metadata)
  VALUES (
    invoice_row.tenant_id,
    recipient,
    'invoice_overdue',
    'Fatura vencida',
    format('%s%s venceu em %s.', COALESCE(invoice_row.number, invoice_row.id::text), CASE WHEN invoice_row.company_name IS NULL THEN '' ELSE format(' · %s', invoice_row.company_name) END, to_char(invoice_row.due_date, 'DD/MM/YYYY')),
    '/invoices',
    jsonb_build_object('invoice_id', invoice_row.id, 'company_id', invoice_row.company_id, 'due_date', invoice_row.due_date, 'status', invoice_row.status)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_invoice_overdue_alert_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.close_operational_alert('invoice_overdue', 'invoice_id', OLD.id);
    RETURN OLD;
  END IF;

  PERFORM public.sync_invoice_overdue_alert(NEW.id);
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
  FOR item IN SELECT id FROM public.tasks WHERE status <> 'completed' LOOP
    PERFORM public.sync_task_overdue_alert(item.id);
    synced_count := synced_count + 1;
  END LOOP;

  FOR item IN SELECT id FROM public.task_reviews WHERE status = 'rejected' LOOP
    PERFORM public.sync_task_review_rejected_alert(item.id);
    synced_count := synced_count + 1;
  END LOOP;

  FOR item IN SELECT id FROM public.client_periods WHERE status = 'blocked' LOOP
    PERFORM public.sync_client_period_blocked_alert(item.id);
    synced_count := synced_count + 1;
  END LOOP;

  FOR item IN SELECT id FROM public.invoices WHERE status NOT IN ('paid', 'cancelled', 'canceled') LOOP
    PERFORM public.sync_invoice_overdue_alert(item.id);
    synced_count := synced_count + 1;
  END LOOP;

  RETURN synced_count;
END;
$$;

DROP TRIGGER IF EXISTS sync_task_overdue_alert ON public.tasks;
CREATE TRIGGER sync_task_overdue_alert
AFTER INSERT OR UPDATE OF status, due_date, assigned_to, company_id, tenant_id OR DELETE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.sync_task_overdue_alert_trigger();

DROP TRIGGER IF EXISTS sync_task_review_rejected_alert ON public.task_reviews;
CREATE TRIGGER sync_task_review_rejected_alert
AFTER INSERT OR UPDATE OF status, comment, task_id OR DELETE ON public.task_reviews
FOR EACH ROW EXECUTE FUNCTION public.sync_task_review_rejected_alert_trigger();

DROP TRIGGER IF EXISTS sync_client_period_blocked_alert ON public.client_periods;
CREATE TRIGGER sync_client_period_blocked_alert
AFTER INSERT OR UPDATE OF status, blocked_reason, responsible_user_id OR DELETE ON public.client_periods
FOR EACH ROW EXECUTE FUNCTION public.sync_client_period_blocked_alert_trigger();

DROP TRIGGER IF EXISTS sync_invoice_overdue_alert ON public.invoices;
CREATE TRIGGER sync_invoice_overdue_alert
AFTER INSERT OR UPDATE OF status, due_date, company_id, tenant_id OR DELETE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.sync_invoice_overdue_alert_trigger();

SELECT public.sync_operational_alerts();

REVOKE ALL ON FUNCTION public.resolve_operational_alert_recipient(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.close_operational_alert(text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_task_overdue_alert(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_task_overdue_alert_trigger() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_task_review_rejected_alert(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_task_review_rejected_alert_trigger() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_client_period_blocked_alert(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_client_period_blocked_alert_trigger() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_invoice_overdue_alert(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_invoice_overdue_alert_trigger() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_operational_alerts() FROM PUBLIC, anon, authenticated;

COMMIT;
