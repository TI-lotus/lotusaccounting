CREATE TABLE IF NOT EXISTS public.workspace_settings (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  office_name text,
  fiscal_year_end text NOT NULL DEFAULT 'Dezembro',
  currency text NOT NULL DEFAULT 'BRL',
  theme_preference text NOT NULL DEFAULT 'light' CHECK (theme_preference IN ('light', 'dark', 'system')),
  notification_channels jsonb NOT NULL DEFAULT '{
    "email": true,
    "paymentAlerts": true,
    "whatsapp": false,
    "whatsappPhone": "",
    "whatsappTypes": {
      "tarefas": true,
      "vencimentos": true,
      "recebimentos": false,
      "documentos": false
    }
  }'::jsonb,
  automation_preferences jsonb NOT NULL DEFAULT '{
    "reviewIncompleteDocuments": true,
    "generateMonthlyObligations": true,
    "dueDateAlerts": true,
    "lowConfidenceReview": true
  }'::jsonb,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.integration_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  integration_id text NOT NULL,
  status text NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'error', 'pending')),
  account_label text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  credentials jsonb NOT NULL DEFAULT '[]'::jsonb,
  usage jsonb NOT NULL DEFAULT '{"calls": 0, "limit": 0, "period": ""}'::jsonb,
  last_sync_at timestamptz,
  connected_at timestamptz,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, integration_id)
);

ALTER TABLE public.workspace_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_connections ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_integration_connections_tenant_id
  ON public.integration_connections(tenant_id);

CREATE INDEX IF NOT EXISTS idx_integration_connections_status
  ON public.integration_connections(status);

CREATE OR REPLACE FUNCTION public.touch_workspace_settings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.touch_integration_connections_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  IF NEW.status = 'connected' AND OLD.status IS DISTINCT FROM 'connected' THEN
    NEW.connected_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_workspace_settings_updated_at ON public.workspace_settings;
CREATE TRIGGER trg_touch_workspace_settings_updated_at
BEFORE UPDATE ON public.workspace_settings
FOR EACH ROW EXECUTE FUNCTION public.touch_workspace_settings_updated_at();

DROP TRIGGER IF EXISTS trg_touch_integration_connections_updated_at ON public.integration_connections;
CREATE TRIGGER trg_touch_integration_connections_updated_at
BEFORE UPDATE ON public.integration_connections
FOR EACH ROW EXECUTE FUNCTION public.touch_integration_connections_updated_at();

DROP POLICY IF EXISTS workspace_settings_select ON public.workspace_settings;
DROP POLICY IF EXISTS workspace_settings_insert ON public.workspace_settings;
DROP POLICY IF EXISTS workspace_settings_update ON public.workspace_settings;
DROP POLICY IF EXISTS workspace_settings_delete ON public.workspace_settings;

CREATE POLICY workspace_settings_select ON public.workspace_settings
FOR SELECT TO authenticated
USING (tenant_id = public.current_user_tenant_id());

CREATE POLICY workspace_settings_insert ON public.workspace_settings
FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = public.current_user_tenant_id()
  AND public.can_manage_current_tenant()
);

CREATE POLICY workspace_settings_update ON public.workspace_settings
FOR UPDATE TO authenticated
USING (
  tenant_id = public.current_user_tenant_id()
  AND public.can_manage_current_tenant()
)
WITH CHECK (
  tenant_id = public.current_user_tenant_id()
  AND public.can_manage_current_tenant()
);

CREATE POLICY workspace_settings_delete ON public.workspace_settings
FOR DELETE TO authenticated
USING (
  tenant_id = public.current_user_tenant_id()
  AND public.can_manage_current_tenant()
);

DROP POLICY IF EXISTS integration_connections_select ON public.integration_connections;
DROP POLICY IF EXISTS integration_connections_insert ON public.integration_connections;
DROP POLICY IF EXISTS integration_connections_update ON public.integration_connections;
DROP POLICY IF EXISTS integration_connections_delete ON public.integration_connections;

CREATE POLICY integration_connections_select ON public.integration_connections
FOR SELECT TO authenticated
USING (
  tenant_id = public.current_user_tenant_id()
  AND public.can_manage_current_tenant()
);

CREATE POLICY integration_connections_insert ON public.integration_connections
FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = public.current_user_tenant_id()
  AND public.can_manage_current_tenant()
);

CREATE POLICY integration_connections_update ON public.integration_connections
FOR UPDATE TO authenticated
USING (
  tenant_id = public.current_user_tenant_id()
  AND public.can_manage_current_tenant()
)
WITH CHECK (
  tenant_id = public.current_user_tenant_id()
  AND public.can_manage_current_tenant()
);

CREATE POLICY integration_connections_delete ON public.integration_connections
FOR DELETE TO authenticated
USING (
  tenant_id = public.current_user_tenant_id()
  AND public.can_manage_current_tenant()
);

INSERT INTO public.workspace_settings (tenant_id, office_name)
SELECT id, name
FROM public.tenants
ON CONFLICT (tenant_id) DO NOTHING;
