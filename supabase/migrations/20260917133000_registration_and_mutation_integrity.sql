BEGIN;

-- The legacy audit triggers call log_activity(), which dereferences NEW and OLD
-- unconditionally and therefore fails for companies. Keep the enriched audit
-- trigger as the single writer of activity logs.
DROP TRIGGER IF EXISTS audit_companies ON public.companies;
DROP TRIGGER IF EXISTS audit_documents ON public.documents;
DROP TRIGGER IF EXISTS audit_tasks ON public.tasks;
DROP TRIGGER IF EXISTS audit_invoices ON public.invoices;
DROP TRIGGER IF EXISTS audit_payments ON public.payments;

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
    WHEN TG_TABLE_NAME = 'companies' AND TG_OP = 'DELETE' THEN NULL
    WHEN TG_TABLE_NAME = 'companies' THEN entity_id
    ELSE NULLIF(row_data->>'company_id', '')::uuid
  END;
  readable_name := COALESCE(row_data->>'name', row_data->>'title', row_data->>'number', row_data->>'description', entity_id::text);
  action_name := CASE WHEN TG_OP = 'INSERT' THEN 'created' WHEN TG_OP = 'UPDATE' THEN 'updated' ELSE 'deleted' END;

  IF TG_OP = 'UPDATE' THEN
    SELECT array_agg(key ORDER BY key) INTO changed_fields
    FROM jsonb_object_keys(new_data) AS key
    WHERE old_data->key IS DISTINCT FROM new_data->key AND key NOT IN ('updated_at');
  ELSE
    changed_fields := ARRAY[]::text[];
  END IF;

  INSERT INTO public.activity_logs (tenant_id, company_id, user_id, entity, entity_id, action, metadata)
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
      'deleted_company_id', CASE WHEN TG_TABLE_NAME = 'companies' AND TG_OP = 'DELETE' THEN entity_id::text END,
      'old_company_id', old_data->>'company_id',
      'new_company_id', new_data->>'company_id',
      'old_status', old_data->>'status',
      'new_status', new_data->>'status',
      'old_amount', old_data->>'amount',
      'new_amount', new_data->>'amount',
      'old_due_date', COALESCE(old_data->>'due_date', old_data->>'doc_date'),
      'new_due_date', COALESCE(new_data->>'due_date', new_data->>'doc_date')
    )
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

-- CNPJ is stored only as digits and is unique inside a workspace. Empty CNPJ is
-- still allowed for leads being registered before fiscal data is available.
CREATE OR REPLACE FUNCTION public.normalize_company_cnpj()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE normalized_cnpj text;
BEGIN
  normalized_cnpj := NULLIF(regexp_replace(COALESCE(NEW.cnpj, ''), '[^0-9]', '', 'g'), '');
  IF normalized_cnpj IS NOT NULL AND length(normalized_cnpj) <> 14 THEN
    RAISE EXCEPTION 'CNPJ must contain 14 digits' USING ERRCODE = '22023';
  END IF;
  NEW.cnpj := normalized_cnpj;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_company_cnpj ON public.companies;
CREATE TRIGGER normalize_company_cnpj
BEFORE INSERT OR UPDATE OF cnpj ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.normalize_company_cnpj();

CREATE UNIQUE INDEX IF NOT EXISTS companies_tenant_normalized_cnpj_unique
ON public.companies (tenant_id, regexp_replace(cnpj, '[^0-9]', '', 'g'))
WHERE NULLIF(regexp_replace(COALESCE(cnpj, ''), '[^0-9]', '', 'g'), '') IS NOT NULL;

-- A client is archived so its fiscal, financial and document history remains
-- connected. Controlled service-role maintenance can still delete records.
CREATE OR REPLACE FUNCTION public.prevent_authenticated_company_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'authenticated' THEN
    RAISE EXCEPTION 'Clients must be archived instead of deleted' USING ERRCODE = '42501';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS prevent_authenticated_company_delete ON public.companies;
CREATE TRIGGER prevent_authenticated_company_delete
BEFORE DELETE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.prevent_authenticated_company_delete();

-- A stored file encodes its workspace and company. Reclassification must create
-- a deliberate storage move, not silently point the same object at another client.
CREATE OR REPLACE FUNCTION public.guard_document_path()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE expected_company_segment text;
BEGIN
  IF TG_OP = 'UPDATE'
    AND NEW.company_id IS DISTINCT FROM OLD.company_id
    AND (OLD.file_path IS NOT NULL OR NEW.file_path IS NOT NULL) THEN
    RAISE EXCEPTION 'Move the stored file before changing its client' USING ERRCODE = '23514';
  END IF;

  IF NEW.file_path IS NOT NULL THEN
    IF split_part(NEW.file_path, '/', 1) <> NEW.tenant_id::text THEN
      RAISE EXCEPTION 'Document path belongs to another workspace' USING ERRCODE = '42501';
    END IF;
    IF split_part(NEW.file_path, '/', 3) <> '' THEN
      expected_company_segment := COALESCE(NEW.company_id::text, 'unassigned');
      IF split_part(NEW.file_path, '/', 2) <> expected_company_segment THEN
        RAISE EXCEPTION 'Document path belongs to another client' USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;

  IF auth.role() = 'authenticated' AND public.current_user_account_type() = 'client' AND (
    NEW.file_path IS NULL OR NOT public.can_upload_document_object(NEW.file_path)
    OR NEW.uploaded_by IS DISTINCT FROM auth.uid()
  ) THEN
    RAISE EXCEPTION 'Clients may only register their own company uploads' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_document_path ON public.documents;
