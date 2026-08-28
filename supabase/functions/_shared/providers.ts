import type { IntegrationProvider } from "./types.ts";

export type ProviderHealth = {
  ok: boolean;
  status: "connected" | "error" | "expired" | "disabled";
  message?: string;
  metadata?: Record<string, unknown>;
};

export type ProviderContext = {
  tenantId: string;
  connectionId: string;
  provider: IntegrationProvider;
};

export type IntegrationProviderAdapter = {
  provider: IntegrationProvider;
  testConnection: (context: ProviderContext) => Promise<ProviderHealth>;
  sync?: (context: ProviderContext, cursor?: string | null) => Promise<{
    cursor?: string | null;
    received: number;
    processed: number;
    failed: number;
    metadata?: Record<string, unknown>;
  }>;
  handleWebhook?: (
    context: ProviderContext,
    payload: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;
};

export type MessagingProviderAdapter = IntegrationProviderAdapter & {
  sendMessage?: (
    context: ProviderContext,
    params: { to: string; body: string; attachments?: string[] },
  ) => Promise<{ externalId?: string }>;
};

export type BankingProviderAdapter = IntegrationProviderAdapter & {
  importStatement?: (
    context: ProviderContext,
    params: { from: string; to: string; accountId?: string },
  ) => Promise<{ imported: number; cursor?: string | null }>;
};

export type GovernmentProviderAdapter = IntegrationProviderAdapter & {
  queryTaxpayer?: (
    context: ProviderContext,
    params: { cnpj: string },
  ) => Promise<Record<string, unknown>>;
};
