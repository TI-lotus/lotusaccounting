BEGIN;

CREATE OR REPLACE FUNCTION public.guard_linked_payment_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invoice_row public.invoices%ROWTYPE;
  completed_total numeric;
  is_reversal boolean := false;
BEGIN
  IF NEW.invoice_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT *
  INTO invoice_row
  FROM public.invoices
  WHERE id = NEW.invoice_id;

  IF invoice_row.id IS NULL THEN
    RAISE EXCEPTION 'Linked invoice does not exist' USING ERRCODE = '23503';
  END IF;

  IF NEW.tenant_id IS DISTINCT FROM invoice_row.tenant_id THEN
    RAISE EXCEPTION 'Payment and invoice must belong to the same workspace' USING ERRCODE = '23514';
  END IF;

  IF NEW.company_id IS DISTINCT FROM invoice_row.company_id THEN
    RAISE EXCEPTION 'Payment and invoice must belong to the same client' USING ERRCODE = '23514';
  END IF;

  IF NEW.direction IN ('saida', 'expense') THEN
    RAISE EXCEPTION 'Expenses cannot be linked to client invoices' USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    is_reversal := OLD.invoice_id = NEW.invoice_id
      AND OLD.status IN ('completed', 'paid')
      AND NEW.status IN ('pending', 'cancelled', 'canceled');
  END IF;

  IF invoice_row.status IN ('cancelled', 'canceled') AND NOT is_reversal THEN
    RAISE EXCEPTION 'Cancelled invoices cannot receive payments' USING ERRCODE = '23514';
  END IF;

  IF invoice_row.status = 'paid'
    AND NOT is_reversal
    AND NOT (
      TG_OP = 'UPDATE'
      AND OLD.id = NEW.id
      AND OLD.status IN ('completed', 'paid')
      AND NEW.status IN ('completed', 'paid')
    ) THEN
    RAISE EXCEPTION 'Paid invoices cannot receive another payment' USING ERRCODE = '23514';
  END IF;

  IF NEW.status IN ('completed', 'paid') THEN
    SELECT COALESCE(SUM(payment.amount), 0)
    INTO completed_total
    FROM public.payments payment
    WHERE payment.invoice_id = NEW.invoice_id
      AND payment.id IS DISTINCT FROM NEW.id
      AND payment.status IN ('completed', 'paid');

    IF completed_total + NEW.amount > invoice_row.amount THEN
      RAISE EXCEPTION 'Completed payments cannot exceed the invoice amount' USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_linked_payment_integrity ON public.payments;
CREATE TRIGGER guard_linked_payment_integrity
BEFORE INSERT OR UPDATE OF tenant_id, company_id, invoice_id, amount, status, direction
ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.guard_linked_payment_integrity();

CREATE OR REPLACE FUNCTION public.guard_invoice_amount_against_payments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  completed_total numeric;
BEGIN
  SELECT COALESCE(SUM(payment.amount), 0)
  INTO completed_total
  FROM public.payments payment
  WHERE payment.invoice_id = NEW.id
    AND payment.status IN ('completed', 'paid');

  IF completed_total > NEW.amount THEN
    RAISE EXCEPTION 'Invoice amount cannot be lower than completed payments' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_invoice_amount_against_payments ON public.invoices;
CREATE TRIGGER guard_invoice_amount_against_payments
BEFORE INSERT OR UPDATE OF amount
ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.guard_invoice_amount_against_payments();

REVOKE ALL ON FUNCTION public.guard_linked_payment_integrity(), public.guard_invoice_amount_against_payments() FROM PUBLIC, anon, authenticated;

COMMIT;
