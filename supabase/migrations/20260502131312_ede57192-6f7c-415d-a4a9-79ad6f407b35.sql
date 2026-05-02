
-- 1. Fix profiles tenant_id manipulation: prevent users from setting/changing tenant_id directly
-- Drop existing INSERT/UPDATE policies and recreate restricting tenant_id

DROP POLICY IF EXISTS "Users can create their own profile as client" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can create their own profile as client"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND account_type = 'client'
  AND tenant_id IS NULL
  AND company_id IS NULL
);

CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    auth.uid() = user_id
    AND tenant_id IS NOT DISTINCT FROM (SELECT p.tenant_id FROM public.profiles p WHERE p.user_id = auth.uid())
    AND company_id IS NOT DISTINCT FROM (SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid())
    AND account_type IS NOT DISTINCT FROM (SELECT p.account_type FROM public.profiles p WHERE p.user_id = auth.uid())
  )
);

-- 2. Tighten role on policies currently scoped to {public} -> {authenticated}

-- companies
DROP POLICY IF EXISTS "tenant isolation" ON public.companies;
CREATE POLICY "tenant isolation" ON public.companies
FOR ALL TO authenticated
USING (tenant_id = current_user_tenant_id())
WITH CHECK (tenant_id = current_user_tenant_id());

-- invoices
DROP POLICY IF EXISTS "invoices_select" ON public.invoices;
DROP POLICY IF EXISTS "invoices_insert" ON public.invoices;
DROP POLICY IF EXISTS "invoices_update" ON public.invoices;
DROP POLICY IF EXISTS "invoices_delete" ON public.invoices;
CREATE POLICY "invoices_select" ON public.invoices FOR SELECT TO authenticated
USING (tenant_id IN (SELECT users.tenant_id FROM public.users WHERE users.id = auth.uid()));
CREATE POLICY "invoices_insert" ON public.invoices FOR INSERT TO authenticated
WITH CHECK (tenant_id IN (SELECT users.tenant_id FROM public.users WHERE users.id = auth.uid()));
CREATE POLICY "invoices_update" ON public.invoices FOR UPDATE TO authenticated
USING (tenant_id IN (SELECT users.tenant_id FROM public.users WHERE users.id = auth.uid()));
CREATE POLICY "invoices_delete" ON public.invoices FOR DELETE TO authenticated
USING (tenant_id IN (SELECT users.tenant_id FROM public.users WHERE users.id = auth.uid()));

-- payments
DROP POLICY IF EXISTS "payments_select" ON public.payments;
DROP POLICY IF EXISTS "payments_insert" ON public.payments;
DROP POLICY IF EXISTS "payments_update" ON public.payments;
DROP POLICY IF EXISTS "payments_delete" ON public.payments;
CREATE POLICY "payments_select" ON public.payments FOR SELECT TO authenticated
USING (tenant_id IN (SELECT users.tenant_id FROM public.users WHERE users.id = auth.uid()));
CREATE POLICY "payments_insert" ON public.payments FOR INSERT TO authenticated
WITH CHECK (tenant_id IN (SELECT users.tenant_id FROM public.users WHERE users.id = auth.uid()));
CREATE POLICY "payments_update" ON public.payments FOR UPDATE TO authenticated
USING (tenant_id IN (SELECT users.tenant_id FROM public.users WHERE users.id = auth.uid()));
CREATE POLICY "payments_delete" ON public.payments FOR DELETE TO authenticated
USING (tenant_id IN (SELECT users.tenant_id FROM public.users WHERE users.id = auth.uid()));

-- contracts
DROP POLICY IF EXISTS "contracts_select" ON public.contracts;
DROP POLICY IF EXISTS "contracts_insert" ON public.contracts;
DROP POLICY IF EXISTS "contracts_update" ON public.contracts;
DROP POLICY IF EXISTS "contracts_delete" ON public.contracts;
CREATE POLICY "contracts_select" ON public.contracts FOR SELECT TO authenticated
USING (tenant_id IN (SELECT users.tenant_id FROM public.users WHERE users.id = auth.uid()));
CREATE POLICY "contracts_insert" ON public.contracts FOR INSERT TO authenticated
WITH CHECK (tenant_id IN (SELECT users.tenant_id FROM public.users WHERE users.id = auth.uid()));
CREATE POLICY "contracts_update" ON public.contracts FOR UPDATE TO authenticated
USING (tenant_id IN (SELECT users.tenant_id FROM public.users WHERE users.id = auth.uid()));
CREATE POLICY "contracts_delete" ON public.contracts FOR DELETE TO authenticated
USING (tenant_id IN (SELECT users.tenant_id FROM public.users WHERE users.id = auth.uid()));

-- conversations
DROP POLICY IF EXISTS "conversations_select" ON public.conversations;
DROP POLICY IF EXISTS "conversations_insert" ON public.conversations;
DROP POLICY IF EXISTS "conversations_update" ON public.conversations;
DROP POLICY IF EXISTS "conversations_delete" ON public.conversations;
CREATE POLICY "conversations_select" ON public.conversations FOR SELECT TO authenticated
USING (tenant_id IN (SELECT users.tenant_id FROM public.users WHERE users.id = auth.uid()));
CREATE POLICY "conversations_insert" ON public.conversations FOR INSERT TO authenticated
WITH CHECK (tenant_id IN (SELECT users.tenant_id FROM public.users WHERE users.id = auth.uid()));
CREATE POLICY "conversations_update" ON public.conversations FOR UPDATE TO authenticated
USING (tenant_id IN (SELECT users.tenant_id FROM public.users WHERE users.id = auth.uid()));
CREATE POLICY "conversations_delete" ON public.conversations FOR DELETE TO authenticated
USING (tenant_id IN (SELECT users.tenant_id FROM public.users WHERE users.id = auth.uid()));

-- events
DROP POLICY IF EXISTS "events_select" ON public.events;
DROP POLICY IF EXISTS "events_insert" ON public.events;
CREATE POLICY "events_select" ON public.events FOR SELECT TO authenticated
USING (tenant_id IN (SELECT users.tenant_id FROM public.users WHERE users.id = auth.uid()));
CREATE POLICY "events_insert" ON public.events FOR INSERT TO authenticated
WITH CHECK (tenant_id IN (SELECT users.tenant_id FROM public.users WHERE users.id = auth.uid()));

-- activity_logs
DROP POLICY IF EXISTS "logs_select" ON public.activity_logs;
DROP POLICY IF EXISTS "logs_insert" ON public.activity_logs;
CREATE POLICY "logs_select" ON public.activity_logs FOR SELECT TO authenticated
USING (tenant_id IN (SELECT users.tenant_id FROM public.users WHERE users.id = auth.uid()));
CREATE POLICY "logs_insert" ON public.activity_logs FOR INSERT TO authenticated
WITH CHECK (tenant_id IN (SELECT users.tenant_id FROM public.users WHERE users.id = auth.uid()));

-- 3. Lock down SECURITY DEFINER functions: revoke direct EXECUTE from anon/authenticated.
-- They are still callable inside RLS policies because policies are evaluated by Postgres engine.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.current_user_tenant_id() FROM PUBLIC, anon, authenticated;
