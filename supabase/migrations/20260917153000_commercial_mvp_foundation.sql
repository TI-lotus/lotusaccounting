-- Commercial MVP foundation: SaaS billing, fiscal lookup cache and bank
-- reconciliation primitives. Provider secrets remain in integration_credentials.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.billing_plans (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  price_monthly_cents integer NOT NULL DEFAULT 0,
  max_clients integer,
  max_collaborators integer,
  integrations_enabled boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tenant_subscriptions (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_id text NOT NULL REFERENCES public.billing_plans(id),
  status text NOT NULL DEFAULT 'trialing'
    CHECK (status IN ('trialing', 'active', 'past_due', 'incomplete', 'canceled', 'manual')),
  external_provider text NOT NULL DEFAULT 'asaas',
  external_customer_id text,
  external_subscription_id text,
  external_checkout_id text,
  checkout_url text,
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  grace_until timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.billing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'asaas',
  external_event_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at timestamptz,
  error_message text,
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, external_event_id)
);

CREATE TABLE IF NOT EXISTS public.fiscal_cnpj_queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  cnpj text NOT NULL CHECK (cnpj ~ '^[0-9]{14}$'),
  provider text NOT NULL DEFAULT 'serpro',
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'failed')),
  normalized_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_response jsonb NOT NULL DEFAULT '{}'::jsonb,
  requested_by uuid,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fiscal_cnpj_queries_tenant_cnpj
  ON public.fiscal_cnpj_queries(tenant_id, cnpj, created_at DESC);

CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES public.integration_connections(id) ON DELETE SET NULL,
  provider text NOT NULL,
  account_number text NOT NULL,
  label text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'error')),
  last_synced_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider, account_number)
);

CREATE TABLE IF NOT EXISTS public.bank_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  bank_account_id uuid NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES public.integration_connections(id) ON DELETE SET NULL,
  provider text NOT NULL,
  external_id text NOT NULL,
  posted_at date NOT NULL,
  amount numeric(14,2) NOT NULL,
  direction text NOT NULL CHECK (direction IN ('income', 'expense')),
  description text,
  counterparty_name text,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  reconciled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider, external_id)
);

CREATE INDEX IF NOT EXISTS idx_bank_transactions_account_date
  ON public.bank_transactions(bank_account_id, posted_at DESC);

CREATE TABLE IF NOT EXISTS public.reconciliation_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  bank_transaction_id uuid NOT NULL REFERENCES public.bank_transactions(id) ON DELETE CASCADE,
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested', 'approved', 'rejected')),
  confidence numeric(5,2) NOT NULL DEFAULT 0,
  reason text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, bank_transaction_id, payment_id, invoice_id)
);

CREATE OR REPLACE FUNCTION public.touch_commercial_mvp_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_billing_plans_updated_at ON public.billing_plans;
CREATE TRIGGER touch_billing_plans_updated_at
BEFORE UPDATE ON public.billing_plans
FOR EACH ROW EXECUTE FUNCTION public.touch_commercial_mvp_updated_at();

DROP TRIGGER IF EXISTS touch_tenant_subscriptions_updated_at ON public.tenant_subscriptions;
CREATE TRIGGER touch_tenant_subscriptions_updated_at
BEFORE UPDATE ON public.tenant_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.touch_commercial_mvp_updated_at();

DROP TRIGGER IF EXISTS touch_bank_accounts_updated_at ON public.bank_accounts;
CREATE TRIGGER touch_bank_accounts_updated_at
BEFORE UPDATE ON public.bank_accounts
FOR EACH ROW EXECUTE FUNCTION public.touch_commercial_mvp_updated_at();

