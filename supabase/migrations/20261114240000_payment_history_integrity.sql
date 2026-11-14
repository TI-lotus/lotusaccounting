BEGIN;

CREATE OR REPLACE FUNCTION public.prevent_completed_payment_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.reconciled_at IS NOT NULL THEN
    RAISE EXCEPTION 'Reconciled payments cannot be deleted; cancel the payment instead' USING ERRCODE = '23514';
  END IF;
  IF OLD.status IN ('completed', 'paid') THEN
    RAISE EXCEPTION 'Completed payments cannot be deleted; cancel the payment instead' USING ERRCODE = '23514';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS prevent_completed_payment_delete ON public.payments;
CREATE TRIGGER prevent_completed_payment_delete
BEFORE DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.prevent_completed_payment_delete();

REVOKE ALL ON FUNCTION public.prevent_completed_payment_delete() FROM PUBLIC, anon, authenticated;

COMMIT;
