BEGIN;

CREATE TABLE IF NOT EXISTS public.workspace_member_permissions (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permissions jsonb NOT NULL DEFAULT '{
    "clients": {"read": true, "create": true, "update": true, "delete": false},
    "tasks": {"read": true, "create": true, "update": true, "delete": false},
    "documents": {"read": true, "create": true, "update": true, "delete": false},
    "financial": {"read": true, "create": false, "update": false, "delete": false},
    "reports": {"read": true, "create": false, "update": false, "delete": false},
    "integrations": {"read": false, "create": false, "update": false, "delete": false}
  }'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  PRIMARY KEY (tenant_id, user_id)
);

ALTER TABLE public.workspace_member_permissions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_member_permissions TO authenticated;

CREATE OR REPLACE FUNCTION public.touch_workspace_member_permissions()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_workspace_member_permissions ON public.workspace_member_permissions;
CREATE TRIGGER touch_workspace_member_permissions
BEFORE UPDATE ON public.workspace_member_permissions
FOR EACH ROW EXECUTE FUNCTION public.touch_workspace_member_permissions();

CREATE OR REPLACE FUNCTION public.sync_collaborator_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.account_type = 'collaborator' THEN
    INSERT INTO public.workspace_member_permissions (tenant_id, user_id)
    VALUES (NEW.tenant_id, NEW.user_id)
    ON CONFLICT (tenant_id, user_id) DO NOTHING;
  ELSIF TG_OP = 'UPDATE' AND OLD.account_type = 'collaborator' THEN
    DELETE FROM public.workspace_member_permissions
    WHERE tenant_id = OLD.tenant_id AND user_id = OLD.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_collaborator_permissions ON public.profiles;
CREATE TRIGGER sync_collaborator_permissions
AFTER INSERT OR UPDATE OF account_type, tenant_id ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_collaborator_permissions();

INSERT INTO public.workspace_member_permissions (tenant_id, user_id)
SELECT tenant_id, user_id
FROM public.profiles
WHERE account_type = 'collaborator'
ON CONFLICT (tenant_id, user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.has_workspace_permission(resource_key text, action_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p.account_type = 'admin' THEN true
    WHEN p.account_type <> 'collaborator' OR p.status <> 'active' THEN false
    ELSE COALESCE((permission.permissions #>> ARRAY[resource_key, action_key])::boolean, false)
  END
  FROM public.profiles p
  LEFT JOIN public.workspace_member_permissions permission
    ON permission.tenant_id = p.tenant_id AND permission.user_id = p.user_id
  WHERE p.user_id = auth.uid()
  LIMIT 1
$$;

DROP POLICY IF EXISTS workspace_member_permissions_read ON public.workspace_member_permissions;
DROP POLICY IF EXISTS workspace_member_permissions_admin_write ON public.workspace_member_permissions;
CREATE POLICY workspace_member_permissions_read ON public.workspace_member_permissions
FOR SELECT TO authenticated
USING (
  tenant_id = public.current_user_tenant_id()
  AND (user_id = auth.uid() OR public.current_user_account_type() = 'admin')
);
CREATE POLICY workspace_member_permissions_admin_write ON public.workspace_member_permissions
FOR ALL TO authenticated
USING (
  tenant_id = public.current_user_tenant_id()
  AND public.current_user_account_type() = 'admin'
)
WITH CHECK (
  tenant_id = public.current_user_tenant_id()
  AND public.current_user_account_type() = 'admin'
);

-- These guards compose with the tenant/client policies already in place.
-- They only narrow collaborators; administrators and client portal policies
-- retain their dedicated access paths.
DO $$
DECLARE item record;
BEGIN
  FOR item IN SELECT * FROM (VALUES
    ('companies', 'clients'),
    ('tasks', 'tasks'),
    ('documents', 'documents'),
    ('payments', 'financial'),
    ('invoices', 'financial'),
    ('fiscal_obligations', 'financial'),
    ('integration_connections', 'integrations')
  ) AS resources(table_name, resource_key) LOOP
    EXECUTE format('DROP POLICY IF EXISTS collaborator_%1$s_read_permission ON public.%1$I', item.table_name);
    EXECUTE format('DROP POLICY IF EXISTS collaborator_%1$s_insert_permission ON public.%1$I', item.table_name);
    EXECUTE format('DROP POLICY IF EXISTS collaborator_%1$s_update_permission ON public.%1$I', item.table_name);
    EXECUTE format('DROP POLICY IF EXISTS collaborator_%1$s_delete_permission ON public.%1$I', item.table_name);
    EXECUTE format('CREATE POLICY collaborator_%1$s_read_permission ON public.%1$I AS RESTRICTIVE FOR SELECT TO authenticated USING (public.current_user_account_type() <> ''collaborator'' OR public.has_workspace_permission(%2$L, ''read''))', item.table_name, item.resource_key);
    EXECUTE format('CREATE POLICY collaborator_%1$s_insert_permission ON public.%1$I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.current_user_account_type() <> ''collaborator'' OR public.has_workspace_permission(%2$L, ''create''))', item.table_name, item.resource_key);
    EXECUTE format('CREATE POLICY collaborator_%1$s_update_permission ON public.%1$I AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.current_user_account_type() <> ''collaborator'' OR public.has_workspace_permission(%2$L, ''update'')) WITH CHECK (public.current_user_account_type() <> ''collaborator'' OR public.has_workspace_permission(%2$L, ''update''))', item.table_name, item.resource_key);
    EXECUTE format('CREATE POLICY collaborator_%1$s_delete_permission ON public.%1$I AS RESTRICTIVE FOR DELETE TO authenticated USING (public.current_user_account_type() <> ''collaborator'' OR public.has_workspace_permission(%2$L, ''delete''))', item.table_name, item.resource_key);
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.touch_workspace_member_permissions(), public.sync_collaborator_permissions() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_workspace_permission(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_workspace_permission(text, text) TO authenticated;

COMMIT;
