BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS avatar_url text;

ALTER TABLE public.workspace_settings
  ADD COLUMN IF NOT EXISTS cnpj text;

CREATE OR REPLACE FUNCTION public.normalize_profile_cpf()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE normalized_cpf text;
BEGIN
  normalized_cpf := NULLIF(regexp_replace(COALESCE(NEW.cpf, ''), '[^0-9]', '', 'g'), '');
  IF normalized_cpf IS NOT NULL AND length(normalized_cpf) <> 11 THEN
    RAISE EXCEPTION 'CPF must contain 11 digits' USING ERRCODE = '22023';
  END IF;
  NEW.cpf := normalized_cpf;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_profile_cpf ON public.profiles;
CREATE TRIGGER normalize_profile_cpf
BEFORE INSERT OR UPDATE OF cpf ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.normalize_profile_cpf();

CREATE OR REPLACE FUNCTION public.normalize_workspace_cnpj()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE normalized_cnpj text;
BEGIN
  normalized_cnpj := NULLIF(regexp_replace(COALESCE(NEW.cnpj, ''), '[^0-9]', '', 'g'), '');
  IF normalized_cnpj IS NOT NULL AND length(normalized_cnpj) <> 14 THEN
    RAISE EXCEPTION 'Workspace CNPJ must contain 14 digits' USING ERRCODE = '22023';
  END IF;
  NEW.cnpj := normalized_cnpj;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_workspace_cnpj ON public.workspace_settings;
CREATE TRIGGER normalize_workspace_cnpj
BEFORE INSERT OR UPDATE OF cnpj ON public.workspace_settings
FOR EACH ROW EXECUTE FUNCTION public.normalize_workspace_cnpj();

-- A policy set containing only restrictive policies denies every row. This
-- permissive rule is intentionally paired with the restrictive tenant/admin
-- guards already present on invites.
DROP POLICY IF EXISTS invites_admin_access ON public.invites;
CREATE POLICY invites_admin_access ON public.invites
FOR ALL TO authenticated
USING (tenant_id = public.current_user_tenant_id() AND public.current_user_account_type() = 'admin')
WITH CHECK (tenant_id = public.current_user_tenant_id() AND public.current_user_account_type() = 'admin');

CREATE OR REPLACE FUNCTION public.guard_last_workspace_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.account_type = 'admin' AND OLD.status = 'active'
    AND (NEW.account_type IS DISTINCT FROM 'admin' OR NEW.status IS DISTINCT FROM 'active')
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.tenant_id = OLD.tenant_id
        AND p.user_id IS DISTINCT FROM OLD.user_id
        AND p.account_type = 'admin'
        AND p.status = 'active'
    ) THEN
    RAISE EXCEPTION 'A workspace must keep at least one active administrator' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_last_workspace_admin ON public.profiles;
CREATE TRIGGER guard_last_workspace_admin
BEFORE UPDATE OF account_type, status ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_last_workspace_admin();

REVOKE ALL ON FUNCTION public.normalize_profile_cpf(), public.normalize_workspace_cnpj(), public.guard_last_workspace_admin() FROM PUBLIC, anon, authenticated;

COMMIT;
