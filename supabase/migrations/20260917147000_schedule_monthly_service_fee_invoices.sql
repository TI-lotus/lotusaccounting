BEGIN;

-- The scheduler runs with the Supabase service role. Keep the public/admin
-- RPC separate from this worker-only bulk operation, so a browser session can
-- never generate invoices for another workspace.
CREATE OR REPLACE FUNCTION public.generate_service_fee_invoices_for_all_workspaces(
  target_period date DEFAULT date_trunc('month', current_date)::date
)
RETURNS TABLE (workspace_id uuid, invoices_created integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE workspace record;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Service role is required to generate scheduled service-fee invoices' USING ERRCODE = '42501';
  END IF;

  IF target_period IS NULL OR target_period <> date_trunc('month', target_period)::date THEN
    RAISE EXCEPTION 'Billing period must be the first day of a month' USING ERRCODE = '22023';
  END IF;

  FOR workspace IN SELECT id FROM public.tenants LOOP
    RETURN QUERY
    WITH inserted AS (
      INSERT INTO public.invoices (
        tenant_id, company_id, number, amount, status, issued_at, due_date, invoice_kind, billing_period
      )
      SELECT
        workspace.id,
        c.id,
        format('HON-%s-%s', to_char(target_period, 'YYYYMM'), upper(left(replace(c.id::text, '-', ''), 6))),
        c.service_fee,
        'pending',
        now(),
        (target_period + interval '9 days')::date,
        'service_fee',
        target_period
      FROM public.companies c
      WHERE c.tenant_id = workspace.id
        AND c.status = 'active'
        AND COALESCE(c.service_fee, 0) > 0
      ON CONFLICT (tenant_id, company_id, billing_period) WHERE invoice_kind = 'service_fee' DO NOTHING
      RETURNING id
    )
    SELECT workspace.id, count(*)::integer FROM inserted;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_service_fee_invoices_for_all_workspaces(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_service_fee_invoices_for_all_workspaces(date) TO service_role;

COMMIT;
