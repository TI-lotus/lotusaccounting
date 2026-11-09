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
  serviceAreas: OperationalServiceArea[];
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

export type ClientPeriodStatus =
  | "not_started"
  | "waiting_documents"
  | "in_progress"
  | "in_review"
  | "delivered"
  | "closed"
  | "blocked";

export interface ClientPeriodData {
  id: string;
  tenantId: string;
  companyId: string;
  periodMonth: number;
  periodYear: number;
  status: ClientPeriodStatus;
  progressPercent: number;
  startedAt: string | null;
  deliveredAt: string | null;
  closedAt: string | null;
  blockedReason: string | null;
  responsibleUserId: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ClientPeriodStepKey =
  | "documents"
  | "classification"
  | "fiscal"
  | "accounting"
  | "review"
  | "delivery";

export type ClientPeriodStepStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "blocked"
  | "waived";

export interface ClientPeriodStepData {
  id: string;
  tenantId: string;
  clientPeriodId: string;
  companyId: string;
  stepKey: ClientPeriodStepKey;
  title: string;
  description: string | null;
  status: ClientPeriodStepStatus;
  dueDate: string | null;
  completedAt: string | null;
  blockedReason: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export type OperationalServiceArea =
  | "fiscal"
  | "contabil"
  | "folha"
  | "financeiro_bpo"
  | "societario";

export type ClientPeriodChecklistStatus =
  | "pending"
  | "in_progress"
  | "in_review"
  | "completed"
  | "blocked"
  | "waived";

export interface ClientPeriodChecklistItemData {
  id: string;
  tenantId: string;
  companyId: string;
  clientPeriodId: string;
  checklistItemId: string;
  taskId: string | null;
  assignedToId: string | null;
  serviceArea: OperationalServiceArea;
  title: string;
  description: string | null;
  status: ClientPeriodChecklistStatus;
  dueDate: string | null;
  requiresReview: boolean;
  requiresDocument: boolean;
  evidenceDocumentId: string | null;
  completedAt: string | null;
  blockedReason: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

// --- Tasks ---
export type TaskType = "monthly" | "annual" | "one_time";
export type TaskStatus = "pending" | "in_progress" | "completed" | "overdue" | "blocked";
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
  blockedReason?: string | null;
  createdAt: string;
  completedAt: string | null;
}

export type TaskReviewStatus = "pending_review" | "approved" | "rejected";

export interface TaskReviewData {
  id: string;
  tenantId: string;
  taskId: string;
  reviewerId: string | null;
  status: TaskReviewStatus;
  requestedAt: string;
  reviewedAt: string | null;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
}

export type OperationalCommentTargetType =
  | "task"
  | "checklist_item"
  | "client_period"
  | "fiscal_obligation";

export interface OperationalCommentData {
  id: string;
  tenantId: string;
  companyId: string | null;
  targetType: OperationalCommentTargetType;
  targetId: string;
  authorId: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
}

// --- Documents ---
export type DocumentStatus =
  "unread" | "read" | "processed" | "pending" | "paid" | "overdue" | "final";
export type DocumentType =
  | "fatura"
  | "nota_fiscal"
  | "balancete"
  | "das"
  | "darf"
  | "contrato"
  | "relatorio"
  | "guia"
  | "recibo"
  | "outros";

export interface DocumentData {
  id: string;
  name: string;
  originalFileName: string;
  documentType: DocumentType;
  status: DocumentStatus;
  clientId: string | null;
  clientName: string | null;
  amount: number | null;
  filePath?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
  date: string;
  month: number;
  year: number;
  readAt: string | null;
  createdAt: string;
  classifiedAutomatically: boolean;
  classificationConfidence: number;
}

export type DocumentRequestStatus =
  | "requested"
  | "uploaded"
  | "approved"
  | "rejected"
  | "waived";

export interface DocumentRequestData {
  id: string;
  tenantId: string;
  companyId: string;
  clientPeriodId: string | null;
  requestedBy: string | null;
  assignedTo: string | null;
  title: string;
  description: string | null;
  documentType: string | null;
  dueDate: string | null;
  status: DocumentRequestStatus;
  documentId: string | null;
  rejectionReason: string | null;
  waivedReason: string | null;
  createdAt: string;
  updatedAt: string;
}

// --- Notifications ---
export type NotificationChannel = "email" | "message" | "system";

export interface Notification {
  id: string;
  type:
    | "document_processed"
    | "task_assigned"
    | "task_overdue"
    | "document_uploaded"
    | "status_change"
    | "integration_alert";
  title: string;
  message: string;
  channel: NotificationChannel;
  read: boolean;
  createdAt: string;
  relatedEntityId?: string;
  relatedEntityType?: "document" | "task" | "client" | "integration";
}

// --- Workflow Pipeline ---
export type PipelineStep =
  | "upload"
  | "classification"
  | "client_association"
  | "storage"
  | "distribution";
export type PipelineStepStatus =
  "pending" | "processing" | "completed" | "failed";

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
