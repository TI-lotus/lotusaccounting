-- Lotus commercial pricing: keep database checkout values aligned with the UI.
UPDATE public.billing_plans
SET price_monthly_cents = 22000,
    updated_at = now()
WHERE id = 'starter';

UPDATE public.billing_plans
SET price_monthly_cents = 45000,
    updated_at = now()
WHERE id = 'business';

UPDATE public.billing_plans
SET price_monthly_cents = 63000,
    updated_at = now()
WHERE id = 'enterprise';
