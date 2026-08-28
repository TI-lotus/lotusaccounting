CREATE OR REPLACE FUNCTION public.current_user_account_type()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT account_type
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_user_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT company_id
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.can_manage_current_tenant()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(public.current_user_account_type() IN ('admin', 'collaborator'), false)
$$;

CREATE TABLE IF NOT EXISTS public.invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  account_type text NOT NULL CHECK (account_type IN ('collaborator', 'client')),
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  token text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked')),
  invited_by uuid,
  accepted_by uuid,
  accepted_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_invites_tenant_id ON public.invites(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invites_email_status ON public.invites(lower(email), status);
CREATE INDEX IF NOT EXISTS idx_invites_token ON public.invites(token);

DROP POLICY IF EXISTS invites_select ON public.invites;
DROP POLICY IF EXISTS invites_insert ON public.invites;
DROP POLICY IF EXISTS invites_update ON public.invites;
DROP POLICY IF EXISTS invites_delete ON public.invites;

CREATE POLICY invites_select ON public.invites
FOR SELECT TO authenticated
USING (tenant_id = public.current_user_tenant_id() AND public.can_manage_current_tenant());

CREATE POLICY invites_insert ON public.invites
FOR INSERT TO authenticated
WITH CHECK (tenant_id = public.current_user_tenant_id() AND public.can_manage_current_tenant());

CREATE POLICY invites_update ON public.invites
FOR UPDATE TO authenticated
USING (tenant_id = public.current_user_tenant_id() AND public.can_manage_current_tenant())
WITH CHECK (tenant_id = public.current_user_tenant_id() AND public.can_manage_current_tenant());

CREATE POLICY invites_delete ON public.invites
FOR DELETE TO authenticated
USING (tenant_id = public.current_user_tenant_id() AND public.can_manage_current_tenant());

ALTER TABLE public.activity_logs
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_activity_logs_company_id ON public.activity_logs(company_id);

CREATE OR REPLACE FUNCTION public.log_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  row_tenant_id uuid;
  row_company_id uuid;
  row_entity_id uuid;
BEGIN
  row_tenant_id := COALESCE(NEW.tenant_id, OLD.tenant_id);
  row_company_id := COALESCE(NEW.company_id, OLD.company_id);
  row_entity_id := COALESCE(NEW.id, OLD.id);

  INSERT INTO public.activity_logs (tenant_id, company_id, user_id, entity, entity_id, action, metadata)
  VALUES (
    row_tenant_id,
    row_company_id,
    auth.uid(),
    TG_ARGV[0],
    row_entity_id,
    lower(TG_OP),
    jsonb_build_object('table', TG_TABLE_NAME)
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS audit_companies ON public.companies;
CREATE TRIGGER audit_companies
AFTER INSERT OR UPDATE OR DELETE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.log_activity('company');

DROP TRIGGER IF EXISTS audit_tasks ON public.tasks;
CREATE TRIGGER audit_tasks
AFTER INSERT OR UPDATE OR DELETE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.log_activity('task');

DROP TRIGGER IF EXISTS audit_documents ON public.documents;
CREATE TRIGGER audit_documents
AFTER INSERT OR UPDATE OR DELETE ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.log_activity('document');

DROP TRIGGER IF EXISTS audit_invoices ON public.invoices;
CREATE TRIGGER audit_invoices
AFTER INSERT OR UPDATE OR DELETE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.log_activity('invoice');

DROP TRIGGER IF EXISTS audit_payments ON public.payments;
CREATE TRIGGER audit_payments
AFTER INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.log_activity('payment');

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_tenant_id uuid;
  display_name text;
  workspace_name text;
  requested_account_type text;
  assigned_role public.app_role;
  invite_record public.invites%ROWTYPE;
  invite_token text;
BEGIN
  display_name := NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'full_name', '')), '');
  display_name := COALESCE(display_name, split_part(NEW.email, '@', 1));

  invite_token := NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'invite_token', '')), '');

  IF invite_token IS NOT NULL THEN
    SELECT *
    INTO invite_record
    FROM public.invites
    WHERE token = invite_token
      AND lower(email) = lower(NEW.email)
      AND status = 'pending'
      AND expires_at > now()
    LIMIT 1;
  END IF;

  IF invite_record.id IS NOT NULL THEN
    new_tenant_id := invite_record.tenant_id;
    assigned_role := invite_record.account_type::public.app_role;
    display_name := COALESCE(NULLIF(trim(invite_record.full_name), ''), display_name);

    UPDATE public.invites
    SET status = 'accepted', accepted_by = NEW.id, accepted_at = now()
    WHERE id = invite_record.id;
  ELSE
    workspace_name := NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'workspace_name', '')), '');
    workspace_name := COALESCE(workspace_name, display_name || ' workspace');

    requested_account_type := NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'account_type', '')), '');
    assigned_role := CASE requested_account_type
      WHEN 'collaborator' THEN 'collaborator'::public.app_role
      WHEN 'client' THEN 'client'::public.app_role
      ELSE 'admin'::public.app_role
    END;

    INSERT INTO public.tenants (name, owner_user_id)
    VALUES (workspace_name, NEW.id)
    RETURNING id INTO new_tenant_id;
  END IF;

  INSERT INTO public.users (id, tenant_id, name, role)
  VALUES (NEW.id, new_tenant_id, display_name, assigned_role::text)
  ON CONFLICT (id) DO UPDATE
  SET
    tenant_id = COALESCE(public.users.tenant_id, EXCLUDED.tenant_id),
    name = COALESCE(NULLIF(public.users.name, ''), EXCLUDED.name),
    role = EXCLUDED.role;

  INSERT INTO public.profiles (user_id, tenant_id, company_id, full_name, account_type, status)
  VALUES (NEW.id, new_tenant_id, invite_record.company_id, display_name, assigned_role::text, 'active')
  ON CONFLICT (user_id) DO UPDATE
  SET
    tenant_id = COALESCE(public.profiles.tenant_id, EXCLUDED.tenant_id),
    company_id = COALESCE(public.profiles.company_id, EXCLUDED.company_id),
    full_name = COALESCE(NULLIF(public.profiles.full_name, ''), EXCLUDED.full_name),
    account_type = EXCLUDED.account_type,
    status = 'active';

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, assigned_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$function$;

DROP POLICY IF EXISTS client_scope_companies ON public.companies;
CREATE POLICY client_scope_companies ON public.companies
AS RESTRICTIVE
FOR ALL TO authenticated
USING (
  public.current_user_account_type() <> 'client'
  OR id = public.current_user_company_id()
)
WITH CHECK (
  public.current_user_account_type() <> 'client'
  OR id = public.current_user_company_id()
);

DROP POLICY IF EXISTS client_scope_documents ON public.documents;
CREATE POLICY client_scope_documents ON public.documents
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

DROP POLICY IF EXISTS client_scope_tasks ON public.tasks;
CREATE POLICY client_scope_tasks ON public.tasks
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

DROP POLICY IF EXISTS client_scope_invoices ON public.invoices;
CREATE POLICY client_scope_invoices ON public.invoices
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

DROP POLICY IF EXISTS client_scope_payments ON public.payments;
CREATE POLICY client_scope_payments ON public.payments
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

DROP POLICY IF EXISTS client_scope_contracts ON public.contracts;
CREATE POLICY client_scope_contracts ON public.contracts
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

DROP POLICY IF EXISTS client_scope_activity_logs ON public.activity_logs;
CREATE POLICY client_scope_activity_logs ON public.activity_logs
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

GRANT EXECUTE ON FUNCTION public.current_user_account_type() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_company_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_current_tenant() TO authenticated;
