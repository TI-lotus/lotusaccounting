BEGIN;

-- Every workspace must have a durable settings row, including tenants created
-- after the original workspace_settings backfill migration.
CREATE OR REPLACE FUNCTION public.create_workspace_settings_for_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.workspace_settings (tenant_id, office_name)
  VALUES (NEW.id, NEW.name)
  ON CONFLICT (tenant_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS create_workspace_settings_for_tenant ON public.tenants;
CREATE TRIGGER create_workspace_settings_for_tenant
AFTER INSERT ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.create_workspace_settings_for_tenant();

INSERT INTO public.workspace_settings (tenant_id, office_name)
SELECT t.id, t.name
FROM public.tenants t
LEFT JOIN public.workspace_settings ws ON ws.tenant_id = t.id
WHERE ws.tenant_id IS NULL;

-- Identity and organization records are managed by the workspace admin. The
-- existing permissive self-update policy is constrained by these guards.
DROP POLICY IF EXISTS profile_identity_admin_update ON public.profiles;
CREATE POLICY profile_identity_admin_update ON public.profiles AS RESTRICTIVE
FOR UPDATE TO authenticated
USING (
  tenant_id = public.current_user_tenant_id()
  AND public.current_user_account_type() = 'admin'
)
WITH CHECK (
  tenant_id = public.current_user_tenant_id()
  AND public.current_user_account_type() = 'admin'
);

DROP POLICY IF EXISTS workspace_settings_admin_write ON public.workspace_settings;
CREATE POLICY workspace_settings_admin_write ON public.workspace_settings AS RESTRICTIVE
FOR ALL TO authenticated
USING (
  tenant_id = public.current_user_tenant_id()
  AND public.current_user_account_type() = 'admin'
)
WITH CHECK (
  tenant_id = public.current_user_tenant_id()
  AND public.current_user_account_type() = 'admin'
);

REVOKE ALL ON FUNCTION public.create_workspace_settings_for_tenant() FROM PUBLIC, anon, authenticated;

COMMIT;
