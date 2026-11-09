import { createServiceClient } from "./supabase.ts";
import { decryptSecretPayload, encryptSecretPayload } from "./secret-crypto.ts";

export const loadCredential = async (
  tenantId: string,
  connectionId: string,
  secretType: string,
) => {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("integration_credentials")
    .select("id, provider, secret_type, secret_payload, expires_at")
    .eq("tenant_id", tenantId)
    .eq("connection_id", connectionId)
    .eq("secret_type", secretType)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return { ...data, secret_payload: await decryptSecretPayload(data.secret_payload) };
};

export const upsertCredential = async (params: {
  tenantId: string;
  connectionId: string;
  provider: string;
  secretType: string;
  secretPayload: Record<string, unknown>;
  expiresAt?: string | null;
}) => {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("integration_credentials")
    .upsert(
      {
        tenant_id: params.tenantId,
        connection_id: params.connectionId,
        provider: params.provider,
        secret_type: params.secretType,
        secret_payload: await encryptSecretPayload(params.secretPayload),
        expires_at: params.expiresAt ?? null,
        rotated_at: new Date().toISOString(),
      },
      { onConflict: "connection_id,secret_type" },
    )
    .select("id, provider, secret_type, expires_at, rotated_at")
    .maybeSingle();

  if (error) throw error;
  return data;
};
