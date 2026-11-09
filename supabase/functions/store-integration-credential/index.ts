import { handleCors } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/responses.ts";
import { requireAuthContext, requireWorkspaceManager } from "../_shared/auth.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import { upsertCredential } from "../_shared/credentials.ts";

type Body = {
  provider?: string;
  integrationId?: string;
  connectionId?: string | null;
  accountLabel?: string | null;
  accountName?: string | null;
  publicFields?: Record<string, unknown>;
  secretFields?: Record<string, unknown>;
  scopes?: string[];
  expiresAt?: string | null;
};

const hasSecret = (value: Record<string, unknown> | undefined) =>
  Boolean(
    value &&
      Object.values(value).some((entry) => String(entry ?? "").trim().length),
  );

Deno.serve(async (request) => {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;
  if (request.method !== "POST") return errorResponse("method_not_allowed", 405);

  try {
    const context = await requireAuthContext(request);
    requireWorkspaceManager(context);

    const body = (await request.json()) as Body;
    const provider = body.provider ?? body.integrationId;
    if (!provider) return errorResponse("provider_required", 400);
    if (!hasSecret(body.secretFields)) {
      return errorResponse("secret_fields_required", 400);
    }

    const supabase = createServiceClient();
    if (body.connectionId) {
      const { data: existing, error } = await supabase.from("integration_connections")
        .select("id").eq("id", body.connectionId).eq("tenant_id", context.tenantId).maybeSingle();
      if (error) throw error;
      if (!existing) return errorResponse("connection_not_found", 404);
    }
    const { data: connection, error: connectionError } = await supabase
      .from("integration_connections")
      .upsert(
        {
          id: body.connectionId ?? undefined,
          tenant_id: context.tenantId,
          integration_id: body.integrationId ?? provider,
          provider,
          account_label: body.accountLabel ?? provider,
          provider_account_name: body.accountName ?? body.accountLabel ?? null,
          status: "pending",
          config: {
            fields: body.publicFields ?? {},
            secretFields: Object.fromEntries(
              Object.keys(body.secretFields ?? {}).map((key) => [
                key,
                {
                  configured: true,
                  updatedAt: new Date().toISOString(),
                  storedBy: "edge-function",
                },
              ]),
            ),
          },
          credentials: [
            {
              id: crypto.randomUUID(),
              name: body.accountName ?? "Credencial principal",
              keyHint: "secret_••••",
              createdAt: new Date().toLocaleDateString("pt-BR"),
              lastUsed: "Nunca",
              active: true,
              storedBy: "edge-function",
            },
          ],
          scopes: body.scopes ?? [],
          expires_at: body.expiresAt ?? null,
          updated_by: context.userId,
          created_by: context.userId,
        },
        { onConflict: "tenant_id,integration_id" },
      )
      .select("*")
      .maybeSingle();

    if (connectionError) throw connectionError;
    if (!connection) return errorResponse("connection_not_created", 500);

    const credential = await upsertCredential({
      tenantId: context.tenantId,
      connectionId: connection.id,
      provider,
      secretType: "config",
      secretPayload: body.secretFields ?? {},
      expiresAt: body.expiresAt ?? null,
    });

    await supabase
      .from("activity_logs")
      .insert({
        tenant_id: context.tenantId,
        user_id: context.userId,
        entity: "integration_connection",
        entity_id: connection.id,
        action: "credential_upserted",
        metadata: {
          provider,
          secretType: credential?.secret_type,
          fields: Object.keys(body.secretFields ?? {}),
        },
      });

    return jsonResponse({
      connection,
      credential: {
        id: credential?.id,
        provider: credential?.provider,
        secretType: credential?.secret_type,
        expiresAt: credential?.expires_at,
        rotatedAt: credential?.rotated_at,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    const status = message === "forbidden" ? 403 : 401;
    return errorResponse(message, status, message);
  }
});
