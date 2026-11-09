import { supabase } from "@/integrations/supabase/client";

export type BillingPlan = {
  id: string;
  name: string;
  description: string | null;
  price_monthly_cents: number;
  max_clients: number | null;
  max_collaborators: number | null;
  integrations_enabled: boolean;
};

export type TenantSubscription = {
  tenant_id: string;
  plan_id: string;
  status: "trialing" | "active" | "past_due" | "incomplete" | "canceled" | "manual";
  checkout_url: string | null;
  current_period_end: string | null;
  trial_ends_at: string | null;
  grace_until: string | null;
};

export type SerproCnpjData = {
  cnpj: string;
  razao_social?: string | null;
  nome_fantasia?: string | null;
  situacao_cadastral?: string | null;
  data_abertura?: string | null;
  municipio?: string | null;
  uf?: string | null;
  cnae_principal?: unknown;
  rawProvider: "serpro";
};

export type BankAccount = {
  id: string;
  provider: string;
  account_number: string;
  label: string | null;
  status: "active" | "disabled" | "error";
  last_synced_at: string | null;
};

export type BankTransaction = {
  id: string;
  bank_account_id: string;
  posted_at: string;
  amount: number;
  direction: "income" | "expense";
  description: string | null;
  counterparty_name: string | null;
  reconciled_at: string | null;
};

export type ReconciliationMatch = {
  id: string;
  bank_transaction_id: string;
  payment_id: string | null;
  invoice_id: string | null;
  status: "suggested" | "approved" | "rejected";
  confidence: number;
  reason: string | null;
};

type QueryResult = { data: unknown; error: unknown };
type QueryBuilder = PromiseLike<QueryResult> & {
  select: (columns?: string) => QueryBuilder;
  eq: (column: string, value: unknown) => QueryBuilder;
  order: (column: string, options?: { ascending?: boolean }) => QueryBuilder;
  limit: (count: number) => QueryBuilder;
  maybeSingle: () => Promise<QueryResult>;
};

const db = supabase as unknown as {
  from: (table: string) => QueryBuilder;
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
};

export const listBillingPlans = async () => {
  const { data, error } = await db
    .from("billing_plans")
    .select("*")
    .eq("active", true)
    .order("price_monthly_cents", { ascending: true });
  if (error) throw error;
  return (data ?? []) as BillingPlan[];
};

export const getTenantSubscription = async () => {
  const { data, error } = await db
    .from("tenant_subscriptions")
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as TenantSubscription | null;
};

export const createBillingCheckout = async (planId: string) => {
  const { data, error } = await supabase.functions.invoke("create-billing-checkout", {
    body: { planId },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error.message ?? "Falha ao criar checkout.");
  return data as { checkoutUrl: string; checkoutId?: string | null };
};

export const querySerproCnpj = async (cnpj: string) => {
  const { data, error } = await supabase.functions.invoke("serpro-query-cnpj", {
    body: { cnpj },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error.message ?? "Falha ao consultar CNPJ.");
  return data.data as SerproCnpjData;
};

export const listBankAccounts = async () => {
  const { data, error } = await db
    .from("bank_accounts")
    .select("*")
    .order("last_synced_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as BankAccount[];
};

export const listBankTransactions = async () => {
  const { data, error } = await db
    .from("bank_transactions")
    .select("*")
    .order("posted_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as BankTransaction[];
};

export const listReconciliationMatches = async () => {
  const { data, error } = await db
    .from("reconciliation_matches")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as ReconciliationMatch[];
};

export const applyReconciliationMatch = async (matchId: string, approve: boolean) => {
  const { data, error } = await db.rpc("apply_reconciliation_match", {
    match_id: matchId,
    approve,
  });
  if (error) throw error;
  return data as ReconciliationMatch;
};

export const enqueueStatementImport = async (connectionId: string, from: string, to: string) => {
  const { data, error } = await supabase.functions.invoke("enqueue-integration-job", {
    body: { connectionId, jobType: "statement_import", from, to },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error.message ?? "Falha ao enfileirar importação.");
  return data;
};
