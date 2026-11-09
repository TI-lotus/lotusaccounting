BEGIN;

ALTER TABLE public.domain_events
  ADD COLUMN IF NOT EXISTS origin_key text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_domain_events_origin_key
  ON public.domain_events(tenant_id, origin_key)
  WHERE origin_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.emit_domain_event(
  workspace_id uuid,
  event_name text,
  event_entity_type text,
  event_entity_id uuid,
  event_payload jsonb,
  event_origin_key text
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE result_id uuid;
BEGIN
  INSERT INTO public.domain_events(tenant_id, event_type, entity_type, entity_id, payload, origin_key)
  VALUES (workspace_id, event_name, event_entity_type, event_entity_id, COALESCE(event_payload, '{}'::jsonb), event_origin_key)
  ON CONFLICT (tenant_id, origin_key) WHERE origin_key IS NOT NULL DO NOTHING
  RETURNING id INTO result_id;

  IF result_id IS NULL AND event_origin_key IS NOT NULL THEN
    SELECT id INTO result_id FROM public.domain_events
    WHERE tenant_id = workspace_id AND origin_key = event_origin_key;
  END IF;
  RETURN result_id;
END $$;

CREATE OR REPLACE FUNCTION public.emit_document_received_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.emit_domain_event(
    NEW.tenant_id, 'document.received', 'document', NEW.id,
    jsonb_build_object('company_id', NEW.company_id, 'document_type', NEW.document_type, 'status', NEW.status),
    'document.received:' || NEW.id::text
  );
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.emit_invoice_created_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.emit_domain_event(
    NEW.tenant_id, 'invoice.created', 'invoice', NEW.id,
    jsonb_build_object('company_id', NEW.company_id, 'amount', NEW.amount, 'due_date', NEW.due_date, 'status', NEW.status),
    'invoice.created:' || NEW.id::text
  );
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.emit_payment_completed_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'completed') THEN
    PERFORM public.emit_domain_event(
      NEW.tenant_id, 'payment.completed', 'payment', NEW.id,
      jsonb_build_object('company_id', NEW.company_id, 'invoice_id', NEW.invoice_id, 'amount', NEW.amount, 'method', NEW.method, 'direction', NEW.direction),
      'payment.completed:' || NEW.id::text
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_emit_document_received_event ON public.documents;
CREATE TRIGGER trg_emit_document_received_event
AFTER INSERT ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.emit_document_received_event();

DROP TRIGGER IF EXISTS trg_emit_invoice_created_event ON public.invoices;
CREATE TRIGGER trg_emit_invoice_created_event
AFTER INSERT ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.emit_invoice_created_event();

DROP TRIGGER IF EXISTS trg_emit_payment_completed_event ON public.payments;
CREATE TRIGGER trg_emit_payment_completed_event
AFTER INSERT OR UPDATE OF status ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.emit_payment_completed_event();

REVOKE ALL ON FUNCTION public.emit_domain_event(uuid, text, text, uuid, jsonb, text), public.emit_document_received_event(), public.emit_invoice_created_event(), public.emit_payment_completed_event() FROM PUBLIC, anon, authenticated;

COMMIT;
