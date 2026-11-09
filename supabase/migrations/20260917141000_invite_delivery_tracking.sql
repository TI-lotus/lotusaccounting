BEGIN;

ALTER TABLE public.invites
  ADD COLUMN IF NOT EXISTS delivery_status text NOT NULL DEFAULT 'not_requested'
    CHECK (delivery_status IN ('not_requested', 'sent', 'failed', 'not_configured')),
  ADD COLUMN IF NOT EXISTS delivery_error text,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_invites_tenant_delivery_status
ON public.invites (tenant_id, delivery_status, created_at DESC);

COMMIT;
