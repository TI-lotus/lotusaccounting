import { loadCredential } from "./credentials.ts";
import { createServiceClient } from "./supabase.ts";

type JobRow = {
  id: string;
  tenant_id: string;
  connection_id: string | null;
  job_type: string;
  payload: Record<string, unknown> | null;
};

type ConnectionRow = {
  id: string;
  tenant_id: string;
  provider: string;
  integration_id: string | null;
  account_label: string | null;
  provider_account_id: string | null;
  config: Record<string, unknown> | null;
};

type AdapterResult = {
  message: string;
  metadata?: Record<string, unknown>;
};

const asString = (value: unknown) => typeof value === "string" ? value : null;

const today = () => new Date().toISOString().slice(0, 10);

const addDays = (date: Date, days: number) => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy.toISOString().slice(0, 10);
};

const loadConnection = async (job: JobRow) => {
  if (!job.connection_id) throw new Error("connection_required");
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("integration_connections")
    .select("id, tenant_id, provider, integration_id, account_label, provider_account_id, config")
    .eq("tenant_id", job.tenant_id)
    .eq("id", job.connection_id)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("connection_not_found");
  return data as ConnectionRow;
};

const loadProviderSecret = async (tenantId: string, connectionId: string) =>
  (await loadCredential(tenantId, connectionId, "api_credentials")) ??
  (await loadCredential(tenantId, connectionId, "config"));

const updateConnectionHealth = async (
  connection: ConnectionRow,
  status: "connected" | "error" | "expired",
  message?: string,
  metadata?: Record<string, unknown>,
) => {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("integration_connections")
    .update({
      status,
      last_sync_at: status === "connected" ? new Date().toISOString() : undefined,
      last_error_at: status === "connected" ? null : new Date().toISOString(),
      last_error: status === "connected" ? null : (message ?? "provider_error"),
      config: { ...(connection.config ?? {}), lastHealth: metadata ?? {} },
    })
    .eq("id", connection.id)
    .eq("tenant_id", connection.tenant_id);
  if (error) throw error;
};

const fetchJson = async (
  url: string,
  init: RequestInit & { client?: Deno.HttpClient } = {},
) => {
  const response = await fetch(url, init);
  const text = await response.text();
  let body: Record<string, unknown> = {};
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }
  }
  if (!response.ok) {
    const message = asString(body.message) ?? asString(body.error_description) ?? asString(body.error) ?? `http_${response.status}`;
    throw new Error(message);
  }
  return body;
};

const normalizeInterTransaction = (
  tenantId: string,
  accountId: string,
  connectionId: string,
  item: Record<string, unknown>,
) => {
  const amount = Number(item.valor ?? item.amount ?? item.value ?? 0);
  const externalId = asString(item.id) ??
    asString(item.codigoTransacao) ??
    asString(item.transactionId) ??
    `${item.dataEntrada ?? item.dataLancamento ?? today()}-${amount}-${item.descricao ?? ""}`;
  const postedAt = asString(item.dataEntrada) ?? asString(item.dataLancamento) ?? asString(item.date) ?? today();
  return {
    tenant_id: tenantId,
    bank_account_id: accountId,
    connection_id: connectionId,
    provider: "inter",
    external_id: externalId,
    posted_at: postedAt.slice(0, 10),
    amount: Math.abs(amount),
    direction: amount >= 0 ? "income" : "expense",
    description: asString(item.descricao) ?? asString(item.description) ?? "Lancamento Banco Inter",
    counterparty_name: asString(item.nomePagador) ?? asString(item.counterpartyName),
    raw_payload: item,
  };
};

