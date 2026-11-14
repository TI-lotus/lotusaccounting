BEGIN;

CREATE OR REPLACE FUNCTION public.validate_positive_financial_amount()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.amount IS NULL OR NEW.amount <= 0 THEN
    RAISE EXCEPTION 'Financial amounts must be greater than zero' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_invoice_amount ON public.invoices;
CREATE TRIGGER validate_invoice_amount
BEFORE INSERT OR UPDATE OF amount ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.validate_positive_financial_amount();

DROP TRIGGER IF EXISTS validate_payment_amount ON public.payments;
CREATE TRIGGER validate_payment_amount
BEFORE INSERT OR UPDATE OF amount ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.validate_positive_financial_amount();

REVOKE ALL ON FUNCTION public.validate_positive_financial_amount() FROM PUBLIC, anon, authenticated;

COMMIT;
