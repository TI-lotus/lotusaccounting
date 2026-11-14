import { handleCors } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/responses.ts";
import { requireAuthContext, requireWorkspacePermission } from "../_shared/auth.ts";
import { querySerproCnpj } from "../_shared/provider-registry.ts";

Deno.serve(async (request) => {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;
  if (request.method !== "POST") return errorResponse("method_not_allowed", 405);

  try {
    const context = await requireAuthContext(request);
    await requireWorkspacePermission(context, "integrations", "read");
    const body = await request.json();
    const cnpj = typeof body.cnpj === "string" ? body.cnpj.replace(/\D/g, "") : "";
    if (cnpj.length !== 14) return errorResponse("cnpj_invalid", 400);

    const data = await querySerproCnpj(context.tenantId, cnpj, context.userId);
    return jsonResponse({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return errorResponse(message, message === "forbidden" ? 403 : 400);
  }
});
