BEGIN;

CREATE OR REPLACE FUNCTION public.guard_invoice_paid_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'paid'
    AND NOT EXISTS (
      SELECT 1
      FROM public.payments payment
      WHERE payment.invoice_id = NEW.id
        AND payment.status IN ('completed', 'paid')
    ) THEN
    RAISE EXCEPTION 'An invoice can only be paid after a completed payment is recorded' USING ERRCODE = '23514';
  END IF;

  IF OLD.status = 'paid'
    AND NEW.status IN ('pending', 'overdue', 'draft')
    AND EXISTS (
      SELECT 1
      FROM public.payments payment
      WHERE payment.invoice_id = NEW.id
        AND payment.status IN ('completed', 'paid')
    ) THEN
    RAISE EXCEPTION 'An invoice with a completed payment cannot be reopened manually' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_invoice_paid_status ON public.invoices;
CREATE TRIGGER guard_invoice_paid_status
BEFORE UPDATE OF status ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.guard_invoice_paid_status();

CREATE OR REPLACE FUNCTION public.prevent_reconciled_payment_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.reconciled_at IS NOT NULL THEN
    RAISE EXCEPTION 'Reconciled payments cannot be deleted.' USING ERRCODE = '23514';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS prevent_reconciled_payment_delete ON public.payments;
CREATE TRIGGER prevent_reconciled_payment_delete
BEFORE DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.prevent_reconciled_payment_delete();

REVOKE ALL ON FUNCTION public.guard_invoice_paid_status(), public.prevent_reconciled_payment_delete() FROM PUBLIC, anon, authenticated;

COMMIT;
