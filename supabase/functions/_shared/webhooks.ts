import { createServiceClient } from "./supabase.ts";

const SENSITIVE_HEADER_KEYS = [
  "authorization",
  "cookie",
  "x-api-key",
  "x-hub-signature",
  "x-hub-signature-256",
  "x-signature",
];

export const sanitizeHeaders = (headers: Headers) => {
  const entries = Array.from(headers.entries()).map(([key, value]) => [
    key,
    SENSITIVE_HEADER_KEYS.includes(key.toLowerCase()) ? "[redacted]" : value,
  ]);

  return Object.fromEntries(entries);
};

export const recordWebhookEvent = async (params: {
  tenantId?: string | null;
  connectionId?: string | null;
  provider: string;
  externalEventId?: string | null;
  headers: Headers;
  payload: Record<string, unknown>;
  signatureValid?: boolean;
}) => {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("integration_webhook_events")
    .insert({
      tenant_id: params.tenantId ?? null,
      connection_id: params.connectionId ?? null,
      provider: params.provider,
      external_event_id: params.externalEventId ?? null,
      headers: sanitizeHeaders(params.headers),
      payload: params.payload,
      signature_valid: params.signatureValid ?? false,
      status: params.signatureValid === false ? "failed" : "received",
    })
    .select("*")
    .maybeSingle();

  if (error?.code === "23505") {
    return { data: null, duplicate: true };
  }
  if (error) throw error;
  return { data, duplicate: false };
};
