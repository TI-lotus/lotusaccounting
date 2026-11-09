import { handleCors } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/responses.ts";
import { requireAuthContext, requireWorkspaceManager } from "../_shared/auth.ts";
import { requireScheduler } from "../_shared/scheduler.ts";
import {
  claimNextIntegrationJob,
  completeIntegrationJob,
  failIntegrationJob,
} from "../_shared/jobs.ts";
import { runProviderJob } from "../_shared/provider-registry.ts";

Deno.serve(async (request) => {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;
  if (request.method !== "POST") return errorResponse("method_not_allowed", 405);

  try {
    let tenantId: string;
    let workerId: string;
    if (request.headers.has("x-lotus-scheduler-key")) {
      requireScheduler(request);
      const body = (await request.json()) as { tenantId?: unknown };
      if (typeof body.tenantId !== "string") return errorResponse("tenant_required", 400);
      tenantId = body.tenantId;
      workerId = `scheduler-${crypto.randomUUID()}`;
    } else {
      const context = await requireAuthContext(request);
      requireWorkspaceManager(context);
      tenantId = context.tenantId;
      workerId = `manual-${context.userId}`;
    }

    const job = await claimNextIntegrationJob(workerId, tenantId);
    if (!job) return jsonResponse({ claimed: false });

    try {
      const result = await runProviderJob(job);
      await completeIntegrationJob(job.id);
      return jsonResponse({
        claimed: true,
        completed: true,
        jobId: job.id,
        result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro interno";
      await failIntegrationJob(job.id, message);
      return errorResponse(message, 500, "job_processing_failed");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    const status = message === "forbidden" ? 403 : 401;
    return errorResponse(message, status, message);
  }
});
