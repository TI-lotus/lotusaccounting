import { createServiceClient } from "./supabase.ts";

export const loadConnection = async (
  tenantId: string,
  provider: string,
  connectionId?: string,
) => {
  const supabase = createServiceClient();
  let query = supabase
    .from("integration_connections")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("provider", provider);

  if (connectionId) query = query.eq("id", connectionId);

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
};

export const updateConnectionHealth = async (
  connectionId: string,
  updates: {
    status?: string;
    last_sync_at?: string | null;
    last_error_at?: string | null;
    metadata?: Record<string, unknown>;
  },
) => {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("integration_connections")
    .update(updates)
    .eq("id", connectionId)
    .select("*")
    .maybeSingle();

  if (error) throw error;
  return data;
};
