
-- Standardize tenant scoping to use current_user_tenant_id() (profiles-based)
-- activity_logs
DROP POLICY IF EXISTS logs_select ON public.activity_logs;
DROP POLICY IF EXISTS logs_insert ON public.activity_logs;
CREATE POLICY logs_select ON public.activity_logs FOR SELECT USING (tenant_id = public.current_user_tenant_id());
CREATE POLICY logs_insert ON public.activity_logs FOR INSERT WITH CHECK (tenant_id = public.current_user_tenant_id());

-- contracts
DROP POLICY IF EXISTS contracts_select ON public.contracts;
DROP POLICY IF EXISTS contracts_insert ON public.contracts;
DROP POLICY IF EXISTS contracts_update ON public.contracts;
DROP POLICY IF EXISTS contracts_delete ON public.contracts;
CREATE POLICY contracts_select ON public.contracts FOR SELECT USING (tenant_id = public.current_user_tenant_id());
CREATE POLICY contracts_insert ON public.contracts FOR INSERT WITH CHECK (tenant_id = public.current_user_tenant_id());
CREATE POLICY contracts_update ON public.contracts FOR UPDATE USING (tenant_id = public.current_user_tenant_id()) WITH CHECK (tenant_id = public.current_user_tenant_id());
CREATE POLICY contracts_delete ON public.contracts FOR DELETE USING (tenant_id = public.current_user_tenant_id());

-- conversations
DROP POLICY IF EXISTS conversations_select ON public.conversations;
DROP POLICY IF EXISTS conversations_insert ON public.conversations;
DROP POLICY IF EXISTS conversations_update ON public.conversations;
DROP POLICY IF EXISTS conversations_delete ON public.conversations;
CREATE POLICY conversations_select ON public.conversations FOR SELECT USING (tenant_id = public.current_user_tenant_id());
CREATE POLICY conversations_insert ON public.conversations FOR INSERT WITH CHECK (tenant_id = public.current_user_tenant_id());
CREATE POLICY conversations_update ON public.conversations FOR UPDATE USING (tenant_id = public.current_user_tenant_id()) WITH CHECK (tenant_id = public.current_user_tenant_id());
CREATE POLICY conversations_delete ON public.conversations FOR DELETE USING (tenant_id = public.current_user_tenant_id());

-- events
DROP POLICY IF EXISTS events_select ON public.events;
DROP POLICY IF EXISTS events_insert ON public.events;
CREATE POLICY events_select ON public.events FOR SELECT USING (tenant_id = public.current_user_tenant_id());
CREATE POLICY events_insert ON public.events FOR INSERT WITH CHECK (tenant_id = public.current_user_tenant_id());

-- invoices
DROP POLICY IF EXISTS invoices_select ON public.invoices;
DROP POLICY IF EXISTS invoices_insert ON public.invoices;
DROP POLICY IF EXISTS invoices_update ON public.invoices;
DROP POLICY IF EXISTS invoices_delete ON public.invoices;
CREATE POLICY invoices_select ON public.invoices FOR SELECT USING (tenant_id = public.current_user_tenant_id());
CREATE POLICY invoices_insert ON public.invoices FOR INSERT WITH CHECK (tenant_id = public.current_user_tenant_id());
CREATE POLICY invoices_update ON public.invoices FOR UPDATE USING (tenant_id = public.current_user_tenant_id()) WITH CHECK (tenant_id = public.current_user_tenant_id());
CREATE POLICY invoices_delete ON public.invoices FOR DELETE USING (tenant_id = public.current_user_tenant_id());

-- payments
DROP POLICY IF EXISTS payments_select ON public.payments;
DROP POLICY IF EXISTS payments_insert ON public.payments;
DROP POLICY IF EXISTS payments_update ON public.payments;
DROP POLICY IF EXISTS payments_delete ON public.payments;
CREATE POLICY payments_select ON public.payments FOR SELECT USING (tenant_id = public.current_user_tenant_id());
CREATE POLICY payments_insert ON public.payments FOR INSERT WITH CHECK (tenant_id = public.current_user_tenant_id());
CREATE POLICY payments_update ON public.payments FOR UPDATE USING (tenant_id = public.current_user_tenant_id()) WITH CHECK (tenant_id = public.current_user_tenant_id());
CREATE POLICY payments_delete ON public.payments FOR DELETE USING (tenant_id = public.current_user_tenant_id());
