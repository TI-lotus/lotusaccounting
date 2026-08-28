import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { IntegrationError, IntegrationEvent } from "./types";

export const listIntegrationEvents = async (connectionId?: string) => {
  let query = supabase
    .from("integration_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (connectionId) query = query.eq("connection_id", connectionId);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as IntegrationEvent[];
};

export const listIntegrationErrors = async (connectionId?: string) => {
  let query = supabase
    .from("integration_errors")
    .select("*")
    .eq("resolved", false)
    .order("created_at", { ascending: false })
    .limit(50);

  if (connectionId) query = query.eq("connection_id", connectionId);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as IntegrationError[];
};

export const createIntegrationDomainEvent = async (params: {
  tenantId: string;
  eventType: string;
  source: string;
  entityType?: string | null;
  entityId?: string | null;
  payload?: Json;
}) => {
  const { data, error } = await supabase
    .from("domain_events")
    .insert({
      tenant_id: params.tenantId,
      event_type: params.eventType,
      source: params.source,
      entity_type: params.entityType ?? null,
      entity_id: params.entityId ?? null,
      payload: params.payload ?? {},
    })
    .select("*")
    .maybeSingle();

  if (error) throw error;
  return data;
};
