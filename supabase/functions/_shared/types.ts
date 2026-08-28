export type AppRole = "admin" | "collaborator" | "client";

export type IntegrationProvider =
  | "gmail"
  | "whatsapp"
  | "banking"
  | "receita-federal"
  | "serpro"
  | string;

export type IntegrationConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error"
  | "expired"
  | "disabled"
  | "pending";

export type IntegrationEventStatus =
  | "received"
  | "processing"
  | "processed"
  | "failed"
  | "ignored";

export type IntegrationJobStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "dead_letter";

export type IntegrationSyncStatus =
  | "pending"
  | "running"
  | "completed"
  | "partial"
  | "failed";
