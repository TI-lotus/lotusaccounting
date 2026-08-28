ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS reconciled_at timestamptz,
  ADD COLUMN IF NOT EXISTS reconciled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payments_reconciled_at ON public.payments(reconciled_at);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON public.payments(invoice_id);

CREATE OR REPLACE FUNCTION public.sync_invoice_status_from_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.invoice_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status IN ('completed', 'paid') THEN
    UPDATE public.invoices
    SET status = 'paid'
    WHERE id = NEW.invoice_id;
  ELSIF OLD.status IN ('completed', 'paid') AND NEW.status = 'pending' THEN
    UPDATE public.invoices
    SET status = 'pending'
    WHERE id = NEW.invoice_id
      AND NOT EXISTS (
        SELECT 1
        FROM public.payments p
        WHERE p.invoice_id = NEW.invoice_id
          AND p.id <> NEW.id
          AND p.status IN ('completed', 'paid')
      );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_invoice_status_from_payment ON public.payments;
CREATE TRIGGER sync_invoice_status_from_payment
AFTER INSERT OR UPDATE OF status, invoice_id ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.sync_invoice_status_from_payment();