INSERT INTO public.billing_plans (
  id, name, description, price_monthly_cents, max_clients, max_collaborators, integrations_enabled, metadata
) VALUES
  ('starter', 'Starter', 'Operacao essencial para escritorios pequenos.', 59000, 30, 3, false, '{"support":"email","asaasBilling":true}'::jsonb),
  ('business', 'Business', 'Operacao completa com integracoes comerciais.', 129000, 150, 15, true, '{"support":"priority","asaasBilling":true,"interReconciliation":true,"serproCnpj":true}'::jsonb),
  ('enterprise', 'Enterprise', 'Plano negociado para operacoes maiores.', 0, null, null, true, '{"contactSales":true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly_cents = EXCLUDED.price_monthly_cents,
  max_clients = EXCLUDED.max_clients,
  max_collaborators = EXCLUDED.max_collaborators,
  integrations_enabled = EXCLUDED.integrations_enabled,
  metadata = EXCLUDED.metadata,
  active = true;

INSERT INTO public.tenant_subscriptions (tenant_id, plan_id, status, external_provider, trial_ends_at)
SELECT id, 'starter', 'trialing', 'asaas', now() + interval '14 days'
FROM public.tenants
ON CONFLICT (tenant_id) DO NOTHING;

ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_cnpj_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliation_matches ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.billing_plans TO authenticated;
GRANT SELECT ON public.tenant_subscriptions TO authenticated;
GRANT SELECT ON public.billing_events TO authenticated;
GRANT SELECT ON public.fiscal_cnpj_queries TO authenticated;
GRANT SELECT ON public.bank_accounts, public.bank_transactions, public.reconciliation_matches TO authenticated;
GRANT UPDATE ON public.reconciliation_matches TO authenticated;

DROP POLICY IF EXISTS billing_plans_read ON public.billing_plans;
CREATE POLICY billing_plans_read ON public.billing_plans
FOR SELECT TO authenticated USING (active);

DROP POLICY IF EXISTS tenant_subscriptions_read ON public.tenant_subscriptions;
CREATE POLICY tenant_subscriptions_read ON public.tenant_subscriptions
FOR SELECT TO authenticated USING (tenant_id = public.current_user_tenant_id());

DROP POLICY IF EXISTS tenant_subscriptions_admin_update ON public.tenant_subscriptions;
CREATE POLICY tenant_subscriptions_admin_update ON public.tenant_subscriptions
FOR UPDATE TO authenticated
USING (tenant_id = public.current_user_tenant_id() AND public.current_user_account_type() = 'admin')
WITH CHECK (tenant_id = public.current_user_tenant_id() AND public.current_user_account_type() = 'admin');

DROP POLICY IF EXISTS billing_events_read ON public.billing_events;
CREATE POLICY billing_events_read ON public.billing_events
FOR SELECT TO authenticated
USING (tenant_id = public.current_user_tenant_id() AND public.current_user_account_type() = 'admin');

DROP POLICY IF EXISTS fiscal_cnpj_queries_read ON public.fiscal_cnpj_queries;
CREATE POLICY fiscal_cnpj_queries_read ON public.fiscal_cnpj_queries
FOR SELECT TO authenticated
USING (tenant_id = public.current_user_tenant_id() AND public.can_manage_current_tenant());

DROP POLICY IF EXISTS bank_accounts_read ON public.bank_accounts;
CREATE POLICY bank_accounts_read ON public.bank_accounts
FOR SELECT TO authenticated
USING (tenant_id = public.current_user_tenant_id() AND public.has_workspace_permission('finance', 'read'));

DROP POLICY IF EXISTS bank_transactions_read ON public.bank_transactions;
CREATE POLICY bank_transactions_read ON public.bank_transactions
FOR SELECT TO authenticated
USING (tenant_id = public.current_user_tenant_id() AND public.has_workspace_permission('finance', 'read'));

DROP POLICY IF EXISTS reconciliation_matches_read ON public.reconciliation_matches;
CREATE POLICY reconciliation_matches_read ON public.reconciliation_matches
FOR SELECT TO authenticated
USING (tenant_id = public.current_user_tenant_id() AND public.has_workspace_permission('finance', 'read'));

DROP POLICY IF EXISTS reconciliation_matches_update ON public.reconciliation_matches;
CREATE POLICY reconciliation_matches_update ON public.reconciliation_matches
FOR UPDATE TO authenticated
USING (tenant_id = public.current_user_tenant_id() AND public.has_workspace_permission('finance', 'update'))
WITH CHECK (tenant_id = public.current_user_tenant_id() AND public.has_workspace_permission('finance', 'update'));

CREATE OR REPLACE FUNCTION public.apply_reconciliation_match(match_id uuid, approve boolean)
RETURNS public.reconciliation_matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  match_row public.reconciliation_matches;
BEGIN
  SELECT * INTO match_row
  FROM public.reconciliation_matches
  WHERE id = match_id
    AND tenant_id = public.current_user_tenant_id()
  FOR UPDATE;

  IF match_row.id IS NULL THEN
    RAISE EXCEPTION 'Match not found' USING ERRCODE = '02000';
  END IF;

  IF NOT public.has_workspace_permission('finance', 'update') THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  UPDATE public.reconciliation_matches
  SET status = CASE WHEN approve THEN 'approved' ELSE 'rejected' END,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  WHERE id = match_id
  RETURNING * INTO match_row;

  IF approve THEN
    UPDATE public.bank_transactions
    SET reconciled_at = now()
    WHERE id = match_row.bank_transaction_id;

    IF match_row.payment_id IS NOT NULL THEN
      UPDATE public.payments
      SET reconciled_at = now(),
          reconciled_by = auth.uid()
      WHERE id = match_row.payment_id
        AND tenant_id = match_row.tenant_id;
    END IF;
  END IF;

  RETURN match_row;
END;
$$;

REVOKE ALL ON FUNCTION public.touch_commercial_mvp_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_reconciliation_match(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_reconciliation_match(uuid, boolean) TO authenticated;
