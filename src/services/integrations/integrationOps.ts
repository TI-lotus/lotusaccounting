import { supabase } from "@/integrations/supabase/client";
import type {
  ActivityLog,
  AutomationRule,
  AutomationRun,
  DomainEvent,
  IntegrationError,
  IntegrationEvent,
  IntegrationJob,
  IntegrationSyncRun,
  IntegrationWebhookEvent,
} from "./types";

export type IntegrationOpsSnapshot = {
  events: IntegrationEvent[];
  jobs: IntegrationJob[];
  errors: IntegrationError[];
  syncRuns: IntegrationSyncRun[];
  webhooks: IntegrationWebhookEvent[];
  domainEvents: DomainEvent[];
  automationRules: AutomationRule[];
  automationRuns: AutomationRun[];
  activityLogs: ActivityLog[];
};

export const loadIntegrationOpsSnapshot = async (
  connectionId?: string,
): Promise<IntegrationOpsSnapshot> => {
  const [
    eventsRes,
    jobsRes,
    errorsRes,
    syncRunsRes,
    webhooksRes,
    domainEventsRes,
    automationRulesRes,
    automationRunsRes,
    activityLogsRes,
  ] = await Promise.all([
    supabase
      .from("integration_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(25),
    supabase
      .from("integration_jobs")
      .select("*")
      .order("scheduled_for", { ascending: true })
      .limit(25),
    supabase
      .from("integration_errors")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(25),
    supabase
      .from("integration_sync_runs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(25),
    supabase
      .from("integration_webhook_events")
      .select("*")
      .order("received_at", { ascending: false })
      .limit(25),
    supabase
      .from("domain_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(25),
    supabase
      .from("automation_rules")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(25),
    supabase
      .from("automation_runs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(25),
    supabase
      .from("activity_logs")
      .select("*")
      .in("entity", ["integration_connection", "integration_job", "automation"])
      .order("created_at", { ascending: false })
      .limit(25),
  ]);

  const responses = [
    eventsRes,
    jobsRes,
    errorsRes,
    syncRunsRes,
    webhooksRes,
    domainEventsRes,
    automationRulesRes,
    automationRunsRes,
    activityLogsRes,
  ];
  const failed = responses.find((response) => response.error);
  if (failed?.error) throw failed.error;

  const filterByConnection = <T extends { connection_id?: string | null }>(
    rows: T[] | null,
  ) =>
    connectionId
      ? (rows ?? []).filter((row) => row.connection_id === connectionId)
      : (rows ?? []);

  return {
    events: filterByConnection(eventsRes.data) as IntegrationEvent[],
    jobs: filterByConnection(jobsRes.data) as IntegrationJob[],
    errors: filterByConnection(errorsRes.data) as IntegrationError[],
    syncRuns: filterByConnection(syncRunsRes.data) as IntegrationSyncRun[],
    webhooks: filterByConnection(webhooksRes.data) as IntegrationWebhookEvent[],
    domainEvents: (domainEventsRes.data ?? []) as DomainEvent[],
    automationRules: (automationRulesRes.data ?? []) as AutomationRule[],
    automationRuns: (automationRunsRes.data ?? []) as AutomationRun[],
    activityLogs: (activityLogsRes.data ?? []) as ActivityLog[],
  };
};
