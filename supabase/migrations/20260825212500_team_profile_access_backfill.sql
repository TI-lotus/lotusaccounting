ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL;

UPDATE public.users u
SET tenant_id = p.tenant_id
FROM public.profiles p
WHERE p.user_id = u.id
  AND u.tenant_id IS NULL
  AND p.tenant_id IS NOT NULL;

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR (
    tenant_id = public.current_user_tenant_id()
    AND public.can_manage_current_tenant()
  )
);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  OR (
    tenant_id = public.current_user_tenant_id()
    AND public.current_user_account_type() = 'admin'
  )
)
WITH CHECK (
  (
    public.current_user_account_type() = 'admin'
    AND tenant_id = public.current_user_tenant_id()
  )
  OR (
    auth.uid() = user_id
    AND tenant_id IS NOT DISTINCT FROM public.current_user_tenant_id()
    AND company_id IS NOT DISTINCT FROM public.current_user_company_id()
    AND account_type IS NOT DISTINCT FROM public.current_user_account_type()
  )
);
