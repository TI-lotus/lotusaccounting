import { handleCors } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/responses.ts";
import { requireScheduler } from "../_shared/scheduler.ts";
import { createServiceClient } from "../_shared/supabase.ts";

const invoke = async (functionName: string, schedulerKey: string, tenantId: string) => {
  const baseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!baseUrl || !serviceKey) throw new Error("scheduler_configuration_missing");
  const response = await fetch(`${baseUrl}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      "x-lotus-scheduler-key": schedulerKey,
    },
    body: JSON.stringify({ tenantId }),
  });
  if (!response.ok) throw new Error(`${functionName}_failed`);
};

Deno.serve(async (request) => {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;
  if (request.method !== "POST") return errorResponse("method_not_allowed", 405);
  try {
    requireScheduler(request);
    const schedulerKey = request.headers.get("x-lotus-scheduler-key")!;
    const supabase = createServiceClient();
    const { data: generatedInvoices, error: billingError } = await supabase
      .rpc("generate_service_fee_invoices_for_all_workspaces");
    if (billingError) throw billingError;

    const { data: tenants, error } = await supabase.from("tenants").select("id");
    if (error) throw error;
    const results = await Promise.allSettled((tenants ?? []).map(async ({ id }) => {
      await invoke("process-domain-events", schedulerKey, id);
      await invoke("process-integration-jobs", schedulerKey, id);
      return id;
    }));
    const processed = results.filter((result) => result.status === "fulfilled").length;
    const failed = results.length - processed;
    const invoicesCreated = (generatedInvoices ?? []).reduce(
      (total, row) => total + Number(row.invoices_created ?? 0),
      0,
    );
    return jsonResponse({ processed, failed, invoicesCreated }, failed ? 207 : 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return errorResponse(message, message === "forbidden" ? 403 : 500);
  }
});
