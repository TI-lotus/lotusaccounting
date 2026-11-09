import { handleCors } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/responses.ts";
import { requireAuthContext, requireWorkspaceManager } from "../_shared/auth.ts";
import { createServiceClient } from "../_shared/supabase.ts";

Deno.serve(async (request) => {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;
  if (request.method !== "POST") return errorResponse("method_not_allowed", 405);
  try {
    const context = await requireAuthContext(request);
    requireWorkspaceManager(context);
    const body = (await request.json()) as { connectionId?: unknown };
    if (typeof body.connectionId !== "string") return errorResponse("connection_required", 400);

    const supabase = createServiceClient();
    const { data: connection, error: connectionError } = await supabase
      .from("integration_connections")
      .select("id, provider, config")
      .eq("id", body.connectionId)
      .eq("tenant_id", context.tenantId)
      .maybeSingle();
    if (connectionError) throw connectionError;
    if (!connection) return errorResponse("connection_not_found", 404);

    const { error: deleteError } = await supabase
      .from("integration_credentials")
      .delete()
      .eq("tenant_id", context.tenantId)
      .eq("connection_id", connection.id);
    if (deleteError) throw deleteError;

    const { error: updateError } = await supabase
      .from("integration_connections")
      .update({
        status: "disconnected",
        expires_at: null,
        credentials: [],
        config: { ...(connection.config ?? {}), secretFields: {} },
        updated_by: context.userId,
      })
      .eq("id", connection.id)
      .eq("tenant_id", context.tenantId);
    if (updateError) throw updateError;

    await supabase.from("activity_logs").insert({
      tenant_id: context.tenantId,
      user_id: context.userId,
      entity: "integration_connection",
      entity_id: connection.id,
      action: "credentials_revoked",
      metadata: { provider: connection.provider },
    });
    return jsonResponse({ revoked: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return errorResponse(message, message === "forbidden" ? 403 : 500);
  }
});
