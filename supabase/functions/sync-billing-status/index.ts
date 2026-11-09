import { handleCors } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/responses.ts";
import { requireAuthContext } from "../_shared/auth.ts";
import { createServiceClient } from "../_shared/supabase.ts";

Deno.serve(async (request) => {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;
  if (request.method !== "POST") return errorResponse("method_not_allowed", 405);

  try {
    const context = await requireAuthContext(request);
    if (context.role !== "admin") throw new Error("forbidden");
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("tenant_subscriptions")
      .select("*, billing_plans(*)")
      .eq("tenant_id", context.tenantId)
      .maybeSingle();
    if (error) throw error;
    return jsonResponse({ subscription: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return errorResponse(message, message === "forbidden" ? 403 : 400);
  }
});
