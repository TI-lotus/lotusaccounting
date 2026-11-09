CREATE OR REPLACE FUNCTION public.prevent_reconciled_payment_status_changes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.reconciled_at IS NOT NULL
    AND (
      NEW.status IS DISTINCT FROM OLD.status
      OR NEW.paid_at IS DISTINCT FROM OLD.paid_at
    ) THEN
    RAISE EXCEPTION 'Reconciled payments cannot have status or paid_at changed manually.' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_reconciled_payment_status_changes ON public.payments;
CREATE TRIGGER prevent_reconciled_payment_status_changes
BEFORE UPDATE OF status, paid_at ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.prevent_reconciled_payment_status_changes();

REVOKE ALL ON FUNCTION public.prevent_reconciled_payment_status_changes() FROM PUBLIC, anon, authenticated;
