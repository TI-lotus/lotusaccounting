BEGIN;

-- Older versions of the client form created otherwise complete companies as
-- pending. New clients are active by default, so make the historical records
-- available to the active-only selectors as well.
UPDATE public.companies
SET status = 'active'
WHERE status = 'pending';

COMMIT;
