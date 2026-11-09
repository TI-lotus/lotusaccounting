BEGIN;

CREATE OR REPLACE FUNCTION public.current_user_tenant_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid() AND status = 'active' LIMIT 1 $$;

CREATE OR REPLACE FUNCTION public.current_user_account_type()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT account_type FROM public.profiles WHERE user_id = auth.uid() AND status = 'active' LIMIT 1 $$;

CREATE OR REPLACE FUNCTION public.current_user_company_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT company_id FROM public.profiles WHERE user_id = auth.uid() AND status = 'active' LIMIT 1 $$;

CREATE OR REPLACE FUNCTION public.can_manage_current_tenant()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT COALESCE(public.current_user_account_type() IN ('admin', 'collaborator'), false) $$;

-- Restrictive policies also constrain older permissive admin policies.
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'users', 'companies', 'documents', 'tasks', 'invoices', 'payments',
    'contracts', 'conversations', 'messages', 'events', 'activity_logs',
    'invites', 'fiscal_obligations', 'workspace_settings',
    'integration_connections', 'integration_credentials', 'integration_events',
    'integration_webhook_events', 'integration_sync_runs', 'integration_errors',
    'integration_jobs', 'domain_events', 'automation_rules', 'automation_runs'
  ] LOOP
    EXECUTE format('CREATE POLICY active_workspace_guard ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (tenant_id = public.current_user_tenant_id()) WITH CHECK (tenant_id = public.current_user_tenant_id())', table_name);
  END LOOP;
  FOREACH table_name IN ARRAY ARRAY['conversations', 'messages'] LOOP
    EXECUTE format('CREATE POLICY client_company_guard ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.can_manage_current_tenant() OR company_id = public.current_user_company_id()) WITH CHECK (public.can_manage_current_tenant() OR company_id = public.current_user_company_id())', table_name);
  END LOOP;
END $$;

CREATE POLICY active_tenant_guard ON public.tenants AS RESTRICTIVE
FOR ALL TO authenticated
USING (id = public.current_user_tenant_id())
WITH CHECK (id = public.current_user_tenant_id());

CREATE POLICY profile_workspace_guard ON public.profiles AS RESTRICTIVE
FOR ALL TO authenticated
USING (user_id = auth.uid() OR (tenant_id = public.current_user_tenant_id() AND public.can_manage_current_tenant()))
WITH CHECK (tenant_id = public.current_user_tenant_id() AND (user_id = auth.uid() OR public.current_user_account_type() = 'admin'));

CREATE OR REPLACE FUNCTION public.profile_belongs_to_current_workspace(target_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = target_user_id AND tenant_id = public.current_user_tenant_id()) $$;

CREATE POLICY role_workspace_guard ON public.user_roles AS RESTRICTIVE
FOR ALL TO authenticated
USING (public.profile_belongs_to_current_workspace(user_id) AND (user_id = auth.uid() OR public.current_user_account_type() = 'admin'))
WITH CHECK (public.profile_belongs_to_current_workspace(user_id) AND public.current_user_account_type() = 'admin');

CREATE OR REPLACE FUNCTION public.guard_profile_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'authenticated' THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
      RAISE EXCEPTION 'Profile identity cannot be changed' USING ERRCODE = '42501';
    END IF;
    IF (NEW.account_type, NEW.company_id, NEW.status) IS DISTINCT FROM (OLD.account_type, OLD.company_id, OLD.status)
      AND NOT (public.current_user_account_type() = 'admin' AND OLD.tenant_id = public.current_user_tenant_id()) THEN
      RAISE EXCEPTION 'Only an active workspace admin can change access' USING ERRCODE = '42501';
    END IF;
  END IF;
  IF NEW.company_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.companies WHERE id = NEW.company_id AND tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'Company belongs to another workspace' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER guard_profile_identity BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_identity();

CREATE POLICY client_task_assignment_guard ON public.tasks AS RESTRICTIVE
FOR ALL TO authenticated
USING (public.can_manage_current_tenant() OR assigned_to = auth.uid())
WITH CHECK (public.can_manage_current_tenant() OR assigned_to = auth.uid());

