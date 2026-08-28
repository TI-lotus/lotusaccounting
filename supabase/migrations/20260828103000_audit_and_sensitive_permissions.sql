CREATE OR REPLACE FUNCTION public.log_entity_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row_data jsonb;
  entity_id uuid;
  tenant_id_value uuid;
  company_id_value uuid;
  readable_name text;
  action_name text;
BEGIN
  row_data := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  entity_id := NULLIF(row_data->>'id', '')::uuid;
  tenant_id_value := NULLIF(row_data->>'tenant_id', '')::uuid;
  company_id_value := CASE
    WHEN TG_TABLE_NAME = 'companies' THEN entity_id
    ELSE NULLIF(row_data->>'company_id', '')::uuid
  END;
  readable_name := COALESCE(
    row_data->>'name',
    row_data->>'title',
    row_data->>'number',
    row_data->>'description',
    entity_id::text
  );
  action_name := CASE
    WHEN TG_OP = 'INSERT' THEN 'created'
    WHEN TG_OP = 'UPDATE' THEN 'updated'
    ELSE 'deleted'
  END;

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
    tenant_id_value,
    company_id_value,
    auth.uid(),
    CASE TG_TABLE_NAME
      WHEN 'companies' THEN 'company'
      WHEN 'documents' THEN 'document'
      WHEN 'tasks' THEN 'task'
      WHEN 'invoices' THEN 'invoice'
      WHEN 'payments' THEN 'payment'
      ELSE TG_TABLE_NAME
    END,
    entity_id,
    action_name,
    jsonb_build_object(
      'label', readable_name,
      'status', row_data->>'status',
      'amount', row_data->>'amount',
      'due_date', COALESCE(row_data->>'due_date', row_data->>'doc_date'),
      'table', TG_TABLE_NAME
    )
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_companies ON public.companies;
CREATE TRIGGER trg_audit_companies
AFTER INSERT OR UPDATE OR DELETE ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.log_entity_activity();

DROP TRIGGER IF EXISTS trg_audit_documents ON public.documents;
CREATE TRIGGER trg_audit_documents
AFTER INSERT OR UPDATE OR DELETE ON public.documents
FOR EACH ROW
EXECUTE FUNCTION public.log_entity_activity();

DROP TRIGGER IF EXISTS trg_audit_tasks ON public.tasks;
CREATE TRIGGER trg_audit_tasks
AFTER INSERT OR UPDATE OR DELETE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.log_entity_activity();

DROP TRIGGER IF EXISTS trg_audit_invoices ON public.invoices;
CREATE TRIGGER trg_audit_invoices
AFTER INSERT OR UPDATE OR DELETE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.log_entity_activity();

DROP TRIGGER IF EXISTS trg_audit_payments ON public.payments;
CREATE TRIGGER trg_audit_payments
AFTER INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.log_entity_activity();

DROP POLICY IF EXISTS client_write_companies_guard ON public.companies;
CREATE POLICY client_write_companies_guard ON public.companies
AS RESTRICTIVE
FOR ALL TO authenticated
USING (
  public.current_user_account_type() <> 'client'
  OR id = public.current_user_company_id()
)
WITH CHECK (
  public.current_user_account_type() <> 'client'
);

DROP POLICY IF EXISTS client_write_invoices_guard ON public.invoices;
CREATE POLICY client_write_invoices_guard ON public.invoices
AS RESTRICTIVE
FOR ALL TO authenticated
USING (
  public.current_user_account_type() <> 'client'
  OR company_id = public.current_user_company_id()
)
WITH CHECK (
  public.current_user_account_type() <> 'client'
);

DROP POLICY IF EXISTS client_write_payments_guard ON public.payments;
CREATE POLICY client_write_payments_guard ON public.payments
AS RESTRICTIVE
FOR ALL TO authenticated
USING (
  public.current_user_account_type() <> 'client'
  OR company_id = public.current_user_company_id()
)
WITH CHECK (
  public.current_user_account_type() <> 'client'
);

DROP POLICY IF EXISTS client_write_tasks_guard ON public.tasks;
CREATE POLICY client_write_tasks_guard ON public.tasks
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

DROP POLICY IF EXISTS client_write_documents_guard ON public.documents;
CREATE POLICY client_write_documents_guard ON public.documents
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
