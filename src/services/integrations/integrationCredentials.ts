import { supabase } from "@/integrations/supabase/client";
import type { IntegrationConnection } from "./types";

export const storeIntegrationCredential = async (params: {
  provider: string;
  integrationId: string;
  connectionId?: string | null;
  accountLabel?: string | null;
  accountName?: string | null;
  publicFields: Record<string, string>;
  secretFields: Record<string, string>;
  scopes?: string[];
  expiresAt?: string | null;
}) => {
  const { data, error } = await supabase.functions.invoke<{
    connection: IntegrationConnection;
    credential: {
      id: string;
      provider: string;
      secretType: string;
      expiresAt: string | null;
      rotatedAt: string | null;
    };
  }>("store-integration-credential", {
    body: params,
  });

  if (error) throw error;
  return data;
};

export const revokeIntegrationCredentials = async (connectionId: string) => {
  const { data, error } = await supabase.functions.invoke<{ revoked: boolean }>(
    "revoke-integration-credentials",
    { body: { connectionId } },
  );
  if (error) throw error;
  return data;
};
