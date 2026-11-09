BEGIN;

DROP POLICY IF EXISTS workspace_settings_admin_write ON public.workspace_settings;
DROP POLICY IF EXISTS workspace_settings_admin_insert ON public.workspace_settings;
DROP POLICY IF EXISTS workspace_settings_admin_update ON public.workspace_settings;
DROP POLICY IF EXISTS workspace_settings_admin_delete ON public.workspace_settings;

CREATE POLICY workspace_settings_admin_insert ON public.workspace_settings AS RESTRICTIVE
FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = public.current_user_tenant_id()
  AND public.current_user_account_type() = 'admin'
);

CREATE POLICY workspace_settings_admin_update ON public.workspace_settings AS RESTRICTIVE
FOR UPDATE TO authenticated
USING (
  tenant_id = public.current_user_tenant_id()
  AND public.current_user_account_type() = 'admin'
)
WITH CHECK (
  tenant_id = public.current_user_tenant_id()
  AND public.current_user_account_type() = 'admin'
);

CREATE POLICY workspace_settings_admin_delete ON public.workspace_settings AS RESTRICTIVE
FOR DELETE TO authenticated
USING (
  tenant_id = public.current_user_tenant_id()
  AND public.current_user_account_type() = 'admin'
);

COMMIT;
