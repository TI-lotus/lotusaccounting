DROP POLICY IF EXISTS client_write_companies_guard ON public.companies;
DROP POLICY IF EXISTS client_write_invoices_guard ON public.invoices;
DROP POLICY IF EXISTS client_write_payments_guard ON public.payments;
DROP POLICY IF EXISTS client_write_tasks_guard ON public.tasks;
DROP POLICY IF EXISTS client_write_documents_guard ON public.documents;

CREATE POLICY client_companies_insert_guard ON public.companies
AS RESTRICTIVE
FOR INSERT TO authenticated
WITH CHECK (public.current_user_account_type() <> 'client');

CREATE POLICY client_companies_update_guard ON public.companies
AS RESTRICTIVE
FOR UPDATE TO authenticated
USING (public.current_user_account_type() <> 'client')
WITH CHECK (public.current_user_account_type() <> 'client');

CREATE POLICY client_companies_delete_guard ON public.companies
AS RESTRICTIVE
FOR DELETE TO authenticated
USING (public.current_user_account_type() <> 'client');

CREATE POLICY client_invoices_insert_guard ON public.invoices
AS RESTRICTIVE
FOR INSERT TO authenticated
WITH CHECK (public.current_user_account_type() <> 'client');

CREATE POLICY client_invoices_update_guard ON public.invoices
AS RESTRICTIVE
FOR UPDATE TO authenticated
USING (public.current_user_account_type() <> 'client')
WITH CHECK (public.current_user_account_type() <> 'client');

CREATE POLICY client_invoices_delete_guard ON public.invoices
AS RESTRICTIVE
FOR DELETE TO authenticated
USING (public.current_user_account_type() <> 'client');

CREATE POLICY client_payments_insert_guard ON public.payments
AS RESTRICTIVE
FOR INSERT TO authenticated
WITH CHECK (public.current_user_account_type() <> 'client');

CREATE POLICY client_payments_update_guard ON public.payments
AS RESTRICTIVE
FOR UPDATE TO authenticated
USING (public.current_user_account_type() <> 'client')
WITH CHECK (public.current_user_account_type() <> 'client');

CREATE POLICY client_payments_delete_guard ON public.payments
AS RESTRICTIVE
FOR DELETE TO authenticated
USING (public.current_user_account_type() <> 'client');

CREATE POLICY client_tasks_insert_guard ON public.tasks
AS RESTRICTIVE
FOR INSERT TO authenticated
WITH CHECK (public.current_user_account_type() <> 'client');

CREATE POLICY client_tasks_update_guard ON public.tasks
AS RESTRICTIVE
FOR UPDATE TO authenticated
USING (
  public.current_user_account_type() <> 'client'
  OR company_id = public.current_user_company_id()
)
WITH CHECK (
  public.current_user_account_type() <> 'client'
  OR company_id = public.current_user_company_id()
);

CREATE POLICY client_tasks_delete_guard ON public.tasks
AS RESTRICTIVE
FOR DELETE TO authenticated
USING (public.current_user_account_type() <> 'client');

CREATE POLICY client_documents_insert_guard ON public.documents
AS RESTRICTIVE
FOR INSERT TO authenticated
WITH CHECK (
  public.current_user_account_type() <> 'client'
  OR company_id = public.current_user_company_id()
);

CREATE POLICY client_documents_update_guard ON public.documents
AS RESTRICTIVE
FOR UPDATE TO authenticated
USING (
  public.current_user_account_type() <> 'client'
  OR company_id = public.current_user_company_id()
)
WITH CHECK (
  public.current_user_account_type() <> 'client'
  OR company_id = public.current_user_company_id()
);

CREATE POLICY client_documents_delete_guard ON public.documents
AS RESTRICTIVE
FOR DELETE TO authenticated
USING (public.current_user_account_type() <> 'client');
