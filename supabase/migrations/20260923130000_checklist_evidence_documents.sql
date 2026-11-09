BEGIN;

ALTER TABLE public.client_period_checklist_items
  ADD COLUMN IF NOT EXISTS document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_client_period_checklist_items_document
ON public.client_period_checklist_items(document_id)
WHERE document_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.validate_client_period_checklist_evidence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  doc_tenant uuid;
  doc_company uuid;
BEGIN
  IF NEW.document_id IS NOT NULL THEN
    SELECT tenant_id, company_id INTO doc_tenant, doc_company
    FROM public.documents
    WHERE id = NEW.document_id;

    IF doc_tenant IS DISTINCT FROM NEW.tenant_id OR doc_company IS DISTINCT FROM NEW.company_id THEN
      RAISE EXCEPTION 'Checklist evidence document must belong to the same workspace and company' USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_client_period_checklist_evidence ON public.client_period_checklist_items;
CREATE TRIGGER validate_client_period_checklist_evidence
BEFORE INSERT OR UPDATE OF document_id, tenant_id, company_id ON public.client_period_checklist_items
FOR EACH ROW EXECUTE FUNCTION public.validate_client_period_checklist_evidence();

REVOKE ALL ON FUNCTION public.validate_client_period_checklist_evidence() FROM PUBLIC, anon, authenticated;

COMMIT;
