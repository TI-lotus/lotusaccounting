CREATE OR REPLACE FUNCTION public.apply_reconciliation_match(match_id uuid, approve boolean)
RETURNS public.reconciliation_matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  match_row public.reconciliation_matches;
  transaction_row public.bank_transactions;
BEGIN
  SELECT * INTO match_row
  FROM public.reconciliation_matches
  WHERE id = match_id
    AND tenant_id = public.current_user_tenant_id()
  FOR UPDATE;

  IF match_row.id IS NULL THEN
    RAISE EXCEPTION 'Match not found' USING ERRCODE = '02000';
  END IF;

  IF NOT public.has_workspace_permission('finance', 'update') THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO transaction_row
  FROM public.bank_transactions
  WHERE id = match_row.bank_transaction_id
    AND tenant_id = match_row.tenant_id;

  UPDATE public.reconciliation_matches
  SET status = CASE WHEN approve THEN 'approved' ELSE 'rejected' END,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  WHERE id = match_id
  RETURNING * INTO match_row;

  IF approve THEN
    UPDATE public.bank_transactions
    SET reconciled_at = now()
    WHERE id = match_row.bank_transaction_id;

    IF match_row.payment_id IS NOT NULL THEN
      UPDATE public.payments
      SET status = 'completed',
          paid_at = COALESCE(transaction_row.posted_at::timestamptz, now()),
          reconciled_at = now(),
          reconciled_by = auth.uid()
      WHERE id = match_row.payment_id
        AND tenant_id = match_row.tenant_id;
    END IF;
  END IF;

  RETURN match_row;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_reconciliation_match(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_reconciliation_match(uuid, boolean) TO authenticated;
