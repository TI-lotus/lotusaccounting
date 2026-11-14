BEGIN;

-- The workspace permission registry uses the public key `financial` for
-- payments, invoices, obligations and reconciliation. Older reconciliation
-- policies used `finance`, which made the collaborator matrix ineffective.
DROP POLICY IF EXISTS bank_accounts_read ON public.bank_accounts;
CREATE POLICY bank_accounts_read ON public.bank_accounts
FOR SELECT TO authenticated
USING (
  tenant_id = public.current_user_tenant_id()
  AND public.has_workspace_permission('financial', 'read')
);

DROP POLICY IF EXISTS bank_transactions_read ON public.bank_transactions;
CREATE POLICY bank_transactions_read ON public.bank_transactions
FOR SELECT TO authenticated
USING (
  tenant_id = public.current_user_tenant_id()
  AND public.has_workspace_permission('financial', 'read')
);

DROP POLICY IF EXISTS reconciliation_matches_read ON public.reconciliation_matches;
CREATE POLICY reconciliation_matches_read ON public.reconciliation_matches
FOR SELECT TO authenticated
USING (
  tenant_id = public.current_user_tenant_id()
  AND public.has_workspace_permission('financial', 'read')
);

DROP POLICY IF EXISTS reconciliation_matches_update ON public.reconciliation_matches;
CREATE POLICY reconciliation_matches_update ON public.reconciliation_matches
FOR UPDATE TO authenticated
USING (
  tenant_id = public.current_user_tenant_id()
  AND public.has_workspace_permission('financial', 'update')
)
WITH CHECK (
  tenant_id = public.current_user_tenant_id()
  AND public.has_workspace_permission('financial', 'update')
);

CREATE OR REPLACE FUNCTION public.apply_reconciliation_match(match_id uuid, approve boolean)
RETURNS public.reconciliation_matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  match_row public.reconciliation_matches;
BEGIN
  SELECT * INTO match_row
  FROM public.reconciliation_matches
  WHERE id = match_id
    AND tenant_id = public.current_user_tenant_id()
  FOR UPDATE;

  IF match_row.id IS NULL THEN
    RAISE EXCEPTION 'Match not found' USING ERRCODE = '02000';
  END IF;

  IF NOT public.has_workspace_permission('financial', 'update') THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

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
      SET reconciled_at = now(),
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

COMMIT;
