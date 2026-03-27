// =============================================
// Shared types for multi-module system
// =============================================

// --- Roles ---
export type UserRole = "admin" | "collaborator" | "client";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

// --- Clients ---
export interface ClientData {
  id: string;
  name: string;
  cnpj: string;
  taxRegime: "simples_nacional" | "lucro_presumido" | "lucro_real" | "mei";
  responsibleUserId: string;
  responsibleUserName: string;
  serviceFee: number;
  city: string;
  state: string;
  status: "active" | "pending" | "inactive";
  email: string;
  phone: string;
  createdAt: string;
}

// --- Tasks ---
export type TaskType = "monthly" | "annual" | "one_time";
export type TaskStatus = "pending" | "in_progress" | "completed" | "overdue";
export type TaskPriority = "low" | "medium" | "high";

export interface TaskData {
  id: string;
  title: string;
  description: string;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  category: string;
  clientId: string | null;
  clientName: string | null;
  assignedToId: string;
  assignedToName: string;
  createdAt: string;
  completedAt: string | null;
}

// --- Documents ---
export type DocumentStatus = "unread" | "read" | "processed" | "pending" | "paid" | "overdue" | "final";
export type DocumentType = "fatura" | "nota_fiscal" | "balancete" | "das" | "darf" | "contrato" | "relatorio" | "guia" | "recibo" | "outros";

export interface DocumentData {
  id: string;
  name: string;
  originalFileName: string;
  documentType: DocumentType;
  status: DocumentStatus;
  clientId: string | null;
  clientName: string | null;
  amount: number | null;
  date: string;
  month: number;
  year: number;
  readAt: string | null;
  createdAt: string;
  classifiedAutomatically: boolean;
  classificationConfidence: number;
}

// --- Notifications ---
export type NotificationChannel = "email" | "message" | "system";

export interface Notification {
  id: string;
  type: "document_processed" | "task_assigned" | "task_overdue" | "document_uploaded" | "status_change";
  title: string;
  message: string;
  channel: NotificationChannel;
  read: boolean;
  createdAt: string;
  relatedEntityId?: string;
  relatedEntityType?: "document" | "task" | "client";
}

// --- Workflow Pipeline ---
export type PipelineStep = "upload" | "classification" | "client_association" | "storage" | "distribution";
export type PipelineStepStatus = "pending" | "processing" | "completed" | "failed";

export interface PipelineExecution {
  id: string;
  documentId: string;
  fileName: string;
  steps: {
    step: PipelineStep;
    status: PipelineStepStatus;
    timestamp: string;
    details?: string;
  }[];
  createdAt: string;
  completedAt: string | null;
}