CREATE TRIGGER guard_document_path
BEFORE INSERT OR UPDATE OF file_path, company_id, tenant_id ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.guard_document_path();

-- Client task access is tied to assigned_to in the current product. A client can
-- only receive tasks for their own company; staff must be active in the workspace.
CREATE OR REPLACE FUNCTION public.guard_task_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE assignee public.profiles%ROWTYPE;
BEGIN
  IF NEW.assigned_to IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO assignee FROM public.profiles WHERE user_id = NEW.assigned_to;
  IF assignee.user_id IS NULL OR assignee.tenant_id IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION 'Task assignee does not belong to this workspace' USING ERRCODE = '23514';
  END IF;
  IF assignee.status <> 'active' THEN
    RAISE EXCEPTION 'Task assignee must be active' USING ERRCODE = '23514';
  END IF;
  IF assignee.account_type = 'client' AND assignee.company_id IS DISTINCT FROM NEW.company_id THEN
    RAISE EXCEPTION 'A client can only receive tasks from their own company' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_task_assignment ON public.tasks;
CREATE TRIGGER guard_task_assignment
BEFORE INSERT OR UPDATE OF assigned_to, company_id, tenant_id ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.guard_task_assignment();

CREATE OR REPLACE FUNCTION public.guard_invoice_company_reassignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.company_id IS DISTINCT FROM OLD.company_id
    AND EXISTS (SELECT 1 FROM public.payments p WHERE p.invoice_id = OLD.id AND p.company_id IS DISTINCT FROM NEW.company_id) THEN
    RAISE EXCEPTION 'Move linked payments before changing an invoice client' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_invoice_company_reassignment ON public.invoices;
CREATE TRIGGER guard_invoice_company_reassignment
BEFORE UPDATE OF company_id ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.guard_invoice_company_reassignment();

CREATE OR REPLACE FUNCTION public.guard_conversation_company_reassignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.company_id IS DISTINCT FROM OLD.company_id
    AND EXISTS (SELECT 1 FROM public.messages m WHERE m.conversation_id = OLD.id AND m.company_id IS DISTINCT FROM NEW.company_id) THEN
    RAISE EXCEPTION 'Move linked messages before changing a conversation client' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_conversation_company_reassignment ON public.conversations;
CREATE TRIGGER guard_conversation_company_reassignment
BEFORE UPDATE OF company_id ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.guard_conversation_company_reassignment();

CREATE OR REPLACE FUNCTION public.guard_invite_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.account_type = 'client' AND NEW.company_id IS NULL THEN
    RAISE EXCEPTION 'Client invitations require a company' USING ERRCODE = '23514';
  END IF;
  IF NEW.account_type = 'collaborator' AND NEW.company_id IS NOT NULL THEN
    RAISE EXCEPTION 'Collaborator invitations cannot be restricted to a company' USING ERRCODE = '23514';
  END IF;
  IF NEW.company_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.companies WHERE id = NEW.company_id AND tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'Invite company belongs to another workspace' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_invite_scope ON public.invites;
CREATE TRIGGER guard_invite_scope
BEFORE INSERT OR UPDATE OF tenant_id, company_id, account_type ON public.invites
FOR EACH ROW EXECUTE FUNCTION public.guard_invite_scope();

CREATE UNIQUE INDEX IF NOT EXISTS invites_pending_email_per_tenant_unique
ON public.invites (tenant_id, lower(email))
WHERE status = 'pending';

-- Invitations define access to a workspace and must be managed by its admin,
-- not merely any collaborator that can operate day-to-day records.
DROP POLICY IF EXISTS invites_select ON public.invites;
DROP POLICY IF EXISTS invites_insert ON public.invites;
DROP POLICY IF EXISTS invites_update ON public.invites;
DROP POLICY IF EXISTS invites_delete ON public.invites;
CREATE POLICY invites_select ON public.invites AS RESTRICTIVE FOR SELECT TO authenticated
USING (tenant_id = public.current_user_tenant_id() AND public.current_user_account_type() = 'admin');
CREATE POLICY invites_insert ON public.invites AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (tenant_id = public.current_user_tenant_id() AND public.current_user_account_type() = 'admin');
CREATE POLICY invites_update ON public.invites AS RESTRICTIVE FOR UPDATE TO authenticated
USING (tenant_id = public.current_user_tenant_id() AND public.current_user_account_type() = 'admin')
WITH CHECK (tenant_id = public.current_user_tenant_id() AND public.current_user_account_type() = 'admin');
CREATE POLICY invites_delete ON public.invites AS RESTRICTIVE FOR DELETE TO authenticated
USING (tenant_id = public.current_user_tenant_id() AND public.current_user_account_type() = 'admin');

