import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import {
  ClientData,
  ClientPeriodChecklistItemData,
  ClientPeriodChecklistStatus,
  ClientPeriodData,
  ClientPeriodStepData,
  ClientPeriodStepStatus,
  ClientPeriodStatus,
  OperationalCommentData,
  OperationalCommentTargetType,
  TaskData,
  TaskReviewData,
  TaskReviewStatus,
  DocumentData,
  DocumentRequestData,
  DocumentRequestStatus,
  Notification,
  PipelineExecution,
  TaskStatus,
} from "@/types";
import { computeTaskStatuses, sortTasks } from "@/lib/taskUtils";
import { executeDocumentPipeline } from "@/lib/workflowPipeline";
import {
  defaultAutomationPreferences,
  defaultNotificationChannels,
} from "@/lib/workspaceSettingsDefaults";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import {
  listIntegrationConnections,
  upsertIntegrationConnectionRecord,
} from "@/services/integrations/integrationConnections";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

// =============================================
// Mappers DB <-> UI
// =============================================

type Row = Record<string, unknown>;
type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];
type InvoiceRow = Database["public"]["Tables"]["invoices"]["Row"];
type FiscalObligationRow =
  Database["public"]["Tables"]["fiscal_obligations"]["Row"];
type WorkspaceSettingsRow =
  Database["public"]["Tables"]["workspace_settings"]["Row"];
type WorkspaceSettingsUpdate =
  Database["public"]["Tables"]["workspace_settings"]["Update"];
type IntegrationConnectionRow =
  Database["public"]["Tables"]["integration_connections"]["Row"];
type IntegrationConnectionUpdate =
  Database["public"]["Tables"]["integration_connections"]["Update"];
type PaymentInsert = Omit<
  Database["public"]["Tables"]["payments"]["Insert"],
  "id" | "created_at" | "tenant_id"
>;
type InvoiceInsert = Omit<
  Database["public"]["Tables"]["invoices"]["Insert"],
  "id" | "created_at" | "tenant_id"
>;
type FiscalObligationInsert = Omit<
  Database["public"]["Tables"]["fiscal_obligations"]["Insert"],
  "id" | "created_at" | "tenant_id" | "updated_at"
