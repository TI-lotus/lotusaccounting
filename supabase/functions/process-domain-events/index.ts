import { handleCors } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/responses.ts";
import { requireAuthContext, requireWorkspaceManager } from "../_shared/auth.ts";
import { createServiceClient } from "../_shared/supabase.ts";

type DomainEvent = {
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

const createTaskFromRule = async (
  event: DomainEvent,
  rule: AutomationRule,
) => {
  const supabase = createServiceClient();
  const payload = rule.action_payload ?? {};
  const dueDays = Number(payload.dueDays ?? 1);
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + dueDays);

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      tenant_id: event.tenant_id,
      company_id:
        typeof event.payload.company_id === "string"
          ? event.payload.company_id
          : null,
      title: String(payload.title ?? rule.name),
      description: String(
        payload.description ??
          `Tarefa criada automaticamente pelo evento ${event.event_type}.`,
      ),
      task_type: "one_time",
      status: "pending",
      priority: String(payload.priority ?? "medium"),
      category: String(payload.category ?? "Automação"),
      due_date: dueDate.toISOString(),
    })
    .select("*")
    .maybeSingle();

  if (error) throw error;
  return data;
};

Deno.serve(async (request) => {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;

  try {
    const context = await requireAuthContext(request);
    requireWorkspaceManager(context);

    const supabase = createServiceClient();
    const { data: events, error: eventsError } = await supabase
      .from("domain_events")
      .select("*")
      .eq("tenant_id", context.tenantId)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(10);

    if (eventsError) throw eventsError;

    const processed = [];
    for (const event of (events ?? []) as DomainEvent[]) {
      const { data: rules, error: rulesError } = await supabase
        .from("automation_rules")
        .select("*")
        .eq("tenant_id", context.tenantId)
        .eq("enabled", true)
        .eq("trigger_event_type", event.event_type);

      if (rulesError) throw rulesError;

      for (const rule of (rules ?? []) as AutomationRule[]) {
        try {
          const result =
            rule.action_type === "create_task"
              ? await createTaskFromRule(event, rule)
              : { skipped: true, actionType: rule.action_type };

          await supabase.from("automation_runs").insert({
            tenant_id: context.tenantId,
            rule_id: rule.id,
            domain_event_id: event.id,
            status: "completed",
            result: result ?? {},
          });
        } catch (error) {
          await supabase.from("automation_runs").insert({
            tenant_id: context.tenantId,
            rule_id: rule.id,
            domain_event_id: event.id,
            status: "failed",
            error_message:
              error instanceof Error ? error.message : "Erro desconhecido",
          });
        }
      }

      await supabase
        .from("domain_events")
        .update({ status: "processed", processed_at: new Date().toISOString() })
        .eq("id", event.id);
      processed.push(event.id);
    }

    return jsonResponse({ processed });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    const status = message === "forbidden" ? 403 : 401;
    return errorResponse(message, status, message);
  }
});
