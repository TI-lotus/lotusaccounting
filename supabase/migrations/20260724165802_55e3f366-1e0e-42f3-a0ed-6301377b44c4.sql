CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_tenant_id uuid;
  display_name text;
BEGIN
  display_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));

  INSERT INTO public.tenants (name, owner_user_id)
  VALUES (display_name || ' workspace', NEW.id)
  RETURNING id INTO new_tenant_id;

  INSERT INTO public.users (id, name, role)
  VALUES (NEW.id, display_name, 'admin')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profiles (user_id, tenant_id, full_name, account_type, status)
  VALUES (NEW.id, new_tenant_id, display_name, 'admin', 'active')
  ON CONFLICT (user_id) DO UPDATE SET tenant_id = EXCLUDED.tenant_id;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$function$;

DROP POLICY IF EXISTS "Users can update themselves" ON public.users;

ALTER TABLE public.users DROP COLUMN IF EXISTS tenant_id;

CREATE POLICY "Users can update themselves"
ON public.users
FOR UPDATE
TO authenticated
USING ((auth.uid() = id) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    auth.uid() = id
    AND role IS NOT DISTINCT FROM (
      SELECT (ur.role)::text
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      ORDER BY CASE WHEN ur.role = 'admin'::app_role THEN 1 ELSE 2 END
      LIMIT 1
    )
  )
);