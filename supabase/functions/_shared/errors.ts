import { createServiceClient } from "./supabase.ts";

const SENSITIVE_KEYS = [
  "access_token",
  "refresh_token",
  "authorization",
  "password",
  "secret",
  "client_secret",
  "certificate",
  "certificado",
  "private_key",
];

export const sanitizePayload = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sanitizePayload);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      SENSITIVE_KEYS.some((sensitive) =>
        key.toLowerCase().includes(sensitive),
      )
        ? "[redacted]"
        : sanitizePayload(entry),
    ]),
  );
};

export const logIntegrationError = async (params: {
  tenantId: string;
  connectionId?: string | null;
  provider: string;
  source: string;
  operation: string;
  error: unknown;
  retryable?: boolean;
  attemptNumber?: number;
  context?: Record<string, unknown>;
}) => {
  const supabase = createServiceClient();
  const message =
    params.error instanceof Error
      ? params.error.message
      : typeof params.error === "string"
        ? params.error
        : "Erro desconhecido";

  const { data, error } = await supabase
    .from("integration_errors")
    .insert({
      tenant_id: params.tenantId,
      connection_id: params.connectionId ?? null,
      provider: params.provider,
      source: params.source,
      operation: params.operation,
      error_code: params.error instanceof Error ? params.error.name : null,
      error_message: message.slice(0, 1000),
      retryable: params.retryable ?? false,
      attempt_number: params.attemptNumber ?? 1,
      context: sanitizePayload(params.context ?? {}) as Record<string, unknown>,
    })
    .select("*")
    .maybeSingle();

  if (error) throw error;
  return data;
};
