import { handleCors } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/responses.ts";
import { requireAuthContext, requireWorkspaceManager } from "../_shared/auth.ts";
import { requireScheduler } from "../_shared/scheduler.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import { logIntegrationError } from "../_shared/errors.ts";

type DomainEvent = {
  attempt_count: number;
  id: string;
  tenant_id: string;
  event_type: string;
  entity_type: string | null;
  entity_id: string | null;
  payload: Record<string, unknown>;
};

type AutomationRule = {
  id: string;
  tenant_id: string;
  name: string;
  action_type: string;
  action_payload: Record<string, unknown>;
};

type RequestScope = { tenantId: string; workerId: string };

const resolveScope = async (request: Request): Promise<RequestScope> => {
  if (request.headers.has("x-lotus-scheduler-key")) {
    requireScheduler(request);
    const body = (await request.json()) as { tenantId?: unknown };
    if (typeof body.tenantId !== "string") throw new Error("tenant_required");
    return { tenantId: body.tenantId, workerId: `scheduler-${crypto.randomUUID()}` };
  }

  const context = await requireAuthContext(request);
  requireWorkspaceManager(context);
  return { tenantId: context.tenantId, workerId: `manual-${context.userId}` };
};

Deno.serve(async (request) => {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;
  if (request.method !== "POST") return errorResponse("method_not_allowed", 405);

  try {
    const scope = await resolveScope(request);

    const supabase = createServiceClient();
    const { data: events, error: eventsError } = await supabase
      .rpc("claim_workspace_domain_events", {
        worker_id: scope.workerId,
        workspace_id: scope.tenantId,
        batch_size: 10,
      });

    if (eventsError) throw eventsError;

    const processed = [];
    for (const event of (events ?? []) as DomainEvent[]) {
      const { data: rules, error: rulesError } = await supabase
        .from("automation_rules")
        .select("*")
        .eq("tenant_id", scope.tenantId)
        .eq("enabled", true)
        .eq("trigger_event_type", event.event_type);

      if (rulesError) throw rulesError;

      try {
        for (const rule of (rules ?? []) as AutomationRule[]) {
          if (rule.action_type !== "create_task") {
            throw new Error(`unsupported_automation_action:${rule.action_type}`);
          }
          const { error: actionError } = await supabase.rpc("execute_task_automation", {
            event_id: event.id,
            rule_id: rule.id,
            workspace_id: scope.tenantId,
          });
          if (actionError) throw actionError;
        }

        const { error: completeError } = await supabase.rpc("complete_workspace_domain_event", {
          event_id: event.id,
          workspace_id: scope.tenantId,
        });
        if (completeError) throw completeError;
        processed.push(event.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro desconhecido";
        await logIntegrationError({
          tenantId: scope.tenantId,
          provider: "lotus",
          source: "domain_event_worker",
          operation: event.event_type,
          error,
          retryable: true,
          attemptNumber: event.attempt_count,
          context: { eventId: event.id, entityType: event.entity_type, entityId: event.entity_id },
        });
        const { error: failError } = await supabase.rpc("fail_workspace_domain_event", {
          event_id: event.id,
          workspace_id: scope.tenantId,
          error_message: message,
        });
        if (failError) throw failError;
      }
    }

    return jsonResponse({ processed });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    const status = message === "forbidden" ? 403 : 401;
    return errorResponse(message, status, message);
  }
});
