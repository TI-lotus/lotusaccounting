import { handleCors } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/responses.ts";
import { requireAuthContext, requireWorkspaceManager } from "../_shared/auth.ts";
import {
  claimNextIntegrationJob,
  completeIntegrationJob,
  failIntegrationJob,
} from "../_shared/jobs.ts";

Deno.serve(async (request) => {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;

  try {
    const context = await requireAuthContext(request);
    requireWorkspaceManager(context);

    const workerId = `manual-${context.userId}`;
    const job = await claimNextIntegrationJob(workerId);
    if (!job) return jsonResponse({ claimed: false });

    try {
      if (job.job_type === "health_check") {
        await completeIntegrationJob(job.id);
        return jsonResponse({ claimed: true, completed: true, job });
      }

      await failIntegrationJob(
        job.id,
        `Nenhum adapter configurado para ${job.job_type}`,
      );
      return jsonResponse({
        claimed: true,
        completed: false,
        job,
        error: "adapter_not_configured",
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
