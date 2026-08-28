import { supabase } from "@/integrations/supabase/client";
import type {
  IntegrationConnection,
  IntegrationConnectionUpdate,
} from "./types";
export {
  buildPublicCredentialMetadata,
  getConnectionHealthLabel,
  maskCredentialKey,
  readCredentialMetadata,
} from "./utils";

export const listIntegrationConnections = async () => {
  const { data, error } = await supabase
    .from("integration_connections")
    .select("*")
    .order("provider", { ascending: true });

  if (error) throw error;
  return (data ?? []) as IntegrationConnection[];
};

export const upsertIntegrationConnectionRecord = async (params: {
  tenantId: string;
  integrationId: string;
  updates: IntegrationConnectionUpdate;
  userId?: string | null;
}) => {
  const { data, error } = await supabase
    .from("integration_connections")
    .upsert(
      {
        tenant_id: params.tenantId,
        integration_id: params.integrationId,
        provider: params.updates.provider ?? params.integrationId,
        ...params.updates,
        updated_by: params.userId ?? null,
      },
      { onConflict: "tenant_id,integration_id" },
    )
    .select("*")
    .maybeSingle();

  if (error) throw error;
  return data as IntegrationConnection | null;
};