const suggestMatches = async (tenantId: string, transactionIds: string[]) => {
  if (!transactionIds.length) return 0;
  const supabase = createServiceClient();
  let created = 0;

  for (const transactionId of transactionIds) {
    const { data: transaction, error: transactionError } = await supabase
      .from("bank_transactions")
      .select("*")
      .eq("id", transactionId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (transactionError) throw transactionError;
    if (!transaction) continue;

    const start = addDays(new Date(`${transaction.posted_at}T00:00:00Z`), -3);
    const end = addDays(new Date(`${transaction.posted_at}T00:00:00Z`), 3);
    const { data: payments, error: paymentsError } = await supabase
      .from("payments")
      .select("id, invoice_id, amount, paid_at, due_date, description")
      .eq("tenant_id", tenantId)
      .is("reconciled_at", null)
      .gte("due_date", start)
      .lte("due_date", end)
      .limit(20);
    if (paymentsError) throw paymentsError;

    const match = (payments ?? []).find((payment) =>
      Number(payment.amount).toFixed(2) === Number(transaction.amount).toFixed(2)
    );
    if (!match) continue;

    const { error } = await supabase.from("reconciliation_matches").upsert(
      {
        tenant_id: tenantId,
        bank_transaction_id: transaction.id,
        payment_id: match.id,
        invoice_id: match.invoice_id,
        status: "suggested",
        confidence: 92,
        reason: "Valor exato e vencimento dentro de uma janela de 3 dias.",
      },
      { onConflict: "tenant_id,bank_transaction_id,payment_id,invoice_id" },
    );
    if (error) throw error;
    created += 1;
  }

  return created;
};

const runInterJob = async (job: JobRow): Promise<AdapterResult> => {
  const connection = await loadConnection(job);
  const credential = await loadProviderSecret(job.tenant_id, connection.id);
  const secret = credential?.secret_payload ?? {};
  const clientId = asString(secret.client_id);
  const clientSecret = asString(secret.client_secret);
  const cert = asString(secret.certificate_pem);
  const key = asString(secret.private_key_pem);
  const accountNumber = asString(secret.account_number) ?? asString(secret.conta_corrente) ?? connection.provider_account_id ?? "default";
  if (!clientId || !clientSecret) throw new Error("inter_credentials_missing");

  const baseUrl = asString(secret.base_url) ?? Deno.env.get("INTER_BASE_URL") ?? "https://cdpj.partners.bancointer.com.br";
  const scope = asString(secret.scope) ?? "extrato.read saldo.read";
  const client = cert && key ? Deno.createHttpClient({ cert, key }) : undefined;
  const tokenBody = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope,
  });
  const token = await fetchJson(`${baseUrl}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenBody,
    client,
  });
  const accessToken = asString(token.access_token);
  if (!accessToken) throw new Error("inter_token_missing");

  if (job.job_type === "health_check") {
    await updateConnectionHealth(connection, "connected", undefined, { checkedAt: new Date().toISOString(), scope });
    return { message: "Banco Inter conectado", metadata: { scope } };
  }

  if (job.job_type !== "statement_import" && job.job_type !== "sync") {
    throw new Error(`unsupported_inter_job_${job.job_type}`);
  }

  const payload = job.payload ?? {};
  const from = asString(payload.from) ?? addDays(new Date(), -7);
  const to = asString(payload.to) ?? today();
  const path = asString(secret.statement_path) ?? `/banking/v2/extrato?dataInicio=${from}&dataFim=${to}`;
  const statement = await fetchJson(`${baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    client,
  });
  const items = Array.isArray(statement.transacoes)
    ? statement.transacoes
    : Array.isArray(statement.transactions)
      ? statement.transactions
      : Array.isArray(statement.data)
        ? statement.data
        : [];

  const supabase = createServiceClient();
  const { data: account, error: accountError } = await supabase
    .from("bank_accounts")
    .upsert(
      {
        tenant_id: job.tenant_id,
        connection_id: connection.id,
        provider: "inter",
        account_number: accountNumber,
        label: connection.account_label ?? "Banco Inter",
        status: "active",
        last_synced_at: new Date().toISOString(),
        metadata: { scope },
      },
      { onConflict: "tenant_id,provider,account_number" },
    )
    .select("*")
    .maybeSingle();
  if (accountError) throw accountError;
  if (!account) throw new Error("bank_account_not_created");

  const transactionRows = (items as Record<string, unknown>[]).map((item) =>
    normalizeInterTransaction(job.tenant_id, account.id, connection.id, item)
  );
  let imported = 0;
  const insertedIds: string[] = [];
  for (const row of transactionRows) {
    const { data, error } = await supabase
      .from("bank_transactions")
      .upsert(row, { onConflict: "tenant_id,provider,external_id" })
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (data?.id) {
      imported += 1;
      insertedIds.push(data.id);
    }
  }

  const suggestions = await suggestMatches(job.tenant_id, insertedIds);
  await updateConnectionHealth(connection, "connected", undefined, { imported, suggestions, from, to });
  return { message: "Extrato Banco Inter importado", metadata: { imported, suggestions, from, to } };
};

const runSerproJob = async (job: JobRow): Promise<AdapterResult> => {
  const cnpj = asString(job.payload?.cnpj)?.replace(/\D/g, "");
  if (!cnpj || cnpj.length !== 14) throw new Error("cnpj_invalid");
  const response = await querySerproCnpj(job.tenant_id, cnpj, null);
  return { message: "CNPJ consultado no SERPRO", metadata: response };
};

export const querySerproCnpj = async (
  tenantId: string,
  cnpj: string,
  requestedBy: string | null,
) => {
  const token = Deno.env.get("SERPRO_ACCESS_TOKEN");
  const baseUrl = Deno.env.get("SERPRO_CNPJ_BASE_URL") ?? "https://gateway.apiserpro.serpro.gov.br/consulta-cnpj-df/v2";
  if (!token) throw new Error("serpro_token_missing");

  try {
    const raw = await fetchJson(`${baseUrl}/empresa/${cnpj}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    const normalized = {
      cnpj,
      razao_social: asString(raw.nomeEmpresarial) ?? asString(raw.razao_social) ?? asString(raw.nome),
      nome_fantasia: asString(raw.nomeFantasia) ?? asString(raw.nome_fantasia),
      situacao_cadastral: asString(raw.situacaoCadastral) ?? asString(raw.situacao_cadastral),
      data_abertura: asString(raw.dataAbertura) ?? asString(raw.data_abertura),
      municipio: asString(raw.municipio),
      uf: asString(raw.uf),
      cnae_principal: raw.cnaePrincipal ?? raw.atividade_principal ?? null,
      rawProvider: "serpro",
    };

    const supabase = createServiceClient();
    const { error } = await supabase.from("fiscal_cnpj_queries").insert({
      tenant_id: tenantId,
      cnpj,
      provider: "serpro",
      status: "completed",
      normalized_data: normalized,
      raw_response: raw,
      requested_by: requestedBy,
    });
    if (error) throw error;
    return normalized;
  } catch (error) {
    const supabase = createServiceClient();
    await supabase.from("fiscal_cnpj_queries").insert({
      tenant_id: tenantId,
      cnpj,
      provider: "serpro",
      status: "failed",
      error_message: error instanceof Error ? error.message : "serpro_query_failed",
      requested_by: requestedBy,
    });
    throw error;
  }
};

export const runProviderJob = async (job: JobRow): Promise<AdapterResult> => {
  const connection = job.connection_id ? await loadConnection(job) : null;
  const provider = connection?.provider ?? asString(job.payload?.provider);
  if (provider === "inter") return runInterJob(job);
  if (provider === "serpro") return runSerproJob(job);
  throw new Error(`adapter_not_configured:${provider ?? job.job_type}`);
};