>;
type LooseError = { message: string; code?: string } | null;
type LooseResult<T> = { data: T | null; error: LooseError };
type LooseQuery<T = unknown> = PromiseLike<LooseResult<T>> & {
  select: (columns?: string) => LooseQuery<T>;
  eq: (column: string, value: unknown) => LooseQuery<T>;
  order: (column: string, options?: { ascending?: boolean }) => LooseQuery<T>;
  insert: (values: unknown) => LooseQuery<T>;
  update: (values: Record<string, unknown>) => LooseQuery<T>;
  delete: () => LooseQuery<T>;
  maybeSingle: () => Promise<LooseResult<T>>;
};
const operationalDb = supabase as unknown as {
  from: <T = unknown>(table: string) => LooseQuery<T>;
};
const rpcDb = supabase as unknown as {
  rpc: <T = unknown>(
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<LooseResult<T>>;
};

export type WorkspaceSettingsData = WorkspaceSettingsRow;
export type IntegrationConnectionData = IntegrationConnectionRow;

const createDefaultWorkspaceSettings = (
  tid: string,
  officeName = "Lotus Accounting",
): WorkspaceSettingsData => ({
  tenant_id: tid,
  office_name: officeName,
  cnpj: null,
  fiscal_year_end: "Dezembro",
  currency: "BRL",
  theme_preference: "light",
  notification_channels: defaultNotificationChannels as Json,
  automation_preferences: defaultAutomationPreferences as Json,
  updated_by: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const asUuid = (v: string | null | undefined): string | null =>
  v && UUID_RE.test(v) ? v : null;
const normalizeCnpj = (value: string) => value.replace(/\D/g, "") || null;
const hasValidCnpj = (value: string | null) => value === null || value.length === 14;

const mapClient = (r: Row): ClientData => ({
  id: String(r.id),
  name: String(r.name ?? ""),
  cnpj: String(r.cnpj ?? ""),
  taxRegime: (r.tax_regime as ClientData["taxRegime"]) ?? "simples_nacional",
  serviceAreas: Array.isArray(r.service_areas) && r.service_areas.length
    ? (r.service_areas as ClientData["serviceAreas"])
    : ["fiscal", "contabil"],
  responsibleUserId: String(r.responsible_user_id ?? ""),
  responsibleUserName: String(r.responsible_user_name ?? ""),
  serviceFee: Number(r.service_fee ?? 0),
  city: String(r.city ?? ""),
  state: String(r.state ?? ""),
  status: (r.status as ClientData["status"]) ?? "active",
  email: String(r.email ?? ""),
  phone: String(r.phone ?? ""),
  createdAt: String(r.created_at ?? new Date().toISOString()),
});

const mapClientPeriod = (r: Row): ClientPeriodData => ({
  id: String(r.id),
  tenantId: String(r.tenant_id ?? ""),
  companyId: String(r.company_id ?? ""),
  periodMonth: Number(r.period_month ?? new Date().getMonth() + 1),
  periodYear: Number(r.period_year ?? new Date().getFullYear()),
  status: (r.status as ClientPeriodStatus) ?? "not_started",
  progressPercent: Number(r.progress_percent ?? 0),
  startedAt: r.started_at ? String(r.started_at) : null,
  deliveredAt: r.delivered_at ? String(r.delivered_at) : null,
  closedAt: r.closed_at ? String(r.closed_at) : null,
  blockedReason: r.blocked_reason ? String(r.blocked_reason) : null,
  responsibleUserId: r.responsible_user_id ? String(r.responsible_user_id) : null,
  createdBy: r.created_by ? String(r.created_by) : null,
  createdAt: String(r.created_at ?? new Date().toISOString()),
  updatedAt: String(r.updated_at ?? new Date().toISOString()),
});

const mapClientPeriodStep = (r: Row): ClientPeriodStepData => ({
  id: String(r.id),
  tenantId: String(r.tenant_id ?? ""),
  clientPeriodId: String(r.client_period_id ?? ""),
  companyId: String(r.company_id ?? ""),
  stepKey: r.step_key as ClientPeriodStepData["stepKey"],
  title: String(r.title ?? ""),
  description: r.description ? String(r.description) : null,
  status: (r.status as ClientPeriodStepStatus) ?? "pending",
  dueDate: r.due_date ? String(r.due_date) : null,
  completedAt: r.completed_at ? String(r.completed_at) : null,
  blockedReason: r.blocked_reason ? String(r.blocked_reason) : null,
  position: Number(r.position ?? 0),
  createdAt: String(r.created_at ?? new Date().toISOString()),
  updatedAt: String(r.updated_at ?? new Date().toISOString()),
});

const mapClientPeriodChecklistItem = (r: Row): ClientPeriodChecklistItemData => ({
  id: String(r.id),
  tenantId: String(r.tenant_id ?? ""),
  companyId: String(r.company_id ?? ""),
  clientPeriodId: String(r.client_period_id ?? ""),
  checklistItemId: String(r.checklist_item_id ?? ""),
  taskId: r.task_id ? String(r.task_id) : null,
  assignedToId: r.assigned_to ? String(r.assigned_to) : null,
  serviceArea: r.service_area as ClientPeriodChecklistItemData["serviceArea"],
  title: String(r.title ?? ""),
  description: r.description ? String(r.description) : null,
  status: (r.status as ClientPeriodChecklistStatus) ?? "pending",
  dueDate: r.due_date ? String(r.due_date) : null,
  requiresReview: Boolean(r.requires_review),
  requiresDocument: Boolean(r.requires_document),
  evidenceDocumentId: r.document_id ? String(r.document_id) : null,
  completedAt: r.completed_at ? String(r.completed_at) : null,
  blockedReason: r.blocked_reason ? String(r.blocked_reason) : null,
  sortOrder: Number(r.sort_order ?? 0),
  createdAt: String(r.created_at ?? new Date().toISOString()),
  updatedAt: String(r.updated_at ?? new Date().toISOString()),
});

const mapTask = (r: Row, clientsById: Map<string, ClientData>): TaskData => ({
  id: String(r.id),
  title: String(r.title ?? ""),
  description: String(r.description ?? ""),
  type: (r.task_type as TaskData["type"]) ?? "one_time",
  status: (r.status as TaskStatus) ?? "pending",
  priority: (r.priority as TaskData["priority"]) ?? "medium",
  dueDate: String(r.due_date ?? new Date().toISOString()),
  category: String(r.category ?? "Geral"),
  clientId: r.company_id ? String(r.company_id) : null,
  clientName: r.company_id
    ? (clientsById.get(String(r.company_id))?.name ?? null)
    : null,
  assignedToId: String(r.assigned_to ?? ""),
  assignedToName: String(r.assigned_to_name ?? "Sem responsável"),
  blockedReason: r.blocked_reason ? String(r.blocked_reason) : null,
  createdAt: String(r.created_at ?? new Date().toISOString()),
  completedAt: r.completed_at ? String(r.completed_at) : null,
});

const mapTaskReview = (r: Row): TaskReviewData => ({
  id: String(r.id),
  tenantId: String(r.tenant_id ?? ""),
  taskId: String(r.task_id ?? ""),
  reviewerId: r.reviewer_id ? String(r.reviewer_id) : null,
  status: (r.status as TaskReviewStatus) ?? "pending_review",
  requestedAt: String(r.requested_at ?? new Date().toISOString()),
  reviewedAt: r.reviewed_at ? String(r.reviewed_at) : null,
  comment: r.comment ? String(r.comment) : null,
  createdAt: String(r.created_at ?? new Date().toISOString()),
  updatedAt: String(r.updated_at ?? new Date().toISOString()),
});

const mapOperationalComment = (r: Row): OperationalCommentData => ({
  id: String(r.id),
  tenantId: String(r.tenant_id ?? ""),
  companyId: r.company_id ? String(r.company_id) : null,
  targetType: r.target_type as OperationalCommentTargetType,
  targetId: String(r.target_id ?? ""),
  authorId: r.author_id ? String(r.author_id) : null,
  body: String(r.body ?? ""),
  createdAt: String(r.created_at ?? new Date().toISOString()),
  updatedAt: String(r.updated_at ?? new Date().toISOString()),
});

const mapDocument = (
  r: Row,
  clientsById: Map<string, ClientData>,
): DocumentData => ({
  id: String(r.id),
  name: String(r.name ?? r.original_file_name ?? "Documento"),
  originalFileName: String(r.original_file_name ?? r.name ?? ""),
  documentType: (r.document_type as DocumentData["documentType"]) ?? "outros",
  status: (r.status as DocumentData["status"]) ?? "pending",
  clientId: r.company_id ? String(r.company_id) : null,
  clientName: r.company_id
    ? (clientsById.get(String(r.company_id))?.name ?? null)
    : null,
  amount: r.amount != null ? Number(r.amount) : null,
  date: r.doc_date
    ? String(r.doc_date)
    : r.created_at
      ? new Date(String(r.created_at)).toLocaleDateString("pt-BR")
      : "",
  month: Number(
    r.month ?? new Date(String(r.created_at ?? Date.now())).getMonth() + 1,
  ),
  year: Number(
    r.year ?? new Date(String(r.created_at ?? Date.now())).getFullYear(),
  ),
  readAt: r.read_at ? String(r.read_at) : null,
  createdAt: String(r.created_at ?? new Date().toISOString()),
  classifiedAutomatically: !!r.classified_automatically,
  classificationConfidence: Number(r.classification_confidence ?? 0),
  filePath: r.file_path ? String(r.file_path) : null,
  fileSize: r.file_size != null ? Number(r.file_size) : null,
  mimeType: r.mime_type ? String(r.mime_type) : null,
});

const mapDocumentRequest = (r: Row): DocumentRequestData => ({
  id: String(r.id),
  tenantId: String(r.tenant_id ?? ""),
  companyId: String(r.company_id ?? ""),
  clientPeriodId: r.client_period_id ? String(r.client_period_id) : null,
  requestedBy: r.requested_by ? String(r.requested_by) : null,
  assignedTo: r.assigned_to ? String(r.assigned_to) : null,
  title: String(r.title ?? ""),
  description: r.description ? String(r.description) : null,
  documentType: r.document_type ? String(r.document_type) : null,
  dueDate: r.due_date ? String(r.due_date) : null,
  status: (r.status as DocumentRequestStatus) ?? "requested",
  documentId: r.document_id ? String(r.document_id) : null,
  rejectionReason: r.rejection_reason ? String(r.rejection_reason) : null,
  waivedReason: r.waived_reason ? String(r.waived_reason) : null,
  createdAt: String(r.created_at ?? new Date().toISOString()),
  updatedAt: String(r.updated_at ?? new Date().toISOString()),
});

// =============================================
// Context
// =============================================

interface DataContextType {
  loading: boolean;
  dataError: string | null;
  tenantId: string | null;

  clients: ClientData[];
  addClient: (client: Omit<ClientData, "id" | "createdAt">) => Promise<boolean>;
  updateClient: (id: string, updates: Partial<ClientData>) => Promise<boolean>;
  deleteClient: (id: string) => Promise<boolean>;
  clientPeriods: ClientPeriodData[];
  clientPeriodSteps: ClientPeriodStepData[];
  clientPeriodChecklistItems: ClientPeriodChecklistItemData[];
  createClientPeriod: (
    companyId: string,
    periodMonth: number,
    periodYear: number,
  ) => Promise<ClientPeriodData | null>;
  generateClientPeriodsForMonth: (
    periodMonth: number,
    periodYear: number,
  ) => Promise<number>;
  updateClientPeriodStatus: (
    id: string,
    status: ClientPeriodStatus,
    blockedReason?: string | null,
  ) => Promise<boolean>;
  updateClientPeriodStep: (
    id: string,
    status: ClientPeriodStepStatus,
    blockedReason?: string | null,
  ) => Promise<boolean>;
  updateClientPeriodChecklistItem: (
    id: string,
    status: ClientPeriodChecklistStatus,
    blockedReason?: string | null,
  ) => Promise<boolean>;
  linkClientPeriodChecklistEvidence: (
    id: string,
    documentId: string | null,
  ) => Promise<boolean>;
  updateClientPeriodChecklistPlanning: (
    id: string,
    updates: {
      assignedToId?: string | null;
      dueDate?: string | null;
    },
  ) => Promise<boolean>;

  tasks: TaskData[];
  taskReviews: TaskReviewData[];
  operationalComments: OperationalCommentData[];
  addTask: (
    task: Omit<TaskData, "id" | "createdAt" | "completedAt" | "blockedReason"> & {
      blockedReason?: string | null;
    },
  ) => Promise<boolean>;
  generateRecurringTasks: (targetDate?: string) => Promise<number>;
  updateTask: (id: string, updates: Partial<TaskData>) => Promise<boolean>;
  updateTaskStatus: (id: string, status: TaskStatus, blockedReason?: string | null) => Promise<boolean>;
  deleteTask: (id: string) => Promise<boolean>;
  requestTaskReview: (taskId: string) => Promise<TaskReviewData | null>;
  approveTaskReview: (id: string, comment?: string | null) => Promise<boolean>;
  rejectTaskReview: (id: string, comment: string) => Promise<boolean>;
  createOperationalComment: (
    targetType: OperationalCommentTargetType,
    targetId: string,
    body: string,
  ) => Promise<OperationalCommentData | null>;

  documents: DocumentData[];
  documentRequests: DocumentRequestData[];
  addDocument: (doc: DocumentData) => Promise<boolean>;
  updateDocument: (id: string, updates: Partial<DocumentData>) => Promise<boolean>;
  deleteDocument: (id: string) => Promise<boolean>;
  createDocumentRequest: (
    request: Omit<DocumentRequestData, "id" | "tenantId" | "requestedBy" | "status" | "documentId" | "rejectionReason" | "waivedReason" | "createdAt" | "updatedAt">,
  ) => Promise<DocumentRequestData | null>;
  updateDocumentRequest: (
    id: string,
    updates: Partial<Pick<DocumentRequestData, "status" | "documentId" | "rejectionReason" | "waivedReason">>,
  ) => Promise<boolean>;

  payments: PaymentRow[];
  invoices: InvoiceRow[];
  fiscalObligations: FiscalObligationRow[];
  workspaceSettings: WorkspaceSettingsData | null;
  integrationConnections: IntegrationConnectionData[];
  addPayment: (payment: PaymentInsert) => Promise<PaymentRow | null>;
  updatePayment: (id: string, updates: Partial<PaymentRow>) => Promise<boolean>;
  deletePayment: (id: string) => Promise<boolean>;
  addInvoice: (invoice: InvoiceInsert) => Promise<InvoiceRow | null>;
  updateInvoice: (id: string, updates: Partial<InvoiceRow>) => Promise<boolean>;
  deleteInvoice: (id: string) => Promise<boolean>;
  generateMonthlyServiceFeeInvoices: () => Promise<number>;
  addFiscalObligation: (
    obligation: FiscalObligationInsert,
  ) => Promise<FiscalObligationRow | null>;
  updateFiscalObligation: (
    id: string,
    updates: Partial<FiscalObligationRow>,
  ) => Promise<boolean>;
  generateMonthlyFiscalObligations: () => Promise<void>;
  updateWorkspaceSettings: (
    updates: WorkspaceSettingsUpdate,
  ) => Promise<WorkspaceSettingsData | null>;
  upsertIntegrationConnection: (
    integrationId: string,
    updates: IntegrationConnectionUpdate,
  ) => Promise<IntegrationConnectionData | null>;

  processFileUpload: (file: File, documentRequestId?: string) => Promise<void>;
  createDemoWorkspaceData: () => Promise<boolean>;

  notifications: Notification[];
  markNotificationRead: (id: string) => void;

  pipelineHistory: PipelineExecution[];

  refresh: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider = ({ children }: { children: ReactNode }) => {
  const { session, user, profile, loading: authLoading } = useAuth();
  const fetchRevision = useRef(0);
  const lastRevalidationAt = useRef(0);

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [profileCompanyId, setProfileCompanyId] = useState<string | null>(null);
  const [accountType, setAccountType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  const [clients, setClients] = useState<ClientData[]>([]);
  const [clientPeriods, setClientPeriods] = useState<ClientPeriodData[]>([]);
  const [clientPeriodSteps, setClientPeriodSteps] = useState<ClientPeriodStepData[]>([]);
  const [clientPeriodChecklistItems, setClientPeriodChecklistItems] = useState<ClientPeriodChecklistItemData[]>([]);
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [taskReviews, setTaskReviews] = useState<TaskReviewData[]>([]);
  const [operationalComments, setOperationalComments] = useState<OperationalCommentData[]>([]);
  const [documents, setDocuments] = useState<DocumentData[]>([]);
  const [documentRequests, setDocumentRequests] = useState<DocumentRequestData[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [fiscalObligations, setFiscalObligations] = useState<
    FiscalObligationRow[]
  >([]);
  const [workspaceSettings, setWorkspaceSettings] =
    useState<WorkspaceSettingsData | null>(null);
  const [integrationConnections, setIntegrationConnections] = useState<
    IntegrationConnectionData[]
  >([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [pipelineHistory, setPipelineHistory] = useState<PipelineExecution[]>(
    [],
  );

  // -------- Fetch all --------
  const fetchAll = useCallback(async () => {
    const revision = ++fetchRevision.current;
    if (!user || !profile?.tenant_id || profile.status !== "active") {
      setClients([]);
      setClientPeriods([]);
      setClientPeriodSteps([]);
      setClientPeriodChecklistItems([]);
      setTasks([]);
      setTaskReviews([]);
      setOperationalComments([]);
      setDocuments([]);
      setDocumentRequests([]);
      setPayments([]);
      setInvoices([]);
      setFiscalObligations([]);
      setWorkspaceSettings(null);
      setIntegrationConnections([]);
      setNotifications([]);
      setPipelineHistory([]);
      setTenantId(null);
      setProfileCompanyId(null);
      setAccountType(null);
      setDataError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
    const tid = profile.tenant_id;
    setTenantId(tid);
    setProfileCompanyId(profile?.company_id ?? null);
    setAccountType(profile?.account_type ?? null);

    const companiesPromise = supabase
      .from("companies")
      .select("*")
      .eq("tenant_id", tid)
      .order("created_at", { ascending: false });

    const secondaryDataPromise = Promise.all([
      supabase.from("tasks").select("*").eq("tenant_id", tid).order("due_date", { ascending: true }),
      supabase
        .from("documents")
        .select("*")
        .eq("tenant_id", tid)
        .order("created_at", { ascending: false }),
      operationalDb
        .from<Row[]>("document_requests")
        .select("*")
        .eq("tenant_id", tid)
        .order("due_date", { ascending: true }),
      supabase
        .from("payments")
        .select("*")
        .eq("tenant_id", tid)
        .order("created_at", { ascending: false }),
      supabase
        .from("invoices")
        .select("*")
        .eq("tenant_id", tid)
        .order("created_at", { ascending: false }),
      supabase
        .from("fiscal_obligations")
        .select("*")
        .eq("tenant_id", tid)
        .order("due_date", { ascending: true }),
      supabase.from("workspace_settings").select("*").eq("tenant_id", tid).maybeSingle(),
      listIntegrationConnections().catch((error) => {
        console.error("Failed to load integration connections", error);
        return [];
      }),
      operationalDb
        .from<Row[]>("client_periods")
        .select("*")
        .eq("tenant_id", tid)
        .order("period_year", { ascending: false })
        .order("period_month", { ascending: false }),
      operationalDb
        .from<Row[]>("client_period_steps")
        .select("*")
        .eq("tenant_id", tid)
        .order("position", { ascending: true }),
      operationalDb
        .from<Row[]>("client_period_checklist_items")
        .select("*")
        .eq("tenant_id", tid)
        .order("sort_order", { ascending: true }),
      operationalDb
        .from<Row[]>("task_reviews")
        .select("*")
        .eq("tenant_id", tid)
        .order("requested_at", { ascending: false }),
      operationalDb
        .from<Row[]>("operational_comments")
        .select("*")
        .eq("tenant_id", tid)
        .order("created_at", { ascending: false }),
    ]);

    const companiesRes = await companiesPromise;
    if (revision !== fetchRevision.current) return;
    if (companiesRes.error) {
      console.error("Could not load workspace clients", companiesRes.error);
      setDataError("Não foi possível carregar os clientes. Atualize os dados para tentar novamente.");
      toast.error("Não foi possível carregar os clientes. Tente atualizar a lista.");
    } else {
      setDataError(null);
    }
    const clientList = (companiesRes.data ?? []).map(mapClient);
    const clientsById = new Map(clientList.map((c) => [c.id, c]));
    setClients(clientList);
    // A tela de Clientes não deve ficar bloqueada por consultas secundárias
    // (tarefas, documentos, integrações etc.) que carregam em paralelo.
    setLoading(false);

    const [
      tasksRes,
      docsRes,
      documentRequestsRes,
      paymentsRes,
      invoicesRes,
      fiscalObligationsRes,
      workspaceSettingsRes,
      integrationConnectionsRes,
      clientPeriodsRes,
      clientPeriodStepsRes,
      clientPeriodChecklistItemsRes,
      taskReviewsRes,
      operationalCommentsRes,
    ] = await secondaryDataPromise;
    if (revision !== fetchRevision.current) return;
    const failures = [
      companiesRes,
      tasksRes,
      docsRes,
      documentRequestsRes,
      paymentsRes,
      invoicesRes,
      fiscalObligationsRes,
      workspaceSettingsRes,
      clientPeriodsRes,
      clientPeriodStepsRes,
      clientPeriodChecklistItemsRes,
      taskReviewsRes,
      operationalCommentsRes,
    ].filter((result) => result.error);
    if (failures.length) {
      console.error("Some workspace data could not be loaded", failures);
      setDataError("Alguns dados do workspace não puderam ser carregados. Atualize os dados para tentar novamente.");
      toast.error("Alguns dados do workspace não puderam ser carregados. Tente atualizar a página.");
    }
    if (!failures.length && !companiesRes.error) setDataError(null);

    setClientPeriods((clientPeriodsRes.data ?? []).map(mapClientPeriod));
    setClientPeriodSteps((clientPeriodStepsRes.data ?? []).map(mapClientPeriodStep));
    setClientPeriodChecklistItems((clientPeriodChecklistItemsRes.data ?? []).map(mapClientPeriodChecklistItem));
    setTaskReviews((taskReviewsRes.data ?? []).map(mapTaskReview));
    setOperationalComments((operationalCommentsRes.data ?? []).map(mapOperationalComment));
    setTasks(
      sortTasks(
        computeTaskStatuses(
          (tasksRes.data ?? []).map((r) => mapTask(r, clientsById)),
        ),
      ),
    );
    setDocuments((docsRes.data ?? []).map((r) => mapDocument(r, clientsById)));
    setDocumentRequests((documentRequestsRes.data ?? []).map(mapDocumentRequest));
    setPayments((paymentsRes.data ?? []) as PaymentRow[]);
    setInvoices((invoicesRes.data ?? []) as InvoiceRow[]);
    setFiscalObligations(
      (fiscalObligationsRes.data ?? []) as FiscalObligationRow[],
    );
    setWorkspaceSettings(
      (workspaceSettingsRes.data as WorkspaceSettingsData | null) ??
        createDefaultWorkspaceSettings(tid),
    );
    setIntegrationConnections(
      (integrationConnectionsRes ?? []) as IntegrationConnectionData[],
    );
    const integrationAlerts = (
      (integrationConnectionsRes ?? []) as IntegrationConnectionData[]
    )
      .filter((connection) =>
        ["error", "expired"].includes(connection.status),
      )
      .map(
        (connection): Notification => ({
          id: `integration-${connection.id}-${connection.status}`,
          type: "integration_alert",
          title:
            connection.status === "expired"
              ? "Integração expirada"
              : "Falha em integração",
          message: `${connection.account_label ?? connection.provider} precisa de atenção.`,
          channel: "system",
          read: false,
          createdAt: connection.last_error_at ?? new Date().toISOString(),
          relatedEntityId: connection.id,
          relatedEntityType: "integration",
        }),
      );
    setNotifications((prev) => [
      ...integrationAlerts,
      ...prev.filter((item) => item.type !== "integration_alert"),
    ]);
    } catch (error) {
      if (revision === fetchRevision.current) {
        setDataError("O workspace não pôde ser atualizado. Verifique sua conexão e tente novamente.");
        toast.error("Erro ao carregar dados: " + (error instanceof Error ? error.message : "Tente novamente."));
      }
    } finally {
      if (revision === fetchRevision.current) setLoading(false);
    }
  }, [user, profile]);

  useEffect(() => {
    const revisionCounter = fetchRevision;
    setClients([]); setTasks([]); setTaskReviews([]); setOperationalComments([]); setDocuments([]); setDocumentRequests([]); setPayments([]); setInvoices([]);
    setClientPeriods([]); setClientPeriodSteps([]); setClientPeriodChecklistItems([]); setFiscalObligations([]); setWorkspaceSettings(null); setIntegrationConnections([]);
    setNotifications([]); setPipelineHistory([]); setTenantId(null); setDataError(null);
    return () => { ++revisionCounter.current; };
  }, [user?.id, profile?.tenant_id]);

  useEffect(() => {
    if (authLoading) return;
    if (session === null && !user) {
      // not logged in
      setClients([]);
      setClientPeriods([]);
      setClientPeriodSteps([]);
      setClientPeriodChecklistItems([]);
      setTasks([]);
      setTaskReviews([]);
      setOperationalComments([]);
      setDocuments([]);
      setDocumentRequests([]);
      setPayments([]);
      setInvoices([]);
      setFiscalObligations([]);
      setWorkspaceSettings(null);
      setIntegrationConnections([]);
      setNotifications([]);
      setPipelineHistory([]);
      setTenantId(null);
      setProfileCompanyId(null);
      setAccountType(null);
      setDataError(null);
      setLoading(false);
      return;
    }
    void fetchAll();
  }, [session, user, fetchAll, authLoading]);

  useEffect(() => {
    if (!user || !profile?.tenant_id || profile.status !== "active") return;

    const channel = supabase
      .channel(`workspace-data-${profile.tenant_id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "companies", filter: `tenant_id=eq.${profile.tenant_id}` },
        () => void fetchAll(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "workspace_settings", filter: `tenant_id=eq.${profile.tenant_id}` },
        () => void fetchAll(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "client_periods", filter: `tenant_id=eq.${profile.tenant_id}` },
        () => void fetchAll(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "client_period_steps", filter: `tenant_id=eq.${profile.tenant_id}` },
        () => void fetchAll(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "client_period_checklist_items", filter: `tenant_id=eq.${profile.tenant_id}` },
        () => void fetchAll(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks", filter: `tenant_id=eq.${profile.tenant_id}` },
        () => void fetchAll(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "documents", filter: `tenant_id=eq.${profile.tenant_id}` },
        () => void fetchAll(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "document_requests", filter: `tenant_id=eq.${profile.tenant_id}` },
        () => void fetchAll(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payments", filter: `tenant_id=eq.${profile.tenant_id}` },
        () => void fetchAll(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "invoices", filter: `tenant_id=eq.${profile.tenant_id}` },
        () => void fetchAll(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "fiscal_obligations", filter: `tenant_id=eq.${profile.tenant_id}` },
        () => void fetchAll(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_reviews", filter: `tenant_id=eq.${profile.tenant_id}` },
        () => void fetchAll(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "operational_comments", filter: `tenant_id=eq.${profile.tenant_id}` },
        () => void fetchAll(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchAll, profile?.status, profile?.tenant_id, user]);

  useEffect(() => {
    if (!user || !profile?.tenant_id || profile.status !== "active") return;
    const refreshWhenEnvironmentChanges = () => {
      const now = Date.now();
      if (now - lastRevalidationAt.current < 10_000) return;
      lastRevalidationAt.current = now;
      void fetchAll();
    };

    const refreshWhenVisible = () => {
      if (document.visibilityState !== "visible") return;
      refreshWhenEnvironmentChanges();
    };

    window.addEventListener("online", refreshWhenEnvironmentChanges);
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.removeEventListener("online", refreshWhenEnvironmentChanges);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [fetchAll, profile?.status, profile?.tenant_id, user]);

  // -------- Clients --------
  const addClient = useCallback(
    async (client: Omit<ClientData, "id" | "createdAt">) => {
      if (!tenantId) {
        toast.error("Tenant não encontrado");
        return false;
      }
      const cnpj = normalizeCnpj(client.cnpj);
      if (!hasValidCnpj(cnpj)) {
        toast.error("O CNPJ deve conter 14 dígitos");
        return false;
      }
      const existingClient = cnpj
        ? clients.find((item) => normalizeCnpj(item.cnpj) === cnpj)
        : undefined;
      if (existingClient) {
        toast.error(`O CNPJ já está cadastrado para ${existingClient.name}`);
        return false;
      }
      const { data, error } = await supabase
        .from("companies")
        .insert({
          tenant_id: tenantId,
          name: client.name,
          cnpj,
          email: client.email || null,
          phone: client.phone || null,
          tax_regime: client.taxRegime,
          service_areas: client.serviceAreas?.length ? client.serviceAreas : ["fiscal", "contabil"],
          service_fee: client.serviceFee || 0,
          city: client.city || null,
          state: client.state || null,
          status: client.status || "active",
          responsible_user_id: asUuid(client.responsibleUserId),
          responsible_user_name: client.responsibleUserName || null,
        })
        .select("*")
        .maybeSingle();
      if (error) {
        if (error.code === "23505" && error.message.includes("companies_tenant_normalized_cnpj_unique")) {
          toast.error("Este CNPJ já está cadastrado neste escritório");
        } else {
          toast.error("Erro ao adicionar cliente: " + error.message);
        }
        return false;
      }
      if (data) setClients((prev) => [mapClient(data), ...prev]);
      if (data) await fetchAll();
      return Boolean(data);
    },
    [clients, fetchAll, tenantId],
  );

  const updateClient = useCallback(
    async (id: string, updates: Partial<ClientData>) => {
      if (!tenantId) {
        toast.error("Tenant não encontrado");
        return false;
      }
      const patch: Database["public"]["Tables"]["companies"]["Update"] = {};
      if (updates.name !== undefined) patch.name = updates.name;
      if (updates.cnpj !== undefined) {
        const cnpj = normalizeCnpj(updates.cnpj);
        if (!hasValidCnpj(cnpj)) {
          toast.error("O CNPJ deve conter 14 dígitos");
          return false;
        }
        patch.cnpj = cnpj;
      }
      if (updates.email !== undefined) patch.email = updates.email;
      if (updates.phone !== undefined) patch.phone = updates.phone;
      if (updates.taxRegime !== undefined) patch.tax_regime = updates.taxRegime;
      if (updates.serviceAreas !== undefined)
        patch.service_areas = updates.serviceAreas.length ? updates.serviceAreas : ["fiscal", "contabil"];
      if (updates.serviceFee !== undefined)
        patch.service_fee = updates.serviceFee;
      if (updates.city !== undefined) patch.city = updates.city;
      if (updates.state !== undefined) patch.state = updates.state;
      if (updates.status !== undefined) patch.status = updates.status;
      if (updates.responsibleUserId !== undefined)
        patch.responsible_user_id = asUuid(updates.responsibleUserId);
      if (updates.responsibleUserName !== undefined)
        patch.responsible_user_name = updates.responsibleUserName;

      if (Object.keys(patch).length) {
        const { data, error } = await supabase
          .from("companies")
          .update(patch)
          .eq("id", id).eq("tenant_id", tenantId).select("*").maybeSingle();
        if (error || !data) { toast.error("Erro ao atualizar cliente: " + (error?.message ?? "Acesso negado ou registro não encontrado")); return false; }
        setClients((prev) => prev.map((c) => c.id === id ? mapClient(data) : c));
      }
      return true;
    },
    [tenantId],
  );

  const deleteClient = useCallback(async (id: string) => {
    if (!tenantId) {
      toast.error("Tenant não encontrado");
      return false;
    }
    const { data, error } = await supabase
      .from("companies")
      .update({ status: "inactive" })
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .select("*")
      .maybeSingle();
    if (error || !data) { toast.error("Erro ao arquivar cliente: " + (error?.message ?? "Acesso negado ou registro não encontrado")); return false; }
    setClients((prev) => prev.map((client) => client.id === id ? mapClient(data) : client));
    return true;
  }, [tenantId]);

  // -------- Client periods --------
  const createClientPeriod = useCallback(
    async (companyId: string, periodMonth: number, periodYear: number) => {
      if (!tenantId) {
        toast.error("Tenant não encontrado");
        return null;
      }
      if (accountType === "client") {
        toast.error("Seu perfil não pode iniciar competências");
        return null;
      }
      const client = clients.find((item) => item.id === companyId);
      if (!client || client.status !== "active") {
        toast.error("Selecione um cliente ativo para iniciar a competência");
        return null;
      }
      const existing = clientPeriods.find((period) =>
        period.companyId === companyId
        && period.periodMonth === periodMonth
        && period.periodYear === periodYear
      );
      if (existing) return existing;

      const payload = {
        tenant_id: tenantId,
        company_id: companyId,
        period_month: periodMonth,
        period_year: periodYear,
        status: "waiting_documents",
        responsible_user_id: asUuid(client.responsibleUserId),
        created_by: user?.id ?? null,
      };
      const { data, error } = await operationalDb
        .from<Row>("client_periods")
        .insert(payload)
        .select("*")
        .maybeSingle();
      if (error) {
        if (error.code === "23505") {
          const { data: current, error: currentError } = await operationalDb
            .from<Row>("client_periods")
            .select("*")
            .eq("tenant_id", tenantId)
            .eq("company_id", companyId)
            .eq("period_month", periodMonth)
            .eq("period_year", periodYear)
            .maybeSingle();
          if (currentError || !current) {
            toast.error("Competência já existe, mas não foi possível carregá-la.");
            return null;
          }
          const mapped = mapClientPeriod(current);
          setClientPeriods((prev) => [...prev.filter((period) => period.id !== mapped.id), mapped]);
          void fetchAll();
          return mapped;
        }
        toast.error("Erro ao iniciar competência: " + error.message);
        return null;
      }
      if (!data) return null;
      const mapped = mapClientPeriod(data);
      setClientPeriods((prev) => [mapped, ...prev]);
      void fetchAll();
      return mapped;
    },
    [accountType, clientPeriods, clients, fetchAll, tenantId, user?.id],
  );

  const generateClientPeriodsForMonth = useCallback(
    async (periodMonth: number, periodYear: number) => {
      if (!tenantId) {
        toast.error("Tenant não encontrado");
        return 0;
      }
      if (accountType === "client") {
        toast.error("Seu perfil não pode gerar competências");
        return 0;
      }
      const existingKeys = new Set(
        clientPeriods.map((period) => `${period.companyId}-${period.periodMonth}-${period.periodYear}`),
      );
      const inserts = clients
        .filter((client) => client.status === "active")
        .filter((client) => !existingKeys.has(`${client.id}-${periodMonth}-${periodYear}`))
        .map((client) => ({
          tenant_id: tenantId,
          company_id: client.id,
          period_month: periodMonth,
          period_year: periodYear,
          status: "waiting_documents",
          responsible_user_id: asUuid(client.responsibleUserId),
          created_by: user?.id ?? null,
        }));

      if (inserts.length === 0) {
        toast.info("As competências deste período já estão criadas");
        return 0;
      }
      const { data, error } = await operationalDb
        .from<Row[]>("client_periods")
        .insert(inserts)
        .select("*");
      if (error) {
        toast.error("Erro ao gerar competências: " + error.message);
        return 0;
      }
      const mapped = (data ?? []).map(mapClientPeriod);
      setClientPeriods((prev) => [...mapped, ...prev]);
      void fetchAll();
      return mapped.length;
    },
    [accountType, clientPeriods, clients, fetchAll, tenantId, user?.id],
  );

  const updateClientPeriodStatus = useCallback(
    async (id: string, status: ClientPeriodStatus, blockedReason?: string | null) => {
      if (!tenantId) return false;
      if (accountType === "client") {
        toast.error("Seu perfil não pode alterar competências");
        return false;
      }
      const patch: Record<string, unknown> = {
        status,
        blocked_reason: status === "blocked" ? blockedReason?.trim() || "Bloqueada por pendência crítica" : null,
      };
      const { data, error } = await operationalDb
        .from<Row>("client_periods")
        .update(patch)
        .eq("id", id)
        .eq("tenant_id", tenantId)
        .select("*")
        .maybeSingle();
      if (error || !data) {
        toast.error("Erro ao atualizar competência: " + (error?.message ?? "Acesso negado ou registro não encontrado"));
        return false;
      }
      const mapped = mapClientPeriod(data);
      setClientPeriods((prev) => prev.map((period) => period.id === id ? mapped : period));
      return true;
    },
    [accountType, tenantId],
  );

  const updateClientPeriodStep = useCallback(
    async (id: string, status: ClientPeriodStepStatus, blockedReason?: string | null) => {
      if (!tenantId) return false;
      if (accountType === "client") {
        toast.error("Seu perfil não pode alterar etapas da competência");
        return false;
      }
      const patch: Record<string, unknown> = {
        status,
        blocked_reason: status === "blocked" ? blockedReason?.trim() || "Etapa bloqueada por pendência operacional" : null,
      };
      const { data, error } = await operationalDb
        .from<Row>("client_period_steps")
        .update(patch)
        .eq("id", id)
        .eq("tenant_id", tenantId)
        .select("*")
        .maybeSingle();
      if (error || !data) {
        toast.error("Erro ao atualizar etapa: " + (error?.message ?? "Acesso negado ou registro não encontrado"));
        return false;
      }
      const mapped = mapClientPeriodStep(data);
      setClientPeriodSteps((prev) => prev.map((step) => step.id === id ? mapped : step));
      void fetchAll();
      return true;
    },
    [accountType, fetchAll, tenantId],
  );

  const updateClientPeriodChecklistItem = useCallback(
    async (id: string, status: ClientPeriodChecklistStatus, blockedReason?: string | null) => {
      if (!tenantId) return false;
      if (accountType === "client") {
        toast.error("Seu perfil não pode alterar itens do checklist");
        return false;
      }
      const patch: Record<string, unknown> = {
        status,
        blocked_reason: status === "blocked" ? blockedReason?.trim() || "Item bloqueado por pendência operacional" : null,
      };
      const { data, error } = await operationalDb
        .from<Row>("client_period_checklist_items")
        .update(patch)
        .eq("id", id)
        .eq("tenant_id", tenantId)
        .select("*")
        .maybeSingle();
      if (error || !data) {
        toast.error("Erro ao atualizar checklist: " + (error?.message ?? "Acesso negado ou registro não encontrado"));
        return false;
      }
      const mapped = mapClientPeriodChecklistItem(data);
      setClientPeriodChecklistItems((prev) => prev.map((item) => item.id === id ? mapped : item));
      void fetchAll();
      return true;
    },
    [accountType, fetchAll, tenantId],
  );

  const linkClientPeriodChecklistEvidence = useCallback(
    async (id: string, documentId: string | null) => {
      if (!tenantId) return false;
      if (accountType === "client") {
        toast.error("Seu perfil não pode vincular evidências ao checklist");
        return false;
      }
      const { data, error } = await operationalDb
        .from<Row>("client_period_checklist_items")
        .update({ document_id: documentId })
        .eq("id", id)
        .eq("tenant_id", tenantId)
        .select("*")
        .maybeSingle();
      if (error || !data) {
        toast.error("Erro ao vincular evidência: " + (error?.message ?? "Acesso negado ou registro não encontrado"));
        return false;
      }
      const mapped = mapClientPeriodChecklistItem(data);
      setClientPeriodChecklistItems((prev) => prev.map((item) => item.id === id ? mapped : item));
      void fetchAll();
      return true;
    },
    [accountType, fetchAll, tenantId],
  );

  const updateClientPeriodChecklistPlanning = useCallback(
    async (
      id: string,
      updates: {
        assignedToId?: string | null;
        dueDate?: string | null;
      },
    ) => {
      if (!tenantId) return false;
      if (accountType === "client") {
        toast.error("Seu perfil não pode alterar o planejamento do checklist");
        return false;
      }
      const patch: Record<string, unknown> = {};
      if (updates.assignedToId !== undefined) patch.assigned_to = updates.assignedToId;
      if (updates.dueDate !== undefined) patch.due_date = updates.dueDate;
      if (!Object.keys(patch).length) return true;

      const { data, error } = await operationalDb
        .from<Row>("client_period_checklist_items")
        .update(patch)
        .eq("id", id)
        .eq("tenant_id", tenantId)
        .select("*")
        .maybeSingle();
      if (error || !data) {
        toast.error("Erro ao atualizar planejamento do checklist: " + (error?.message ?? "Acesso negado ou registro não encontrado"));
        return false;
      }
      const mapped = mapClientPeriodChecklistItem(data);
      setClientPeriodChecklistItems((prev) => prev.map((item) => item.id === id ? mapped : item));
      void fetchAll();
      return true;
    },
    [accountType, fetchAll, tenantId],
  );

  // -------- Tasks --------
  const addTask = useCallback(
    async (task: Omit<TaskData, "id" | "createdAt" | "completedAt" | "blockedReason"> & {
      blockedReason?: string | null;
    }) => {
      if (!tenantId) {
        toast.error("Tenant não encontrado");
        return false;
      }
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          tenant_id: tenantId,
          title: task.title,
          description: task.description || null,
          task_type: task.type,
          status: task.status,
          blocked_reason: task.status === "blocked" ? task.blockedReason?.trim() || "Bloqueada por pendência operacional" : null,
          priority: task.priority,
          due_date: task.dueDate ? new Date(task.dueDate).toISOString() : null,
          category: task.category || null,
          company_id: asUuid(task.clientId),
          assigned_to: asUuid(task.assignedToId),
          assigned_to_name: task.assignedToName || null,
          created_by: user?.id ?? null,
        })
        .select("*")
        .maybeSingle();
      if (error) {
        toast.error("Erro ao criar tarefa: " + error.message);
        return false;
      }
      if (data) {
        const clientsById = new Map(clients.map((c) => [c.id, c]));
        const mapped = mapTask(data, clientsById);
        mapped.assignedToName = task.assignedToName;
        setTasks((prev) => sortTasks(computeTaskStatuses([mapped, ...prev])));

        if (task.type === "monthly" || task.type === "annual") {
          const { error: recurrenceError } = await rpcDb.rpc(
            "register_task_recurrence",
            { p_source_task_id: data.id },
          );
          if (recurrenceError) {
            toast.error(
              "Tarefa criada, mas não foi possível configurar a recorrência: " +
                recurrenceError.message,
            );
          }
        }
      }
      return Boolean(data);
    },
    [tenantId, user, clients],
  );

  const generateRecurringTasks = useCallback(
    async (targetDate = new Date().toISOString().slice(0, 10)) => {
      if (!tenantId) {
        toast.error("Tenant não encontrado");
        return 0;
      }
      const { data, error } = await rpcDb.rpc<number>(
        "generate_task_recurrences",
        { target_date: targetDate },
      );
      if (error) {
        toast.error("Erro ao gerar recorrências: " + error.message);
        return 0;
      }
      await fetchAll();
      return Number(data ?? 0);
    },
    [fetchAll, tenantId],
  );

  const updateTask = useCallback(
    async (id: string, updates: Partial<TaskData>) => {
      if (!tenantId) {
        toast.error("Tenant não encontrado");
        return false;
      }
      const currentTask = tasks.find((task) => task.id === id);
      const changesAssignee =
        updates.assignedToId !== undefined ||
        updates.assignedToName !== undefined;
      if (changesAssignee && currentTask?.status === "completed") {
        toast.error("Tarefas concluídas não podem receber nova atribuição. Reabra a tarefa antes de alterar o responsável.");
        return false;
      }
      const patch: Database["public"]["Tables"]["tasks"]["Update"] = {};
      if (updates.title !== undefined) patch.title = updates.title;
      if (updates.description !== undefined)
        patch.description = updates.description;
      if (updates.type !== undefined) patch.task_type = updates.type;
      if (updates.status !== undefined) patch.status = updates.status;
      if (updates.blockedReason !== undefined)
        patch.blocked_reason = updates.blockedReason?.trim() || null;
      if (updates.priority !== undefined) patch.priority = updates.priority;
      if (updates.dueDate !== undefined)
        patch.due_date = new Date(updates.dueDate).toISOString();
      if (updates.category !== undefined) patch.category = updates.category;
      if (updates.clientId !== undefined)
        patch.company_id = asUuid(updates.clientId);
      if (updates.assignedToId !== undefined)
        patch.assigned_to = asUuid(updates.assignedToId);
      if (updates.assignedToName !== undefined)
        patch.assigned_to_name = updates.assignedToName;
      if (updates.completedAt !== undefined)
        patch.completed_at = updates.completedAt;

      if (Object.keys(patch).length) {
        const { data, error } = await supabase
          .from("tasks")
          .update(patch)
          .eq("id", id).eq("tenant_id", tenantId).select("id").maybeSingle();
        if (error || !data) { toast.error("Erro ao atualizar tarefa: " + (error?.message ?? "Acesso negado ou registro não encontrado")); return false; }
        setTasks((prev) => sortTasks(prev.map((t) => t.id === id ? { ...t, ...updates } : t)));
      }
      return true;
    },
    [tenantId, tasks],
  );

  const requestTaskReview = useCallback(
    async (taskId: string) => {
      if (!tenantId) return null;
      if (accountType === "client") {
        toast.error("Seu perfil não pode solicitar revisão técnica");
        return null;
      }
      const existing = taskReviews.find(
        (review) => review.taskId === taskId && review.status === "pending_review",
      );
      if (existing) return existing;

      const task = tasks.find((item) => item.id === taskId);
      if (!task) {
        toast.error("Tarefa não encontrada para revisão");
        return null;
      }

      const { data, error } = await operationalDb
        .from<Row>("task_reviews")
        .insert({
          tenant_id: tenantId,
          task_id: taskId,
          reviewer_id: null,
          status: "pending_review",
        })
        .select("*")
        .maybeSingle();
      if (error || !data) {
        toast.error("Erro ao solicitar revisão: " + (error?.message ?? "Acesso negado ou revisão já pendente"));
        void fetchAll();
        return null;
      }
      const mapped = mapTaskReview(data);
      setTaskReviews((prev) => [mapped, ...prev]);
      void fetchAll();
      return mapped;
    },
    [accountType, fetchAll, taskReviews, tasks, tenantId],
  );

  const updateTaskReviewStatus = useCallback(
    async (id: string, status: Extract<TaskReviewStatus, "approved" | "rejected">, comment?: string | null) => {
      if (!tenantId) return false;
      if (accountType === "client") {
        toast.error("Seu perfil não pode revisar tarefas");
        return false;
      }
      if (status === "rejected" && !comment?.trim()) {
        toast.error("Informe o motivo da reprovação");
        return false;
      }
      const { data, error } = await operationalDb
        .from<Row>("task_reviews")
        .update({
          status,
          reviewer_id: user?.id ?? null,
          comment: comment?.trim() || null,
        })
        .eq("id", id)
        .eq("tenant_id", tenantId)
        .select("*")
        .maybeSingle();
      if (error || !data) {
        toast.error("Erro ao registrar revisão: " + (error?.message ?? "Acesso negado ou registro não encontrado"));
        return false;
      }
      const mapped = mapTaskReview(data);
      setTaskReviews((prev) => prev.map((review) => review.id === id ? mapped : review));
      await fetchAll();
      return true;
    },
    [accountType, fetchAll, tenantId, user?.id],
  );

  const approveTaskReview = useCallback(
    (id: string, comment?: string | null) => updateTaskReviewStatus(id, "approved", comment),
    [updateTaskReviewStatus],
  );

  const rejectTaskReview = useCallback(
    (id: string, comment: string) => updateTaskReviewStatus(id, "rejected", comment),
    [updateTaskReviewStatus],
  );

  const createOperationalComment = useCallback(
    async (
      targetType: OperationalCommentTargetType,
      targetId: string,
      body: string,
    ) => {
      if (!tenantId || !user?.id) return null;
      if (accountType === "client") {
        toast.error("Comentários operacionais são internos do escritório.");
        return null;
      }
      const text = body.trim();
      if (!text) {
        toast.error("Escreva um comentário antes de registrar.");
        return null;
      }
      const { data, error } = await operationalDb
        .from<Row>("operational_comments")
        .insert({
          tenant_id: tenantId,
          target_type: targetType,
          target_id: targetId,
          author_id: user.id,
          body: text,
        })
        .select("*")
        .maybeSingle();
      if (error || !data) {
        toast.error("Erro ao registrar comentário: " + (error?.message ?? "Acesso negado ou alvo não encontrado"));
        return null;
      }
      const mapped = mapOperationalComment(data);
      setOperationalComments((prev) => [mapped, ...prev]);
      return mapped;
    },
    [accountType, tenantId, user?.id],
  );

  const updateTaskStatus = useCallback(
    async (id: string, status: TaskStatus, blockedReason?: string | null) => {
      if (!tenantId) return false;
      const normalizedBlockedReason = blockedReason?.trim() || null;
      if (status === "blocked" && !normalizedBlockedReason) {
        toast.error("Informe o motivo do bloqueio da tarefa");
        return false;
      }
      const linkedReviewItem = clientPeriodChecklistItems.find(
        (item) => item.taskId === id && item.requiresReview && item.status !== "completed" && item.status !== "waived",
      );
      const hasApprovedReview = taskReviews.some(
        (review) => review.taskId === id && review.status === "approved",
      );
      if (status === "completed" && linkedReviewItem && !hasApprovedReview) {
        const review = await requestTaskReview(id);
        if (!review) return false;
        await updateClientPeriodChecklistItem(linkedReviewItem.id, "in_review");
        const { data, error } = await supabase
          .from("tasks")
          .update({ status: "in_progress", completed_at: null, blocked_reason: null })
          .eq("id", id).eq("tenant_id", tenantId).select("id").maybeSingle();
        if (error || !data) {
          toast.error("Erro ao enviar tarefa para revisão: " + (error?.message ?? "Acesso negado ou registro não encontrado"));
          return false;
        }
        setTasks((prev) => sortTasks(prev.map((t) => t.id === id ? { ...t, status: "in_progress", completedAt: null, blockedReason: null } : t)));
        toast.info("Tarefa enviada para revisão técnica");
        void fetchAll();
        return true;
      }
      const completedAt =
        status === "completed" ? new Date().toISOString() : null;
      const { data, error } = await supabase
        .from("tasks")
        .update({
          status,
          completed_at: completedAt,
          blocked_reason: status === "blocked" ? normalizedBlockedReason : null,
        })
        .eq("id", id).eq("tenant_id", tenantId).select("id").maybeSingle();
      if (error || !data) { toast.error("Erro ao atualizar status: " + (error?.message ?? "Acesso negado ou registro não encontrado")); return false; }
      setTasks((prev) => sortTasks(prev.map((t) => t.id === id ? {
        ...t,
        status,
        completedAt,
        blockedReason: status === "blocked" ? normalizedBlockedReason : null,
      } : t)));
      void fetchAll();
      return true;
    },
    [clientPeriodChecklistItems, fetchAll, requestTaskReview, taskReviews, tenantId, updateClientPeriodChecklistItem],
  );

  const deleteTask = useCallback(async (id: string) => {
    if (!tenantId) return false;
    const { data, error } = await supabase.from("tasks").delete().eq("id", id).eq("tenant_id", tenantId).select("id").maybeSingle();
    if (error || !data) { toast.error("Erro ao remover tarefa: " + (error?.message ?? "Acesso negado ou registro não encontrado")); return false; }
    setTasks((prev) => prev.filter((t) => t.id !== id));
    return true;
  }, [tenantId]);

  // -------- Documents --------
  const persistDocument = useCallback(
    async (doc: DocumentData) => {
      if (!tenantId) return null;
      const { data, error } = await supabase
        .from("documents")
        .insert({
          tenant_id: tenantId,
          company_id: asUuid(doc.clientId),
          uploaded_by: user?.id ?? null,
          document_type: doc.documentType,
          status: doc.status,
          name: doc.name,
          original_file_name: doc.originalFileName,
          amount: doc.amount,
          doc_date: null,
          month: doc.month,
          year: doc.year,
          read_at: doc.readAt,
          classified_automatically: doc.classifiedAutomatically,
          classification_confidence: doc.classificationConfidence,
          file_path: doc.filePath ?? null,
          file_size: doc.fileSize ?? null,
          mime_type: doc.mimeType ?? null,
        })
        .select("*")
        .maybeSingle();
      if (error) {
        toast.error("Erro ao salvar documento: " + error.message);
        return null;
      }
      if (data) {
        const clientsById = new Map(clients.map((c) => [c.id, c]));
        return mapDocument(data, clientsById);
      }
      return null;
    },
    [tenantId, user, clients],
  );

  const addDocument = useCallback(
    async (doc: DocumentData) => {
      const saved = await persistDocument(doc);
      if (!saved) return false;
      setDocuments((prev) => [saved, ...prev]);
      return true;
    },
    [persistDocument],
  );

  const updateDocument = useCallback(
    async (id: string, updates: Partial<DocumentData>) => {
      if (!tenantId) {
        toast.error("Tenant não encontrado");
        return false;
      }
      const patch: Database["public"]["Tables"]["documents"]["Update"] = {};
      if (updates.name !== undefined) patch.name = updates.name;
      if (updates.documentType !== undefined)
        patch.document_type = updates.documentType;
      if (updates.status !== undefined) patch.status = updates.status;
      if (updates.clientId !== undefined)
        patch.company_id = asUuid(updates.clientId);
      if (updates.amount !== undefined) patch.amount = updates.amount;
      if (updates.readAt !== undefined) patch.read_at = updates.readAt;

      if (Object.keys(patch).length) {
        const { data, error } = await supabase
          .from("documents")
          .update(patch)
          .eq("id", id).eq("tenant_id", tenantId).select("id").maybeSingle();
        if (error || !data) { toast.error("Erro ao atualizar documento: " + (error?.message ?? "Acesso negado ou registro não encontrado")); return false; }
        setDocuments((prev) => prev.map((d) => d.id === id ? { ...d, ...updates } : d));
      }
      return true;
    },
    [tenantId],
  );

  const deleteDocument = useCallback(async (id: string) => {
    if (!tenantId) return false;
    const { data, error } = await supabase.from("documents").delete().eq("id", id).eq("tenant_id", tenantId).select("file_path").maybeSingle();
    if (error || !data) { toast.error("Erro ao remover documento: " + (error?.message ?? "Acesso negado ou registro não encontrado")); return false; }
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    if (data.file_path) {
      const { error: cleanupError } = await supabase.storage.from("documents").remove([data.file_path]);
      if (cleanupError) toast.warning("Registro removido, mas o arquivo ainda precisa ser limpo: " + cleanupError.message);
    }
    return true;
  }, [tenantId]);

  const createDocumentRequest = useCallback(
    async (
      request: Omit<DocumentRequestData, "id" | "tenantId" | "requestedBy" | "status" | "documentId" | "rejectionReason" | "waivedReason" | "createdAt" | "updatedAt">,
    ) => {
      if (!tenantId) {
        toast.error("Tenant não encontrado");
        return null;
      }
      if (accountType === "client") {
        toast.error("Seu perfil não pode solicitar documentos");
        return null;
      }
      const { data, error } = await operationalDb
        .from<Row>("document_requests")
        .insert({
          tenant_id: tenantId,
          company_id: request.companyId,
          client_period_id: request.clientPeriodId,
          requested_by: user?.id ?? null,
          assigned_to: request.assignedTo,
          title: request.title,
          description: request.description,
          document_type: request.documentType,
          due_date: request.dueDate,
          status: "requested",
        })
        .select("*")
        .maybeSingle();
      if (error || !data) {
        toast.error("Erro ao solicitar documento: " + (error?.message ?? "Acesso negado"));
        return null;
      }
      const mapped = mapDocumentRequest(data);
      setDocumentRequests((prev) => [mapped, ...prev]);
      void fetchAll();
      return mapped;
    },
    [accountType, fetchAll, tenantId, user?.id],
  );

  const updateDocumentRequest = useCallback(
    async (
      id: string,
      updates: Partial<Pick<DocumentRequestData, "status" | "documentId" | "rejectionReason" | "waivedReason">>,
    ) => {
      if (!tenantId) return false;
      const patch: Record<string, unknown> = {};
      if (updates.status !== undefined) patch.status = updates.status;
      if (updates.documentId !== undefined) patch.document_id = updates.documentId;
      if (updates.rejectionReason !== undefined) patch.rejection_reason = updates.rejectionReason;
      if (updates.waivedReason !== undefined) patch.waived_reason = updates.waivedReason;

      const { data, error } = await operationalDb
        .from<Row>("document_requests")
        .update(patch)
        .eq("id", id)
        .eq("tenant_id", tenantId)
        .select("*")
        .maybeSingle();
      if (error || !data) {
        toast.error("Erro ao atualizar solicitação: " + (error?.message ?? "Acesso negado ou registro não encontrado"));
        return false;
      }
      const mapped = mapDocumentRequest(data);
      setDocumentRequests((prev) => prev.map((request) => request.id === id ? mapped : request));
      void fetchAll();
      return true;
    },
    [fetchAll, tenantId],
  );

  // -------- Payments --------
  const addPayment = useCallback(
    async (payment: PaymentInsert) => {
      if (!tenantId) {
        toast.error("Tenant não encontrado");
        return null;
      }
      if (accountType === "client") {
        toast.error("Clientes não podem registrar pagamentos no workspace");
        return null;
      }
      if (!Number.isFinite(Number(payment.amount)) || Number(payment.amount) <= 0) {
        toast.error("O valor do pagamento deve ser maior que zero.");
        return null;
      }
      const { data, error } = await supabase
        .from("payments")
        .insert({
          ...payment,
          tenant_id: tenantId,
        })
        .select("*")
        .maybeSingle();
      if (error) {
        toast.error("Erro ao salvar pagamento: " + error.message);
        return null;
      }
      if (data) setPayments((prev) => [data as PaymentRow, ...prev]);
      if (data?.invoice_id) await fetchAll();
      return (data as PaymentRow | null) ?? null;
    },
    [accountType, tenantId, fetchAll],
  );

  const updatePayment = useCallback(
    async (id: string, updates: Partial<PaymentRow>) => {
      if (!tenantId) return false;
      if (accountType === "client") {
        toast.error("Clientes não podem alterar pagamentos no workspace");
        return false;
      }
      const currentPayment = payments.find((payment) => payment.id === id);
      if (
        currentPayment?.reconciled_at &&
        (updates.status !== undefined || updates.paid_at !== undefined)
      ) {
        toast.error("Pagamentos conciliados não podem ter status ou data de pagamento alterados manualmente.");
        return false;
      }
      const { data, error } = await supabase
        .from("payments")
        .update(updates)
        .eq("id", id).eq("tenant_id", tenantId).select("*").maybeSingle();
      if (error || !data) {
        toast.error("Erro ao atualizar pagamento: " + (error?.message ?? "Acesso negado ou registro não encontrado"));
        return false;
      }
      setPayments((prev) => prev.map((payment) => payment.id === id ? data : payment));
      await fetchAll();
      return true;
    },
    [accountType, fetchAll, tenantId, payments],
  );

  const deletePayment = useCallback(
    async (id: string) => {
      if (!tenantId) return false;
      if (accountType === "client") {
        toast.error("Clientes não podem remover pagamentos no workspace");
        return false;
      }
      const { data, error } = await supabase.from("payments").delete().eq("id", id).eq("tenant_id", tenantId).select("id").maybeSingle();
      if (error || !data) {
        toast.error("Erro ao remover pagamento: " + (error?.message ?? "Acesso negado ou registro não encontrado"));
        return false;
      }
      setPayments((prev) => prev.filter((payment) => payment.id !== id));
      await fetchAll();
      return true;
    },
    [accountType, fetchAll, tenantId],
  );

  // -------- Invoices --------
  const addInvoice = useCallback(
    async (invoice: InvoiceInsert) => {
      if (!tenantId) {
        toast.error("Tenant não encontrado");
        return null;
      }
      if (accountType === "client") {
        toast.error("Clientes não podem criar faturas no workspace");
        return null;
      }
      if (!Number.isFinite(Number(invoice.amount)) || Number(invoice.amount) <= 0) {
        toast.error("O valor da fatura deve ser maior que zero.");
        return null;
      }
      if (invoice.status === "paid") {
        toast.error("Crie a fatura como pendente e registre um pagamento para marcá-la como paga.");
        return null;
      }
      const { data, error } = await supabase
        .from("invoices")
        .insert({
          ...invoice,
          tenant_id: tenantId,
        })
        .select("*")
        .maybeSingle();
      if (error) {
        toast.error("Erro ao criar fatura: " + error.message);
        return null;
      }
      if (data) setInvoices((prev) => [data as InvoiceRow, ...prev]);
      return (data as InvoiceRow | null) ?? null;
    },
    [accountType, tenantId],
  );

  const updateInvoice = useCallback(
    async (id: string, updates: Partial<InvoiceRow>) => {
      if (!tenantId) return false;
      if (accountType === "client") {
        toast.error("Clientes não podem alterar faturas no workspace");
        return false;
      }
      const { data, error } = await supabase
        .from("invoices")
        .update(updates)
        .eq("id", id).eq("tenant_id", tenantId).select("*").maybeSingle();
      if (error || !data) {
        toast.error("Erro ao atualizar fatura: " + (error?.message ?? "Acesso negado ou registro não encontrado"));
        return false;
      }
      setInvoices((prev) => prev.map((invoice) => invoice.id === id ? data : invoice));
      return true;
    },
    [accountType, tenantId],
  );

  const deleteInvoice = useCallback(
    async (id: string) => {
      if (!tenantId) return false;
      if (accountType === "client") {
        toast.error("Clientes não podem remover faturas no workspace");
        return false;
      }
      const invoice = invoices.find((item) => item.id === id);
      if (invoice?.status === "paid") {
        toast.error("Faturas pagas não podem ser removidas. Cancele ou estorne o pagamento antes.");
        return false;
      }
      const { data, error } = await supabase.from("invoices").delete().eq("id", id).eq("tenant_id", tenantId).select("id").maybeSingle();
      if (error || !data) {
        toast.error("Erro ao remover fatura: " + (error?.message ?? "Acesso negado ou registro não encontrado"));
        return false;
      }
      setInvoices((prev) => prev.filter((invoice) => invoice.id !== id));
      await fetchAll();
      return true;
    },
    [accountType, fetchAll, tenantId, invoices],
  );

  const generateMonthlyServiceFeeInvoices = useCallback(async () => {
    if (!tenantId || accountType !== "admin") {
      toast.error("Somente administradores podem gerar faturas de honorários");
      return 0;
    }
    const targetPeriod = `${new Date().toISOString().slice(0, 7)}-01`;
    const { data, error } = await supabase.rpc("generate_monthly_service_fee_invoices", {
      target_period: targetPeriod,
    });
    if (error) {
      toast.error("Erro ao gerar faturas de honorários: " + error.message);
      return 0;
    }
    const created = (data ?? []) as InvoiceRow[];
    if (created.length) setInvoices((current) => [...created, ...current]);
    await fetchAll();
    return created.length;
  }, [accountType, fetchAll, tenantId]);

  const createDemoWorkspaceData = useCallback(async () => {
    if (!tenantId) {
      toast.error("Tenant não encontrado");
      return false;
    }
    if (accountType !== "admin") {
      toast.error("Somente administradores podem criar dados de demonstração");
      return false;
    }

    const demoCnpj = "11222333000181";
    const demoName = "Empresa Demonstração Lotus";
    const now = new Date();
    const periodMonth = now.getMonth() + 1;
    const periodYear = now.getFullYear();
    const periodKey = `${periodMonth}/${periodYear}`;
    const dueDate = new Date(periodYear, periodMonth - 1, Math.min(20, new Date(periodYear, periodMonth, 0).getDate()));
    const dueDateIso = dueDate.toISOString().slice(0, 10);
    const taskTitle = `Demonstração · Conferir documentos da competência ${periodKey}`;
    const requestTitle = `Demonstração · Extrato bancário ${periodKey}`;
    const invoiceNumber = `DEMO-${periodYear}${String(periodMonth).padStart(2, "0")}`;
    const paymentDescription = `Demonstração · Recebimento de honorários ${periodKey}`;

    try {
      let company = clients.find((client) => normalizeCnpj(client.cnpj) === demoCnpj);
      if (!company) {
        const { data, error } = await supabase
          .from("companies")
          .insert({
            tenant_id: tenantId,
            name: demoName,
            cnpj: demoCnpj,
            email: "demonstracao@lotus.local",
            phone: null,
            tax_regime: "simples_nacional",
            service_areas: ["fiscal", "contabil"],
            service_fee: 1250,
            city: "São Paulo",
            state: "SP",
            status: "active",
            responsible_user_id: asUuid(user?.id),
            responsible_user_name: profile?.full_name || user?.email || "Administrador",
          })
          .select("*")
          .maybeSingle();
        if (error || !data) throw error ?? new Error("empresa_demo_nao_criada");
        company = mapClient(data);
      }

      let period = clientPeriods.find((item) =>
        item.companyId === company.id &&
        item.periodMonth === periodMonth &&
        item.periodYear === periodYear,
      );
      if (!period) {
        const { data, error } = await operationalDb
          .from<Row>("client_periods")
          .insert({
            tenant_id: tenantId,
            company_id: company.id,
            period_month: periodMonth,
            period_year: periodYear,
            status: "waiting_documents",
            responsible_user_id: asUuid(user?.id),
            created_by: user?.id ?? null,
          })
          .select("*")
          .maybeSingle();
        if (error?.code === "23505") {
          const current = await operationalDb
            .from<Row>("client_periods")
            .select("*")
            .eq("tenant_id", tenantId)
            .eq("company_id", company.id)
            .eq("period_month", periodMonth)
            .eq("period_year", periodYear)
            .maybeSingle();
          if (current.error || !current.data) throw current.error ?? new Error("competencia_demo_nao_carregada");
          period = mapClientPeriod(current.data);
        } else if (error || !data) {
          throw error ?? new Error("competencia_demo_nao_criada");
        } else {
          period = mapClientPeriod(data);
        }
      }

      const existingTask = tasks.find((task) => task.title === taskTitle && task.clientId === company.id);
      if (!existingTask) {
        const created = await addTask({
          title: taskTitle,
          description: "Registro de demonstração para validar atribuição, prazo e conclusão de tarefas.",
          type: "monthly",
          status: "pending",
          priority: "medium",
          dueDate: dueDate.toISOString(),
          category: "Demonstração",
          clientId: company.id,
          clientName: company.name,
          assignedToId: user?.id ?? "",
          assignedToName: profile?.full_name || user?.email || "Administrador",
        });
        if (!created) throw new Error("tarefa_demo_nao_criada");
      }

      const existingRequest = documentRequests.find((request) => request.title === requestTitle && request.companyId === company.id);
      if (!existingRequest) {
        const created = await createDocumentRequest({
          companyId: company.id,
          clientPeriodId: period?.id ?? null,
          assignedTo: asUuid(user?.id),
          title: requestTitle,
          description: "Solicitação de demonstração. Nenhum arquivo externo é enviado automaticamente.",
          documentType: "extrato",
          dueDate: dueDateIso,
        });
        if (!created) throw new Error("solicitacao_demo_nao_criada");
      }

      let invoice: InvoiceRow | null = invoices.find((item) => item.number === invoiceNumber && item.company_id === company.id) ?? null;
      if (!invoice) {
        invoice = await addInvoice({
          company_id: company.id,
          amount: 1250,
          billing_period: `${periodYear}-${String(periodMonth).padStart(2, "0")}-01`,
          due_date: dueDateIso,
          issued_at: now.toISOString(),
          invoice_kind: "service_fee",
          number: invoiceNumber,
          status: "pending",
        });
        if (!invoice) throw new Error("fatura_demo_nao_criada");
      }

      const existingPayment = payments.find((payment) => payment.description === paymentDescription && payment.company_id === company.id);
      if (!existingPayment) {
        const created = await addPayment({
          company_id: company.id,
          invoice_id: invoice.id,
          amount: 1250,
          direction: "income",
          description: paymentDescription,
          category: "Honorários",
          method: "transfer",
          status: "completed",
          due_date: dueDateIso,
          paid_at: now.toISOString(),
        });
        if (!created) throw new Error("pagamento_demo_nao_criado");
      }

      await fetchAll();
      return true;
    } catch (error) {
      toast.error(`Não foi possível criar o cenário de demonstração: ${error instanceof Error ? error.message : "tente novamente"}`);
      return false;
    }
  }, [accountType, addInvoice, addPayment, addTask, clients, clientPeriods, createDocumentRequest, documentRequests, fetchAll, invoices, payments, profile?.full_name, tasks, tenantId, user]);

  // -------- Fiscal obligations --------
  const addFiscalObligation = useCallback(
    async (obligation: FiscalObligationInsert) => {
      if (!tenantId) {
        toast.error("Tenant não encontrado");
        return null;
      }
      const { data, error } = await supabase
        .from("fiscal_obligations")
        .insert({
          ...obligation,
          tenant_id: tenantId,
          created_by: user?.id ?? null,
        })
        .select("*")
        .maybeSingle();
      if (error) {
        toast.error("Erro ao criar obrigação fiscal: " + error.message);
        return null;
      }
      if (data) {
        const row = data as FiscalObligationRow;
        setFiscalObligations((prev) =>
          [row, ...prev].sort((a, b) =>
            String(a.due_date).localeCompare(String(b.due_date)),
          ),
        );
        return row;
      }
      return null;
    },
    [tenantId, user],
  );

  const updateFiscalObligation = useCallback(
    async (id: string, updates: Partial<FiscalObligationRow>) => {
      if (!tenantId) return false;
      const patch = {
        ...updates,
        completed_at:
          updates.status === "completed"
            ? (updates.completed_at ?? new Date().toISOString())
            : updates.status && updates.status !== "completed"
              ? null
              : updates.completed_at,
      };
      const { data, error } = await supabase
        .from("fiscal_obligations")
        .update(patch)
        .eq("id", id).eq("tenant_id", tenantId).select("*").maybeSingle();
      if (error || !data) {
        toast.error("Erro ao atualizar obrigação fiscal: " + (error?.message ?? "Acesso negado ou registro não encontrado"));
        return false;
      }
      setFiscalObligations((prev) => prev.map((obligation) => obligation.id === id ? data : obligation));
      return true;
    },
    [tenantId],
  );

  const generateMonthlyFiscalObligations = useCallback(async () => {
    if (!tenantId) {
      toast.error("Tenant não encontrado");
      return;
    }
    if (accountType === "client") {
      toast.error("Seu perfil não pode gerar obrigações fiscais");
      return;
    }

    const today = new Date();
    const periodMonth = today.getMonth() + 1;
    const periodYear = today.getFullYear();
    const activeClients = clients.filter(
      (client) => client.status === "active",
    );
    let synced = 0;

    for (const client of activeClients) {
      const existingPeriod = clientPeriods.find(
        (period) =>
          period.companyId === client.id &&
          period.periodMonth === periodMonth &&
          period.periodYear === periodYear,
      );
      const period =
        existingPeriod ??
        (await createClientPeriod(client.id, periodMonth, periodYear));
      if (!period) continue;

      const { data, error } = await rpcDb.rpc<number>(
        "create_fiscal_obligations_for_client_period",
        { target_period_id: period.id },
      );
      if (error) {
        toast.error("Erro ao gerar obrigações: " + error.message);
        return;
      }
      synced += Number(data ?? 0);
    }

    await fetchAll();
    toast.success(
      synced > 0
        ? `${synced} obrigação(ões) fiscal(is) gerada(s)`
        : "Obrigações fiscais do mês sincronizadas",
    );
  }, [accountType, clientPeriods, clients, createClientPeriod, fetchAll, tenantId]);

  // -------- Workspace settings and integrations --------
  const updateWorkspaceSettings = useCallback(
    async (updates: WorkspaceSettingsUpdate) => {
      if (!tenantId) {
        toast.error("Tenant não encontrado");
        return null;
      }
      if (accountType !== "admin") {
        toast.error("Somente o administrador pode alterar configurações do workspace");
        return null;
      }

      const { data, error } = await supabase
        .from("workspace_settings")
        .upsert(
          {
            tenant_id: tenantId,
            ...updates,
            updated_by: user?.id ?? null,
          },
          { onConflict: "tenant_id" },
        )
        .select("*")
        .maybeSingle();

      if (error) {
        toast.error("Erro ao salvar configurações: " + error.message);
        void fetchAll();
        return null;
      }

      const row = data as WorkspaceSettingsData | null;
      if (row) setWorkspaceSettings(row);
      return row;
    },
    [accountType, fetchAll, tenantId, user],
  );

  const upsertIntegrationConnection = useCallback(
    async (integrationId: string, updates: IntegrationConnectionUpdate) => {
      if (!tenantId) {
        toast.error("Tenant não encontrado");
        return null;
      }
      if (accountType === "client") {
        toast.error("Seu perfil não pode alterar integrações");
        return null;
      }


      let row: IntegrationConnectionData | null = null;
      try {
        row = await upsertIntegrationConnectionRecord({
          tenantId,
          integrationId,
          updates: { provider: integrationId, ...updates },
          userId: user?.id ?? null,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Erro desconhecido";
        toast.error("Erro ao salvar integração: " + message);
        void fetchAll();
        return null;
      }

      if (row) {
        setIntegrationConnections((prev) => {
          const without = prev.filter(
            (item) => item.integration_id !== integrationId,
          );
          return [...without, row].sort((a, b) =>
            a.integration_id.localeCompare(b.integration_id),
          );
        });
      }
      return row;
    },
    [accountType, fetchAll, tenantId, user],
  );

  // -------- Pipeline (file upload) --------
  const processFileUpload = useCallback(
    async (file: File, documentRequestId?: string) => {
      if (!tenantId) {
        toast.error("Tenant não encontrado para salvar o arquivo");
        return;
      }

      if (file.size > 25 * 1024 * 1024) { toast.error("O arquivo deve ter no máximo 25 MB."); return; }
      const result = executeDocumentPipeline(file.name, clients, {
        fileSize: file.size, mimeType: file.type || null,
      });
      const targetRequest = documentRequestId
        ? documentRequests.find((request) => request.id === documentRequestId)
        : null;
      if (targetRequest) {
        const requestClient = clients.find((client) => client.id === targetRequest.companyId);
        result.document.clientId = targetRequest.companyId;
        result.document.clientName = requestClient?.name ?? "Cliente";
        if (targetRequest.documentType) {
          result.document.documentType = targetRequest.documentType as DocumentData["documentType"];
        }
        result.document.status = "unread";
      }
      if (accountType === "client") {
        if (!profileCompanyId) { toast.error("Seu perfil ainda não está vinculado a uma empresa"); return; }
        if (targetRequest && targetRequest.companyId !== profileCompanyId) {
          toast.error("Esta solicitação não pertence à sua empresa");
          return;
        }
        result.document.clientId = targetRequest?.companyId ?? profileCompanyId;
        result.document.clientName = clients.find((client) => client.id === result.document.clientId)?.name ?? "Minha empresa";
      }

      const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = `${tenantId}/${result.document.clientId ?? "unassigned"}/${user.id}/${crypto.randomUUID()}-${safeFileName}`;
      result.document.filePath = filePath;
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, file, {
          cacheControl: "3600",
          contentType: file.type || undefined,
          upsert: false,
        });

      if (uploadError) {
        toast.error("Erro ao enviar arquivo: " + uploadError.message);
        return;
      }

      const saved = await persistDocument(result.document);
      if (!saved) {
        const { error: cleanupError } = await supabase.storage.from("documents").remove([filePath]);
        if (cleanupError) toast.warning("O arquivo não foi registrado e sua limpeza precisa ser repetida.");
        return;
      }
      result.pipeline.documentId = saved.id;
      result.notifications.forEach((notification) => { notification.relatedEntityId = saved.id; });
      setDocuments((prev) => [saved, ...prev]);
      if (targetRequest) {
        await updateDocumentRequest(targetRequest.id, {
          status: "uploaded",
          documentId: saved.id,
        });
      }
      setPipelineHistory((prev) => [result.pipeline, ...prev]);
      if (result.notifications.length)
        setNotifications((prev) => [...result.notifications, ...prev]);

      const needsReview =
        !saved.clientId ||
        saved.documentType === "outros" ||
        saved.classificationConfidence < 0.7;
      if (needsReview && accountType !== "client") {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        await addTask({
          title: `Revisar documento: ${saved.name}`,
          description:
            "Documento enviado automaticamente precisa de conferência de tipo, cliente ou metadados extraídos.",
          type: "one_time",
          status: "pending",
          priority: saved.clientId ? "medium" : "high",
          dueDate: tomorrow.toISOString(),
          category: "Documentos",
          clientId: saved.clientId,
          clientName: saved.clientName,
          assignedToId: "",
          assignedToName: "Sem responsável",
        });
      }

      if (saved.clientName) {
        toast.success(
          `Documento classificado como "${saved.documentType}" e associado a ${saved.clientName}`,
          {
            description: `Confiança: ${Math.round(saved.classificationConfidence * 100)}%`,
          },
        );
      } else {
        toast.info(
          `Documento classificado como "${saved.documentType}" — cliente não identificado`,
        );
      }
    },
    [
      accountType,
      addTask,
      clients,
      documentRequests,
      persistDocument,
      profileCompanyId,
      tenantId,
      updateDocumentRequest,
      user,
    ],
  );

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  }, []);

  return (
    <DataContext.Provider
      value={{
        loading,
        dataError,
        tenantId,
        clients,
        addClient,
        updateClient,
        deleteClient,
        clientPeriods,
        clientPeriodSteps,
        clientPeriodChecklistItems,
        createClientPeriod,
        generateClientPeriodsForMonth,
        updateClientPeriodStatus,
        updateClientPeriodStep,
        updateClientPeriodChecklistItem,
        linkClientPeriodChecklistEvidence,
        updateClientPeriodChecklistPlanning,
        tasks,
        taskReviews,
        operationalComments,
        addTask,
        generateRecurringTasks,
        updateTask,
        updateTaskStatus,
        deleteTask,
        requestTaskReview,
        approveTaskReview,
        rejectTaskReview,
        createOperationalComment,
        documents,
        documentRequests,
        addDocument,
        updateDocument,
        deleteDocument,
        createDocumentRequest,
        updateDocumentRequest,
        payments,
        invoices,
        fiscalObligations,
        workspaceSettings,
        integrationConnections,
        addPayment,
        updatePayment,
        deletePayment,
        addInvoice,
        updateInvoice,
        deleteInvoice,
        generateMonthlyServiceFeeInvoices,
        addFiscalObligation,
        updateFiscalObligation,
        generateMonthlyFiscalObligations,
        updateWorkspaceSettings,
        upsertIntegrationConnection,
        processFileUpload,
        createDemoWorkspaceData,
        notifications,
        markNotificationRead,
        pipelineHistory,
        refresh: fetchAll,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within a DataProvider");
  return ctx;
};
