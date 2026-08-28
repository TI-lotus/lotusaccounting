import type { Database } from "@/integrations/supabase/types";

export type IntegrationConnection =
  Database["public"]["Tables"]["integration_connections"]["Row"];
export type IntegrationConnectionUpdate =
  Database["public"]["Tables"]["integration_connections"]["Update"];
export type IntegrationConnectionInsert =
  Database["public"]["Tables"]["integration_connections"]["Insert"];
export type IntegrationEvent =
  Database["public"]["Tables"]["integration_events"]["Row"];
export type IntegrationJob =
  Database["public"]["Tables"]["integration_jobs"]["Row"];
export type IntegrationError =
  Database["public"]["Tables"]["integration_errors"]["Row"];
export type IntegrationSyncRun =
  Database["public"]["Tables"]["integration_sync_runs"]["Row"];
export type IntegrationWebhookEvent =
  Database["public"]["Tables"]["integration_webhook_events"]["Row"];
export type DomainEvent =
  Database["public"]["Tables"]["domain_events"]["Row"];
export type AutomationRule =
  Database["public"]["Tables"]["automation_rules"]["Row"];
export type AutomationRun =
  Database["public"]["Tables"]["automation_runs"]["Row"];
export type ActivityLog =
  Database["public"]["Tables"]["activity_logs"]["Row"];

export type IntegrationStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error"
  | "expired"
  | "disabled"
  | "pending";

export type PublicCredentialMetadata = {
  id: string;
  name: string;
  keyHint: string;
  createdAt: string;
  lastUsed: string;
  active: boolean;
  storedBy: "edge-function";
};
