CREATE OR REPLACE FUNCTION public.prevent_paid_invoice_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'paid' THEN
    RAISE EXCEPTION 'Paid invoices cannot be deleted.' USING ERRCODE = '23514';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS prevent_paid_invoice_delete ON public.invoices;
CREATE TRIGGER prevent_paid_invoice_delete
BEFORE DELETE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.prevent_paid_invoice_delete();

REVOKE ALL ON FUNCTION public.prevent_paid_invoice_delete() FROM PUBLIC, anon, authenticated;
