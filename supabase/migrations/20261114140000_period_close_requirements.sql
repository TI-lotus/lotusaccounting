BEGIN;

CREATE OR REPLACE FUNCTION public.period_operational_requirements_complete(target_period_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.client_period_steps
    WHERE client_period_id = target_period_id
      AND status NOT IN ('completed', 'waived')
  ) THEN RETURN false; END IF;

  IF EXISTS (
    SELECT 1 FROM public.client_period_checklist_items
    WHERE client_period_id = target_period_id
      AND status NOT IN ('completed', 'waived')
  ) THEN RETURN false; END IF;

  IF EXISTS (
    SELECT 1 FROM public.document_requests
    WHERE client_period_id = target_period_id
      AND status NOT IN ('approved', 'waived')
  ) THEN RETURN false; END IF;

  IF EXISTS (
    SELECT 1
    FROM public.fiscal_obligations
    WHERE client_period_id = target_period_id
      AND status NOT IN ('completed', 'cancelled', 'canceled')
  ) THEN RETURN false; END IF;

  IF EXISTS (
    SELECT 1
    FROM public.task_reviews review
    JOIN public.client_period_checklist_items item ON item.task_id = review.task_id
    WHERE item.client_period_id = target_period_id
      AND review.status = 'pending_review'
  ) THEN RETURN false; END IF;

  RETURN true;
END;
$$;

-- The two existing refreshers used to close a period when only their own
-- collection was complete. Recalculate the same progress, but defer `closed`
-- until every operational collection is resolved.
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
  SELECT count(*),
         count(*) FILTER (WHERE status IN ('completed', 'waived')),
         count(*) FILTER (WHERE status = 'blocked'),
         count(*) FILTER (WHERE status = 'in_progress')
  INTO total_steps, done_steps, blocked_steps, active_steps
  FROM public.client_period_steps
  WHERE client_period_id = target_period_id;

  IF total_steps = 0 THEN RETURN; END IF;

  next_progress := round((done_steps::numeric / total_steps::numeric) * 100)::integer;
  IF blocked_steps > 0 THEN
    next_status := 'blocked';
  ELSIF done_steps = total_steps AND public.period_operational_requirements_complete(target_period_id) THEN
    next_status := 'closed';
  ELSIF active_steps > 0 OR done_steps > 0 THEN
    next_status := 'in_progress';
  ELSE
    next_status := 'waiting_documents';
  END IF;

  UPDATE public.client_periods
  SET progress_percent = next_progress,
      status = CASE WHEN status = 'delivered' AND next_status NOT IN ('blocked', 'closed') THEN status ELSE next_status END,
      blocked_reason = CASE WHEN next_status = 'blocked' THEN 'Ha etapas bloqueadas nesta competencia.' ELSE NULL END
  WHERE id = target_period_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_client_period_from_checklist(target_period_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_items integer;
  done_items integer;
  blocked_items integer;
  review_items integer;
  active_items integer;
  next_status text;
  next_progress integer;
BEGIN
  SELECT count(*),
         count(*) FILTER (WHERE status IN ('completed', 'waived')),
         count(*) FILTER (WHERE status = 'blocked'),
         count(*) FILTER (WHERE status = 'in_review'),
         count(*) FILTER (WHERE status = 'in_progress')
  INTO total_items, done_items, blocked_items, review_items, active_items
  FROM public.client_period_checklist_items
  WHERE client_period_id = target_period_id;

  IF total_items = 0 THEN RETURN; END IF;

  next_progress := round((done_items::numeric / total_items::numeric) * 100)::integer;
  IF blocked_items > 0 THEN
    next_status := 'blocked';
  ELSIF done_items = total_items AND public.period_operational_requirements_complete(target_period_id) THEN
    next_status := 'closed';
  ELSIF review_items > 0 THEN
    next_status := 'in_review';
  ELSIF active_items > 0 OR done_items > 0 THEN
    next_status := 'in_progress';
  ELSE
    next_status := 'waiting_documents';
  END IF;

  UPDATE public.client_periods
  SET progress_percent = next_progress,
      status = CASE WHEN status = 'delivered' AND next_status NOT IN ('blocked', 'closed') THEN status ELSE next_status END,
      blocked_reason = CASE WHEN next_status = 'blocked' THEN 'Ha itens de checklist bloqueados nesta competencia.' ELSE NULL END
  WHERE id = target_period_id;
END;
$$;

-- A competência só pode ser encerrada depois que o ciclo operacional estiver
-- resolvido. A interface já orienta esse fluxo; esta guarda impede atalhos por
-- chamadas diretas, scripts ou clientes antigos.
CREATE OR REPLACE FUNCTION public.guard_period_close_requirements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'closed' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NOT public.period_operational_requirements_complete(NEW.id) THEN
      IF EXISTS (SELECT 1 FROM public.client_period_steps WHERE client_period_id = NEW.id AND status NOT IN ('completed', 'waived')) THEN
        RAISE EXCEPTION 'Cannot close a client period with pending steps' USING ERRCODE = '23514';
      ELSIF EXISTS (SELECT 1 FROM public.client_period_checklist_items WHERE client_period_id = NEW.id AND status NOT IN ('completed', 'waived')) THEN
        RAISE EXCEPTION 'Cannot close a client period with pending checklist items' USING ERRCODE = '23514';
      ELSIF EXISTS (SELECT 1 FROM public.document_requests WHERE client_period_id = NEW.id AND status NOT IN ('approved', 'waived')) THEN
        RAISE EXCEPTION 'Cannot close a client period with pending document requests' USING ERRCODE = '23514';
      ELSE
        RAISE EXCEPTION 'Cannot close a client period with pending fiscal obligations' USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_period_close_requirements ON public.client_periods;
CREATE TRIGGER guard_period_close_requirements
BEFORE UPDATE OF status ON public.client_periods
FOR EACH ROW EXECUTE FUNCTION public.guard_period_close_requirements();

REVOKE ALL ON FUNCTION public.guard_period_close_requirements() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.period_operational_requirements_complete(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_client_period_from_steps(uuid), public.refresh_client_period_from_checklist(uuid) FROM PUBLIC, anon, authenticated;

COMMIT;