CREATE OR REPLACE FUNCTION public.guard_client_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'authenticated' AND public.current_user_account_type() = 'client' THEN
    IF TG_TABLE_NAME = 'tasks' THEN
      IF (to_jsonb(NEW) - ARRAY['status', 'completed_at']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status', 'completed_at'])
        OR NEW.status NOT IN ('pending', 'in_progress', 'completed') THEN
        RAISE EXCEPTION 'Clients may only update assigned task status' USING ERRCODE = '42501';
      END IF;
    ELSIF (to_jsonb(NEW) - ARRAY['status', 'read_at']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status', 'read_at'])
      OR NEW.status NOT IN ('read', 'unread') THEN
      RAISE EXCEPTION 'Clients may only mark documents as read' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_client_changes BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.guard_client_changes();
CREATE TRIGGER guard_client_changes BEFORE UPDATE ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.guard_client_changes();

-- Reject cross-workspace foreign keys even when the caller knows an external ID.
CREATE OR REPLACE FUNCTION public.guard_workspace_references()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE row_data jsonb := to_jsonb(NEW); field_name text; ref_table text; ref_id uuid; ref_tenant uuid; ref_company uuid;
BEGIN
  FOR field_name, ref_table IN SELECT * FROM (VALUES
    ('company_id', 'companies'), ('connection_id', 'integration_connections'),
    ('invoice_id', 'invoices'), ('document_id', 'documents'), ('payment_id', 'payments'),
    ('task_id', 'tasks'), ('conversation_id', 'conversations'),
    ('assigned_to', 'users'), ('uploaded_by', 'users'), ('sender_id', 'users'),
    ('responsible_user_id', 'users'), ('rule_id', 'automation_rules'), ('domain_event_id', 'domain_events')
  ) AS refs(field_name, ref_table) LOOP
    ref_id := NULLIF(row_data ->> field_name, '')::uuid;
    IF ref_id IS NOT NULL THEN
      EXECUTE format('SELECT tenant_id FROM public.%I WHERE id = $1', ref_table) INTO ref_tenant USING ref_id;
      IF ref_tenant IS DISTINCT FROM NEW.tenant_id THEN
        RAISE EXCEPTION 'Invalid workspace reference: %', field_name USING ERRCODE = '23514';
      END IF;
      IF ref_table IN ('invoices', 'documents', 'payments', 'tasks', 'conversations') AND row_data ? 'company_id' THEN
        EXECUTE format('SELECT company_id FROM public.%I WHERE id = $1', ref_table) INTO ref_company USING ref_id;
        IF ref_company IS DISTINCT FROM NULLIF(row_data ->> 'company_id', '')::uuid THEN
          RAISE EXCEPTION 'Invalid company reference: %', field_name USING ERRCODE = '23514';
        END IF;
      END IF;
    END IF;
  END LOOP;
  RETURN NEW;
END $$;

DO $$ DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['companies', 'documents', 'tasks', 'invoices', 'payments', 'contracts', 'conversations', 'messages', 'invites', 'fiscal_obligations', 'integration_credentials', 'integration_events', 'integration_jobs', 'integration_sync_runs', 'integration_errors', 'automation_runs'] LOOP
    EXECUTE format('CREATE TRIGGER guard_workspace_references BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.guard_workspace_references()', table_name);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.can_upload_document_object(object_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT split_part(object_name, '/', 1) = public.current_user_tenant_id()::text
    AND split_part(object_name, '/', 3) = auth.uid()::text
    AND (public.can_manage_current_tenant() OR split_part(object_name, '/', 2) = public.current_user_company_id()::text)
$$;

CREATE OR REPLACE FUNCTION public.can_read_document_object(object_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.documents d
    WHERE d.file_path = object_name AND d.tenant_id = public.current_user_tenant_id()
      AND (public.can_manage_current_tenant() OR d.company_id = public.current_user_company_id()))
    OR (public.can_upload_document_object(object_name) AND NOT EXISTS (SELECT 1 FROM public.documents WHERE file_path = object_name))
$$;

CREATE OR REPLACE FUNCTION public.can_delete_document_object(object_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT (public.can_manage_current_tenant() AND split_part(object_name, '/', 1) = public.current_user_tenant_id()::text)
    OR (public.can_upload_document_object(object_name) AND NOT EXISTS (SELECT 1 FROM public.documents WHERE file_path = object_name))
$$;

DO $$ DECLARE policy_name text;
BEGIN
  FOREACH policy_name IN ARRAY ARRAY['documents_storage_select', 'documents_storage_insert', 'documents_storage_update', 'documents_storage_delete', 'Users can view document files', 'Users can upload document files', 'Users can update document files', 'Users can delete document files', 'tenant storage access'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', policy_name);
  END LOOP;
END $$;

CREATE POLICY documents_read ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'documents' AND public.can_read_document_object(name));
CREATE POLICY documents_upload ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documents' AND public.can_upload_document_object(name));
CREATE POLICY documents_delete ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'documents' AND public.can_delete_document_object(name));

CREATE POLICY document_read_guard ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated
USING (bucket_id <> 'documents' OR public.can_read_document_object(name));
CREATE POLICY document_upload_guard ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (bucket_id <> 'documents' OR public.can_upload_document_object(name));
CREATE POLICY document_update_guard ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
USING (bucket_id <> 'documents') WITH CHECK (bucket_id <> 'documents');
CREATE POLICY document_delete_guard ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated
USING (bucket_id <> 'documents' OR public.can_delete_document_object(name));

UPDATE storage.buckets SET public = false, file_size_limit = 26214400 WHERE id = 'documents';

CREATE OR REPLACE FUNCTION public.claim_workspace_integration_job(worker_id text, workspace_id uuid)
RETURNS SETOF public.integration_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF workspace_id IS NULL THEN RAISE EXCEPTION 'Workspace required'; END IF;
  UPDATE public.integration_jobs SET status = 'dead_letter', locked_at = NULL, locked_by = NULL,
    last_error = 'Worker lease expired after maximum attempts', updated_at = now()
  WHERE tenant_id = workspace_id AND status = 'processing' AND locked_at < now() - interval '10 minutes' AND attempt_count >= max_attempts;

  RETURN QUERY UPDATE public.integration_jobs j SET status = 'processing', locked_at = now(), locked_by = worker_id,
    attempt_count = j.attempt_count + 1, updated_at = now()
  WHERE j.id = (SELECT candidate.id FROM public.integration_jobs candidate
    WHERE candidate.tenant_id = workspace_id AND candidate.attempt_count < candidate.max_attempts
      AND ((candidate.status IN ('pending', 'failed') AND candidate.scheduled_for <= now())
        OR (candidate.status = 'processing' AND candidate.locked_at < now() - interval '10 minutes'))
    ORDER BY candidate.priority, candidate.scheduled_for, candidate.created_at FOR UPDATE SKIP LOCKED LIMIT 1)
  RETURNING j.*;
END $$;

REVOKE ALL ON FUNCTION public.claim_next_integration_job(text), public.claim_workspace_integration_job(text, uuid), public.complete_integration_job(uuid), public.fail_integration_job(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_next_integration_job(text), public.claim_workspace_integration_job(text, uuid), public.complete_integration_job(uuid), public.fail_integration_job(uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.current_user_tenant_id(), public.current_user_account_type(), public.current_user_company_id(), public.can_manage_current_tenant(), public.profile_belongs_to_current_workspace(uuid), public.can_upload_document_object(text), public.can_read_document_object(text), public.can_delete_document_object(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_tenant_id(), public.current_user_account_type(), public.current_user_company_id(), public.can_manage_current_tenant(), public.profile_belongs_to_current_workspace(uuid), public.can_upload_document_object(text), public.can_read_document_object(text), public.can_delete_document_object(text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.guard_profile_identity(), public.guard_workspace_references(), public.guard_client_changes() FROM PUBLIC, anon, authenticated;

COMMIT;
