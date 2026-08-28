import { createServiceClient } from "./supabase.ts";

export const createIntegrationEvent = async (params: {
  tenantId: string;
  connectionId?: string | null;
  provider: string;
  eventType: string;
  externalEventId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  payload?: Record<string, unknown>;
  normalizedPayload?: Record<string, unknown>;
}) => {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("integration_events")
    .insert({
      tenant_id: params.tenantId,
      connection_id: params.connectionId ?? null,
      provider: params.provider,
      event_type: params.eventType,
      external_event_id: params.externalEventId ?? null,
      entity_type: params.entityType ?? null,
      entity_id: params.entityId ?? null,
      payload: params.payload ?? {},
      normalized_payload: params.normalizedPayload ?? {},
    })
    .select("*")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") return { data: null, duplicate: true };
    throw error;
  }
  return { data, duplicate: false };
};

export const markIntegrationEventProcessed = async (
  eventId: string,
  status: "processed" | "failed" | "ignored",
  error?: { code?: string; message?: string },
) => {
  const supabase = createServiceClient();
  const { data, error: updateError } = await supabase
    .from("integration_events")
    .update({
      status,
      processed_at: new Date().toISOString(),
      error_code: error?.code ?? null,
      error_message: error?.message?.slice(0, 1000) ?? null,
    })
    .eq("id", eventId)
    .select("*")
    .maybeSingle();

  if (updateError) throw updateError;
  return data;
};

export const createDomainEvent = async (params: {
  tenantId: string;
  eventType: string;
  entityType?: string | null;
  entityId?: string | null;
  payload?: Record<string, unknown>;
}) => {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("domain_events")
    .insert({
      tenant_id: params.tenantId,
      event_type: params.eventType,
      entity_type: params.entityType ?? null,
      entity_id: params.entityId ?? null,
      payload: params.payload ?? {},
    })
    .select("*")
    .maybeSingle();

  if (error) throw error;
  return data;
};