-- Profiles are the canonical access record. Keep legacy user_roles synchronized
-- so old policies cannot grant a role that the profile no longer has.
CREATE OR REPLACE FUNCTION public.sync_profile_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.account_type NOT IN ('admin', 'collaborator', 'client') THEN
    RAISE EXCEPTION 'Invalid profile account type' USING ERRCODE = '23514';
  END IF;
  DELETE FROM public.user_roles WHERE user_id = NEW.user_id;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.user_id, NEW.account_type::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_profile_user_role ON public.profiles;
CREATE TRIGGER sync_profile_user_role
AFTER INSERT OR UPDATE OF account_type ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_user_role();

DELETE FROM public.user_roles ur
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = ur.user_id)
   OR EXISTS (
     SELECT 1 FROM public.profiles p
     WHERE p.user_id = ur.user_id
       AND p.account_type IN ('admin', 'collaborator', 'client')
       AND ur.role IS DISTINCT FROM p.account_type::public.app_role
   );

INSERT INTO public.user_roles (user_id, role)
SELECT p.user_id, p.account_type::public.app_role
FROM public.profiles p
WHERE p.account_type IN ('admin', 'collaborator', 'client')
ON CONFLICT (user_id, role) DO NOTHING;

-- Public sign-up creates an office administrator only. Collaborators and clients
-- must enter through a valid, pending invitation matching their email.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_tenant_id uuid;
  display_name text;
  workspace_name text;
  assigned_role public.app_role;
  invite_record public.invites%ROWTYPE;
  invite_token text;
BEGIN
  display_name := COALESCE(NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'full_name', '')), ''), split_part(NEW.email, '@', 1));
  invite_token := NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'invite_token', '')), '');

  IF invite_token IS NOT NULL THEN
    SELECT * INTO invite_record
    FROM public.invites
    WHERE token = invite_token
      AND lower(email) = lower(NEW.email)
      AND status = 'pending'
      AND expires_at > now()
    FOR UPDATE;

    IF invite_record.id IS NULL THEN
      RAISE EXCEPTION 'Invitation is invalid, expired, revoked, or for another email' USING ERRCODE = '42501';
    END IF;
    IF invite_record.account_type = 'client' AND invite_record.company_id IS NULL THEN
      RAISE EXCEPTION 'Client invitation is missing a company' USING ERRCODE = '23514';
    END IF;

    new_tenant_id := invite_record.tenant_id;
    assigned_role := invite_record.account_type::public.app_role;
    display_name := COALESCE(NULLIF(trim(invite_record.full_name), ''), display_name);
    UPDATE public.invites SET status = 'accepted', accepted_by = NEW.id, accepted_at = now() WHERE id = invite_record.id;
  ELSE
    workspace_name := COALESCE(NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'workspace_name', '')), ''), display_name || ' workspace');
    assigned_role := 'admin'::public.app_role;
    INSERT INTO public.tenants (name, owner_user_id) VALUES (workspace_name, NEW.id) RETURNING id INTO new_tenant_id;
  END IF;

  INSERT INTO public.users (id, tenant_id, name, role)
  VALUES (NEW.id, new_tenant_id, display_name, assigned_role::text)
  ON CONFLICT (id) DO UPDATE
  SET tenant_id = COALESCE(public.users.tenant_id, EXCLUDED.tenant_id),
      name = COALESCE(NULLIF(public.users.name, ''), EXCLUDED.name),
      role = EXCLUDED.role;

  INSERT INTO public.profiles (user_id, tenant_id, company_id, full_name, account_type, status)
  VALUES (NEW.id, new_tenant_id, invite_record.company_id, display_name, assigned_role::text, 'active')
  ON CONFLICT (user_id) DO UPDATE
  SET tenant_id = COALESCE(public.profiles.tenant_id, EXCLUDED.tenant_id),
      company_id = COALESCE(public.profiles.company_id, EXCLUDED.company_id),
      full_name = COALESCE(NULLIF(public.profiles.full_name, ''), EXCLUDED.full_name),
      account_type = EXCLUDED.account_type,
      status = 'active';

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.normalize_company_cnpj(), public.prevent_authenticated_company_delete(), public.guard_document_path(), public.guard_task_assignment(), public.guard_invoice_company_reassignment(), public.guard_conversation_company_reassignment(), public.guard_invite_scope(), public.sync_profile_user_role() FROM PUBLIC, anon, authenticated;

COMMIT;
