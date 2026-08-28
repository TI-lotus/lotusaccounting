CREATE INDEX IF NOT EXISTS idx_activity_logs_entity_created_at
  ON public.activity_logs(entity, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_logs_company_created_at
  ON public.activity_logs(company_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.log_entity_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row_data jsonb;
  old_data jsonb;
  new_data jsonb;
  entity_id uuid;
  tenant_id_value uuid;
  company_id_value uuid;
  readable_name text;
  action_name text;
  changed_fields text[];
BEGIN
  old_data := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
  new_data := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE '{}'::jsonb END;
  row_data := CASE WHEN TG_OP = 'DELETE' THEN old_data ELSE new_data END;
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

  IF TG_OP = 'UPDATE' THEN
    SELECT array_agg(key ORDER BY key)
    INTO changed_fields
    FROM jsonb_object_keys(new_data) AS key
    WHERE old_data->key IS DISTINCT FROM new_data->key
      AND key NOT IN ('updated_at');
  ELSE
    changed_fields := ARRAY[]::text[];
  END IF;

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
      'table', TG_TABLE_NAME,
      'changed_fields', changed_fields,
      'old_status', old_data->>'status',
      'new_status', new_data->>'status',
      'old_amount', old_data->>'amount',
      'new_amount', new_data->>'amount',
      'old_due_date', COALESCE(old_data->>'due_date', old_data->>'doc_date'),
      'new_due_date', COALESCE(new_data->>'due_date', new_data->>'doc_date')
    )
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_fiscal_obligation_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_data jsonb;
  new_data jsonb;
  row_data jsonb;
  action_name text;
  changed_fields text[];
BEGIN
  old_data := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
  new_data := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE '{}'::jsonb END;
  row_data := CASE WHEN TG_OP = 'DELETE' THEN old_data ELSE new_data END;

  IF TG_OP = 'INSERT' THEN
    action_name := 'created';
  ELSIF TG_OP = 'UPDATE' THEN
    action_name := 'updated';
  ELSE
    action_name := 'deleted';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    SELECT array_agg(key ORDER BY key)
    INTO changed_fields
    FROM jsonb_object_keys(new_data) AS key
    WHERE old_data->key IS DISTINCT FROM new_data->key
      AND key NOT IN ('updated_at');
  ELSE
    changed_fields := ARRAY[]::text[];
  END IF;

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
    NULLIF(row_data->>'tenant_id', '')::uuid,
    NULLIF(row_data->>'company_id', '')::uuid,
    auth.uid(),
    'fiscal_obligation',
    NULLIF(row_data->>'id', '')::uuid,
    action_name,
    jsonb_build_object(
      'label', row_data->>'name',
      'table', 'fiscal_obligations',
      'changed_fields', changed_fields,
      'old_status', old_data->>'status',
      'new_status', new_data->>'status',
      'old_due_date', old_data->>'due_date',
      'new_due_date', new_data->>'due_date'
    )
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;
