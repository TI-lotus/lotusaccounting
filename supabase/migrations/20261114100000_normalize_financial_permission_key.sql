BEGIN;

-- Older UI builds called this module "payments", while RLS has always used
-- the broader "financial" resource for payments, invoices and obligations.
-- Preserve existing values and remove the obsolete alias so the admin matrix
-- and database guards evaluate the same key.
UPDATE public.workspace_member_permissions
SET permissions = (permissions - 'payments') || jsonb_build_object('financial', permissions -> 'payments')
WHERE permissions ? 'payments'
  AND NOT (permissions ? 'financial');

UPDATE public.workspace_member_permissions
SET permissions = permissions - 'payments'
WHERE permissions ? 'payments'
  AND permissions ? 'financial';

COMMIT;
