import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react";
import {
  ClientData,
  TaskData,
  DocumentData,
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
type ProfileTenant = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "account_type" | "company_id" | "tenant_id"
>;
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

export type WorkspaceSettingsData = WorkspaceSettingsRow;
export type IntegrationConnectionData = IntegrationConnectionRow;

const createDefaultWorkspaceSettings = (
  tid: string,
  officeName = "Lotus Accounting",
): WorkspaceSettingsData => ({
  tenant_id: tid,
  office_name: officeName,
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

const mapClient = (r: Row): ClientData => ({
  id: String(r.id),
  name: String(r.name ?? ""),
  cnpj: String(r.cnpj ?? ""),
  taxRegime: (r.tax_regime as ClientData["taxRegime"]) ?? "simples_nacional",
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
  createdAt: String(r.created_at ?? new Date().toISOString()),
  completedAt: r.completed_at ? String(r.completed_at) : null,
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

// =============================================
// Context
// =============================================

interface DataContextType {
  loading: boolean;
  tenantId: string | null;

  clients: ClientData[];
  addClient: (client: Omit<ClientData, "id" | "createdAt">) => Promise<void>;
  updateClient: (id: string, updates: Partial<ClientData>) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;

  tasks: TaskData[];
  addTask: (
    task: Omit<TaskData, "id" | "createdAt" | "completedAt">,
  ) => Promise<void>;
  updateTask: (id: string, updates: Partial<TaskData>) => Promise<void>;
  updateTaskStatus: (id: string, status: TaskStatus) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;

  documents: DocumentData[];
  addDocument: (doc: DocumentData) => Promise<void>;
  updateDocument: (id: string, updates: Partial<DocumentData>) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;

  payments: PaymentRow[];
  invoices: InvoiceRow[];
  fiscalObligations: FiscalObligationRow[];
  workspaceSettings: WorkspaceSettingsData | null;
  integrationConnections: IntegrationConnectionData[];
  addPayment: (payment: PaymentInsert) => Promise<PaymentRow | null>;
  updatePayment: (id: string, updates: Partial<PaymentRow>) => Promise<void>;
  deletePayment: (id: string) => Promise<void>;
  addInvoice: (invoice: InvoiceInsert) => Promise<InvoiceRow | null>;
  updateInvoice: (id: string, updates: Partial<InvoiceRow>) => Promise<void>;
  deleteInvoice: (id: string) => Promise<void>;
  addFiscalObligation: (
    obligation: FiscalObligationInsert,
  ) => Promise<FiscalObligationRow | null>;
  updateFiscalObligation: (
    id: string,
    updates: Partial<FiscalObligationRow>,
  ) => Promise<void>;
  generateMonthlyFiscalObligations: () => Promise<void>;
  updateWorkspaceSettings: (
    updates: WorkspaceSettingsUpdate,
  ) => Promise<WorkspaceSettingsData | null>;
  upsertIntegrationConnection: (
    integrationId: string,
    updates: IntegrationConnectionUpdate,
  ) => Promise<IntegrationConnectionData | null>;

  processFileUpload: (file: File) => Promise<void>;

  notifications: Notification[];
  markNotificationRead: (id: string) => void;

  pipelineHistory: PipelineExecution[];

  refresh: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider = ({ children }: { children: ReactNode }) => {
  const { session, user } = useAuth();

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [profileCompanyId, setProfileCompanyId] = useState<string | null>(null);
  const [accountType, setAccountType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [clients, setClients] = useState<ClientData[]>([]);
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [documents, setDocuments] = useState<DocumentData[]>([]);
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
    if (!user) {
      setClients([]);
      setTasks([]);
      setDocuments([]);
      setPayments([]);
      setInvoices([]);
      setFiscalObligations([]);
      setWorkspaceSettings(null);
      setIntegrationConnections([]);
      setTenantId(null);
      setProfileCompanyId(null);
      setAccountType(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Resolve tenant from profile
    const { data: prof } = await supabase
      .from("profiles")
      .select("tenant_id, company_id, account_type")
      .eq("user_id", user.id)
      .maybeSingle();

    const profile = prof as ProfileTenant | null;
    const tid = profile?.tenant_id ?? null;
    setTenantId(tid);
    setProfileCompanyId(profile?.company_id ?? null);
    setAccountType(profile?.account_type ?? null);

    if (!tid) {
      setClients([]);
      setTasks([]);
      setDocuments([]);
      setPayments([]);
      setInvoices([]);
      setFiscalObligations([]);
      setWorkspaceSettings(null);
      setIntegrationConnections([]);
      setProfileCompanyId(null);
      setAccountType(null);
      setLoading(false);
      return;
    }

    const [
      companiesRes,
      tasksRes,
      docsRes,
      paymentsRes,
      invoicesRes,
      fiscalObligationsRes,
      workspaceSettingsRes,
      integrationConnectionsRes,
    ] = await Promise.all([
      supabase
        .from("companies")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("tasks").select("*").order("due_date", { ascending: true }),
      supabase
        .from("documents")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("payments")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("invoices")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("fiscal_obligations")
        .select("*")
        .order("due_date", { ascending: true }),
      supabase.from("workspace_settings").select("*").maybeSingle(),
      listIntegrationConnections(),
    ]);

    const clientList = (companiesRes.data ?? []).map(mapClient);
    const clientsById = new Map(clientList.map((c) => [c.id, c]));

    setClients(clientList);
    setTasks(
      sortTasks(
        computeTaskStatuses(
          (tasksRes.data ?? []).map((r) => mapTask(r, clientsById)),
        ),
      ),
    );
    setDocuments((docsRes.data ?? []).map((r) => mapDocument(r, clientsById)));
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
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (session === null && !user) {
      // not logged in
      setClients([]);
      setTasks([]);
      setDocuments([]);
      setPayments([]);
      setInvoices([]);
      setFiscalObligations([]);
      setWorkspaceSettings(null);
      setIntegrationConnections([]);
      setTenantId(null);
      setProfileCompanyId(null);
      setAccountType(null);
      setLoading(false);
      return;
    }
    void fetchAll();
  }, [session, user, fetchAll]);

  // -------- Clients --------
  const addClient = useCallback(
    async (client: Omit<ClientData, "id" | "createdAt">) => {
      if (!tenantId) {
        toast.error("Tenant não encontrado");
        return;
      }
      const { data, error } = await supabase
        .from("companies")
        .insert({
          tenant_id: tenantId,
          name: client.name,
          cnpj: client.cnpj || null,
          email: client.email || null,
          phone: client.phone || null,
          tax_regime: client.taxRegime,
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
        toast.error("Erro ao adicionar cliente: " + error.message);
        return;
      }
      if (data) setClients((prev) => [mapClient(data), ...prev]);
    },
    [tenantId],
  );

  const updateClient = useCallback(
    async (id: string, updates: Partial<ClientData>) => {
      const patch: Row = {};
      if (updates.name !== undefined) patch.name = updates.name;
      if (updates.cnpj !== undefined) patch.cnpj = updates.cnpj;
      if (updates.email !== undefined) patch.email = updates.email;
      if (updates.phone !== undefined) patch.phone = updates.phone;
      if (updates.taxRegime !== undefined) patch.tax_regime = updates.taxRegime;
      if (updates.serviceFee !== undefined)
        patch.service_fee = updates.serviceFee;
      if (updates.city !== undefined) patch.city = updates.city;
      if (updates.state !== undefined) patch.state = updates.state;
      if (updates.status !== undefined) patch.status = updates.status;
      if (updates.responsibleUserId !== undefined)
        patch.responsible_user_id = asUuid(updates.responsibleUserId);
      if (updates.responsibleUserName !== undefined)
        patch.responsible_user_name = updates.responsibleUserName;

      setClients((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...updates } : c)),
      );
      if (Object.keys(patch).length) {
        const { error } = await supabase
          .from("companies")
          .update(patch)
          .eq("id", id);
        if (error) toast.error("Erro ao atualizar cliente: " + error.message);
      }
    },
    [],
  );

  const deleteClient = useCallback(async (id: string) => {
    setClients((prev) => prev.filter((c) => c.id !== id));
    const { error } = await supabase.from("companies").delete().eq("id", id);
    if (error) toast.error("Erro ao remover cliente: " + error.message);
  }, []);

  // -------- Tasks --------
  const addTask = useCallback(
    async (task: Omit<TaskData, "id" | "createdAt" | "completedAt">) => {
      if (!tenantId) {
        toast.error("Tenant não encontrado");
        return;
      }
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          tenant_id: tenantId,
          title: task.title,
          description: task.description || null,
          task_type: task.type,
          status: task.status,
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
        return;
      }
      if (data) {
        const clientsById = new Map(clients.map((c) => [c.id, c]));
        const mapped = mapTask(data, clientsById);
        mapped.assignedToName = task.assignedToName;
        setTasks((prev) => sortTasks(computeTaskStatuses([mapped, ...prev])));
      }
    },
    [tenantId, user, clients],
  );

  const updateTask = useCallback(
    async (id: string, updates: Partial<TaskData>) => {
      const patch: Row = {};
      if (updates.title !== undefined) patch.title = updates.title;
      if (updates.description !== undefined)
        patch.description = updates.description;
      if (updates.type !== undefined) patch.task_type = updates.type;
      if (updates.status !== undefined) patch.status = updates.status;
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

      setTasks((prev) =>
        sortTasks(prev.map((t) => (t.id === id ? { ...t, ...updates } : t))),
      );
      if (Object.keys(patch).length) {
        const { error } = await supabase
          .from("tasks")
          .update(patch)
          .eq("id", id);
        if (error) toast.error("Erro ao atualizar tarefa: " + error.message);
      }
    },
    [],
  );

  const updateTaskStatus = useCallback(
    async (id: string, status: TaskStatus) => {
      const completedAt =
        status === "completed" ? new Date().toISOString() : null;
      setTasks((prev) =>
        sortTasks(
          prev.map((t) => (t.id === id ? { ...t, status, completedAt } : t)),
        ),
      );
      const { error } = await supabase
        .from("tasks")
        .update({ status, completed_at: completedAt })
        .eq("id", id);
      if (error) toast.error("Erro ao atualizar status: " + error.message);
    },
    [],
  );

  const deleteTask = useCallback(async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) toast.error("Erro ao remover tarefa: " + error.message);
  }, []);

  // -------- Documents --------
  const persistDocument = useCallback(
    async (doc: DocumentData) => {
      if (!tenantId) return doc;
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
        return doc;
      }
      if (data) {
        const clientsById = new Map(clients.map((c) => [c.id, c]));
        return mapDocument(data, clientsById);
      }
      return doc;
    },
    [tenantId, user, clients],
  );

  const addDocument = useCallback(
    async (doc: DocumentData) => {
      const saved = await persistDocument(doc);
      setDocuments((prev) => [saved, ...prev]);
    },
    [persistDocument],
  );

  const updateDocument = useCallback(
    async (id: string, updates: Partial<DocumentData>) => {
      const patch: Row = {};
      if (updates.name !== undefined) patch.name = updates.name;
      if (updates.documentType !== undefined)
        patch.document_type = updates.documentType;
      if (updates.status !== undefined) patch.status = updates.status;
      if (updates.clientId !== undefined)
        patch.company_id = asUuid(updates.clientId);
      if (updates.amount !== undefined) patch.amount = updates.amount;
      if (updates.readAt !== undefined) patch.read_at = updates.readAt;

      setDocuments((prev) =>
        prev.map((d) => (d.id === id ? { ...d, ...updates } : d)),
      );
      if (Object.keys(patch).length) {
        const { error } = await supabase
          .from("documents")
          .update(patch)
          .eq("id", id);
        if (error) toast.error("Erro ao atualizar documento: " + error.message);
      }
    },
    [],
  );

  const deleteDocument = useCallback(async (id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (error) toast.error("Erro ao remover documento: " + error.message);
  }, []);

  // -------- Payments --------
  const addPayment = useCallback(
    async (payment: PaymentInsert) => {
      if (!tenantId) {
        toast.error("Tenant não encontrado");
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
      return (data as PaymentRow | null) ?? null;
    },
    [tenantId],
  );

  const updatePayment = useCallback(
    async (id: string, updates: Partial<PaymentRow>) => {
      setPayments((prev) =>
        prev.map((payment) =>
          payment.id === id ? { ...payment, ...updates } : payment,
        ),
      );
      const { error } = await supabase
        .from("payments")
        .update(updates)
        .eq("id", id);
      if (error) {
        toast.error("Erro ao atualizar pagamento: " + error.message);
        void fetchAll();
      }
    },
    [fetchAll],
  );

  const deletePayment = useCallback(
    async (id: string) => {
      setPayments((prev) => prev.filter((payment) => payment.id !== id));
      const { error } = await supabase.from("payments").delete().eq("id", id);
      if (error) {
        toast.error("Erro ao remover pagamento: " + error.message);
        void fetchAll();
      }
    },
    [fetchAll],
  );

  // -------- Invoices --------
  const addInvoice = useCallback(
    async (invoice: InvoiceInsert) => {
      if (!tenantId) {
        toast.error("Tenant não encontrado");
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
    [tenantId],
  );

  const updateInvoice = useCallback(
    async (id: string, updates: Partial<InvoiceRow>) => {
      setInvoices((prev) =>
        prev.map((invoice) =>
          invoice.id === id ? { ...invoice, ...updates } : invoice,
        ),
      );
      const { error } = await supabase
        .from("invoices")
        .update(updates)
        .eq("id", id);
      if (error) {
        toast.error("Erro ao atualizar fatura: " + error.message);
        void fetchAll();
      }
    },
    [fetchAll],
  );

  const deleteInvoice = useCallback(
    async (id: string) => {
      setInvoices((prev) => prev.filter((invoice) => invoice.id !== id));
      const { error } = await supabase.from("invoices").delete().eq("id", id);
      if (error) {
        toast.error("Erro ao remover fatura: " + error.message);
        void fetchAll();
      }
    },
    [fetchAll],
  );

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
      const patch = {
        ...updates,
        completed_at:
          updates.status === "completed"
            ? (updates.completed_at ?? new Date().toISOString())
            : updates.status && updates.status !== "completed"
              ? null
              : updates.completed_at,
      };
      setFiscalObligations((prev) =>
        prev.map((obligation) =>
          obligation.id === id ? { ...obligation, ...patch } : obligation,
        ),
      );
      const { error } = await supabase
        .from("fiscal_obligations")
        .update(patch)
        .eq("id", id);
      if (error) {
        toast.error("Erro ao atualizar obrigação fiscal: " + error.message);
        void fetchAll();
      }
    },
    [fetchAll],
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
    const templates: Record<
      ClientData["taxRegime"],
      { name: string; day: number; recurrence: string; priority: string }[]
    > = {
      simples_nacional: [
        {
          name: "DAS - Simples Nacional",
          day: 20,
          recurrence: "monthly",
          priority: "high",
        },
      ],
      mei: [
        { name: "DAS-MEI", day: 20, recurrence: "monthly", priority: "medium" },
      ],
      lucro_presumido: [
        {
          name: "DARF IRPJ/CSLL",
          day: 25,
          recurrence: "monthly",
          priority: "high",
        },
        {
          name: "EFD Contribuições",
          day: 15,
          recurrence: "monthly",
          priority: "medium",
        },
      ],
      lucro_real: [
        {
          name: "DARF IRPJ/CSLL",
          day: 30,
          recurrence: "monthly",
          priority: "high",
        },
        {
          name: "SPED Fiscal",
          day: 25,
          recurrence: "monthly",
          priority: "high",
        },
      ],
    };

    const existingKeys = new Set(
      fiscalObligations.map(
        (item) =>
          `${item.company_id}-${item.name}-${item.period_month}-${item.period_year}`,
      ),
    );
    const dueDateForDay = (day: number) => {
      const lastDay = new Date(periodYear, periodMonth, 0).getDate();
      return `${periodYear}-${String(periodMonth).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
    };
    const inserts = activeClients.flatMap((client) =>
      (templates[client.taxRegime] ?? []).flatMap((template) => {
        const key = `${client.id}-${template.name}-${periodMonth}-${periodYear}`;
        if (existingKeys.has(key)) return [];
        return {
          company_id: client.id,
          name: template.name,
          description: `Obrigação gerada para ${client.name} no período ${String(periodMonth).padStart(2, "0")}/${periodYear}.`,
          due_date: dueDateForDay(template.day),
          period_month: periodMonth,
          period_year: periodYear,
          priority: template.priority,
          recurrence: template.recurrence,
          status: "pending",
          tax_regime: client.taxRegime,
        };
      }),
    );

    if (inserts.length === 0) {
      toast.info("As obrigações deste mês já estão geradas");
      return;
    }

    const { data, error } = await supabase
      .from("fiscal_obligations")
      .insert(
        inserts.map((item) => ({
          ...item,
          tenant_id: tenantId,
          created_by: user?.id ?? null,
        })),
      )
      .select("*");
    if (error) {
      toast.error("Erro ao gerar obrigações: " + error.message);
      return;
    }
    setFiscalObligations((prev) =>
      [...((data ?? []) as FiscalObligationRow[]), ...prev].sort((a, b) =>
        String(a.due_date).localeCompare(String(b.due_date)),
      ),
    );
    toast.success(`${data?.length ?? 0} obrigações fiscais geradas`);
  }, [accountType, clients, fiscalObligations, tenantId, user]);

  // -------- Workspace settings and integrations --------
  const updateWorkspaceSettings = useCallback(
    async (updates: WorkspaceSettingsUpdate) => {
      if (!tenantId) {
        toast.error("Tenant não encontrado");
        return null;
      }
      if (accountType === "client") {
        toast.error("Seu perfil não pode alterar configurações do workspace");
        return null;
      }

      const next = {
        ...(workspaceSettings ?? createDefaultWorkspaceSettings(tenantId)),
        ...updates,
        tenant_id: tenantId,
        updated_by: user?.id ?? null,
      } as WorkspaceSettingsData;
      setWorkspaceSettings(next);

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
    [accountType, fetchAll, tenantId, user, workspaceSettings],
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

      const existing = integrationConnections.find(
        (item) => item.integration_id === integrationId,
      );
      const optimistic = {
        ...(existing ?? {
          id: crypto.randomUUID(),
          tenant_id: tenantId,
          integration_id: integrationId,
          provider: integrationId,
          status: "disconnected",
          account_label: null,
          config: {},
          credentials: [],
          provider_account_id: null,
          provider_account_name: null,
          scopes: [],
          expires_at: null,
          last_error_at: null,
          credential_reference: null,
          metadata: {},
          usage: { calls: 0, limit: 0, period: "" },
          last_sync_at: null,
          connected_at: null,
          created_by: null,
          updated_by: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
        ...updates,
        tenant_id: tenantId,
        integration_id: integrationId,
        updated_by: user?.id ?? null,
      } as IntegrationConnectionData;

      setIntegrationConnections((prev) => {
        const without = prev.filter(
          (item) => item.integration_id !== integrationId,
        );
        return [...without, optimistic].sort((a, b) =>
          a.integration_id.localeCompare(b.integration_id),
        );
      });

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
    [accountType, fetchAll, integrationConnections, tenantId, user],
  );

  // -------- Pipeline (file upload) --------
  const processFileUpload = useCallback(
    async (file: File) => {
      if (!tenantId) {
        toast.error("Tenant não encontrado para salvar o arquivo");
        return;
      }

      const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = `${tenantId}/${crypto.randomUUID()}-${safeFileName}`;
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

      const result = executeDocumentPipeline(file.name, clients, {
        filePath,
        fileSize: file.size,
        mimeType: file.type || null,
      });

      if (
        accountType === "client" &&
        profileCompanyId &&
        !result.document.clientId
      ) {
        const ownClient = clients.find(
          (client) => client.id === profileCompanyId,
        );
        result.document.clientId = profileCompanyId;
        result.document.clientName = ownClient?.name ?? "Minha empresa";
      }

      if (accountType === "client" && !result.document.clientId) {
        toast.error("Seu perfil ainda não está vinculado a uma empresa");
        return;
      }

      const saved = await persistDocument(result.document);
      setDocuments((prev) => [saved, ...prev]);
      setPipelineHistory((prev) => [result.pipeline, ...prev]);
      if (result.notifications.length)
        setNotifications((prev) => [...result.notifications, ...prev]);

      const needsReview =
        !saved.clientId ||
        saved.documentType === "outros" ||
        saved.classificationConfidence < 0.7;
      if (needsReview) {
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
      persistDocument,
      profileCompanyId,
      tenantId,
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
        tenantId,
        clients,
        addClient,
        updateClient,
        deleteClient,
        tasks,
        addTask,
        updateTask,
        updateTaskStatus,
        deleteTask,
        documents,
        addDocument,
        updateDocument,
        deleteDocument,
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
        addFiscalObligation,
        updateFiscalObligation,
        generateMonthlyFiscalObligations,
        updateWorkspaceSettings,
        upsertIntegrationConnection,
        processFileUpload,
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
