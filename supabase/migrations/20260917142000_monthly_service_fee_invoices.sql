BEGIN;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS invoice_kind text NOT NULL DEFAULT 'manual'
    CHECK (invoice_kind IN ('manual', 'service_fee')),
  ADD COLUMN IF NOT EXISTS billing_period date;

CREATE UNIQUE INDEX IF NOT EXISTS invoices_monthly_service_fee_unique
ON public.invoices (tenant_id, company_id, billing_period)
WHERE invoice_kind = 'service_fee';

CREATE OR REPLACE FUNCTION public.generate_monthly_service_fee_invoices(target_period date DEFAULT date_trunc('month', current_date)::date)
RETURNS SETOF public.invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE workspace_id uuid;
BEGIN
  workspace_id := public.current_user_tenant_id();
  IF auth.role() <> 'authenticated' OR public.current_user_account_type() <> 'admin' OR workspace_id IS NULL THEN
    RAISE EXCEPTION 'Only an active workspace admin can generate service-fee invoices' USING ERRCODE = '42501';
  END IF;
  IF target_period IS NULL OR target_period <> date_trunc('month', target_period)::date THEN
    RAISE EXCEPTION 'Billing period must be the first day of a month' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  INSERT INTO public.invoices (
    tenant_id, company_id, number, amount, status, issued_at, due_date, invoice_kind, billing_period
  )
  SELECT
    workspace_id,
    c.id,
    format('HON-%s-%s', to_char(target_period, 'YYYYMM'), upper(left(replace(c.id::text, '-', ''), 6))),
    c.service_fee,
    'pending',
    now(),
    (target_period + interval '9 days')::date,
    'service_fee',
    target_period
  FROM public.companies c
  WHERE c.tenant_id = workspace_id
    AND c.status = 'active'
    AND COALESCE(c.service_fee, 0) > 0
  ON CONFLICT (tenant_id, company_id, billing_period) WHERE invoice_kind = 'service_fee' DO NOTHING
  RETURNING public.invoices.*;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_monthly_service_fee_invoices(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_monthly_service_fee_invoices(date) TO authenticated;

COMMIT;
