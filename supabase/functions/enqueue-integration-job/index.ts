import { handleCors } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/responses.ts";
import { requireAuthContext, requireWorkspaceManager } from "../_shared/auth.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import { enqueueIntegrationJob } from "../_shared/jobs.ts";

Deno.serve(async (request) => {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;
  if (request.method !== "POST") return errorResponse("method_not_allowed", 405);
  try {
    const context = await requireAuthContext(request);
    requireWorkspaceManager(context);
    const body = await request.json();
    const jobType = typeof body.jobType === "string" ? body.jobType : "health_check";
    const allowedJobTypes = new Set(["health_check", "sync", "statement_import", "cnpj_lookup"]);
    if (!allowedJobTypes.has(jobType)) return errorResponse("job_type_not_allowed", 400);
    if (jobType !== "cnpj_lookup" && typeof body.connectionId !== "string") {
      return errorResponse("connection_required", 400);
    }
    if (jobType === "cnpj_lookup") {
      const cnpj = typeof body.cnpj === "string" ? body.cnpj.replace(/\D/g, "") : "";
      if (cnpj.length !== 14) return errorResponse("cnpj_invalid", 400);
      const job = await enqueueIntegrationJob({
        tenantId: context.tenantId,
        jobType,
        payload: { provider: "serpro", cnpj },
        priority: 20,
        idempotencyKey: `serpro:${context.tenantId}:${cnpj}:${new Date().toISOString().slice(0, 10)}`,
      });
      return jsonResponse({ job });
    }
    const { data: connection, error } = await createServiceClient()
      .from("integration_connections").select("id, provider")
      .eq("id", body.connectionId).eq("tenant_id", context.tenantId).maybeSingle();
    if (error) throw error;
    if (!connection) return errorResponse("connection_not_found", 404);
    const job = await enqueueIntegrationJob({
      tenantId: context.tenantId, connectionId: connection.id,
      jobType,
      payload: {
        provider: connection.provider,
        from: typeof body.from === "string" ? body.from : undefined,
        to: typeof body.to === "string" ? body.to : undefined,
      },
      priority: jobType === "health_check" ? 10 : 30,
      idempotencyKey: body.idempotencyKey ?? null,
    });
    return jsonResponse({ job });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return errorResponse(message, message === "forbidden" ? 403 : 400);
  }
});
