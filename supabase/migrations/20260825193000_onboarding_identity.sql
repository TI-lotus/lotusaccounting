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
BEGIN
  display_name := NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'full_name', '')), '');
  display_name := COALESCE(display_name, split_part(NEW.email, '@', 1));

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

  INSERT INTO public.users (id, name, role)
  VALUES (NEW.id, display_name, assigned_role::text)
  ON CONFLICT (id) DO UPDATE
  SET
    name = COALESCE(NULLIF(public.users.name, ''), EXCLUDED.name),
    role = COALESCE(public.users.role, EXCLUDED.role);

  INSERT INTO public.profiles (user_id, tenant_id, full_name, account_type, status)
  VALUES (NEW.id, new_tenant_id, display_name, assigned_role::text, 'active')
  ON CONFLICT (user_id) DO UPDATE
  SET
    tenant_id = COALESCE(public.profiles.tenant_id, EXCLUDED.tenant_id),
    full_name = COALESCE(NULLIF(public.profiles.full_name, ''), EXCLUDED.full_name),
    account_type = COALESCE(NULLIF(public.profiles.account_type, ''), EXCLUDED.account_type),
    status = COALESCE(NULLIF(public.profiles.status, ''), EXCLUDED.status);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, assigned_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$function$;

UPDATE public.profiles p
SET full_name = COALESCE(
  NULLIF(trim(au.raw_user_meta_data->>'full_name'), ''),
  split_part(au.email, '@', 1)
)
FROM auth.users au
WHERE p.user_id = au.id
  AND NULLIF(trim(COALESCE(p.full_name, '')), '') IS NULL;

UPDATE public.users u
SET name = COALESCE(
  NULLIF(trim(au.raw_user_meta_data->>'full_name'), ''),
  split_part(au.email, '@', 1)
)
FROM auth.users au
WHERE u.id = au.id
  AND NULLIF(trim(COALESCE(u.name, '')), '') IS NULL;

UPDATE public.tenants t
SET name = COALESCE(
  NULLIF(trim(au.raw_user_meta_data->>'workspace_name'), ''),
  NULLIF(trim(au.raw_user_meta_data->>'full_name'), '') || ' workspace',
  split_part(au.email, '@', 1) || ' workspace'
)
FROM auth.users au
WHERE t.owner_user_id = au.id
  AND (
    NULLIF(trim(COALESCE(t.name, '')), '') IS NULL
    OR t.name = ' workspace'
  );
