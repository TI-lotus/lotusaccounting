BEGIN;

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
  ELSIF OLD.status IN ('completed', 'paid')
    AND NEW.status IN ('pending', 'cancelled', 'canceled') THEN
    UPDATE public.invoices
    SET status = 'pending'
    WHERE id = NEW.invoice_id
      AND NOT EXISTS (
        SELECT 1
        FROM public.payments payment
        WHERE payment.invoice_id = NEW.invoice_id
          AND payment.id <> NEW.id
          AND payment.status IN ('completed', 'paid')
      );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_invoice_status_from_payment() FROM PUBLIC, anon, authenticated;

COMMIT;
