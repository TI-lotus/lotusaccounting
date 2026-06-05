import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

// =============================================
// Mappers DB <-> UI
// =============================================

type Row = Record<string, any>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const asUuid = (v: string | null | undefined): string | null => (v && UUID_RE.test(v) ? v : null);

const mapClient = (r: Row): ClientData => ({
  id: r.id,
  name: r.name ?? "",
  cnpj: r.cnpj ?? "",
  taxRegime: (r.tax_regime as ClientData["taxRegime"]) ?? "simples_nacional",
  responsibleUserId: r.responsible_user_id ?? "",
  responsibleUserName: r.responsible_user_name ?? "",
  serviceFee: Number(r.service_fee ?? 0),
  city: r.city ?? "",
  state: r.state ?? "",
  status: (r.status as ClientData["status"]) ?? "active",
  email: r.email ?? "",
  phone: r.phone ?? "",
  createdAt: r.created_at ?? new Date().toISOString(),
});

const mapTask = (r: Row, clientsById: Map<string, ClientData>): TaskData => ({
  id: r.id,
  title: r.title ?? "",
  description: r.description ?? "",
  type: (r.task_type as TaskData["type"]) ?? "one_time",
  status: (r.status as TaskStatus) ?? "pending",
  priority: (r.priority as TaskData["priority"]) ?? "medium",
  dueDate: r.due_date ?? new Date().toISOString(),
  category: r.category ?? "Geral",
  clientId: r.company_id ?? null,
  clientName: r.company_id ? clientsById.get(r.company_id)?.name ?? null : null,
  assignedToId: r.assigned_to ?? "",
  assignedToName: r.assigned_to_name ?? "Sem responsável",
  createdAt: r.created_at ?? new Date().toISOString(),
  completedAt: r.completed_at ?? null,
});

const mapDocument = (r: Row, clientsById: Map<string, ClientData>): DocumentData => ({
  id: r.id,
  name: r.name ?? r.original_file_name ?? "Documento",
  originalFileName: r.original_file_name ?? r.name ?? "",
  documentType: (r.document_type as DocumentData["documentType"]) ?? "outros",
  status: (r.status as DocumentData["status"]) ?? "pending",
  clientId: r.company_id ?? null,
  clientName: r.company_id ? clientsById.get(r.company_id)?.name ?? null : null,
  amount: r.amount != null ? Number(r.amount) : null,
  date: r.doc_date ?? (r.created_at ? new Date(r.created_at).toLocaleDateString("pt-BR") : ""),
  month: r.month ?? new Date(r.created_at ?? Date.now()).getMonth() + 1,
  year: r.year ?? new Date(r.created_at ?? Date.now()).getFullYear(),
  readAt: r.read_at ?? null,
  createdAt: r.created_at ?? new Date().toISOString(),
  classifiedAutomatically: !!r.classified_automatically,
  classificationConfidence: Number(r.classification_confidence ?? 0),
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
  addTask: (task: Omit<TaskData, "id" | "createdAt" | "completedAt">) => Promise<void>;
  updateTask: (id: string, updates: Partial<TaskData>) => Promise<void>;
  updateTaskStatus: (id: string, status: TaskStatus) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;

  documents: DocumentData[];
  addDocument: (doc: DocumentData) => Promise<void>;
  updateDocument: (id: string, updates: Partial<DocumentData>) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;

  processFileUpload: (fileName: string) => Promise<void>;

  notifications: Notification[];
  markNotificationRead: (id: string) => void;

  pipelineHistory: PipelineExecution[];

  refresh: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider = ({ children }: { children: ReactNode }) => {
  const { session, user } = useAuth();

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [clients, setClients] = useState<ClientData[]>([]);
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [documents, setDocuments] = useState<DocumentData[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [pipelineHistory, setPipelineHistory] = useState<PipelineExecution[]>([]);

  // -------- Fetch all --------
  const fetchAll = useCallback(async () => {
    if (!user) {
      setClients([]); setTasks([]); setDocuments([]); setTenantId(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Resolve tenant from profile
    const { data: prof } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const tid = (prof as any)?.tenant_id ?? null;
    setTenantId(tid);

    if (!tid) {
      setClients([]); setTasks([]); setDocuments([]);
      setLoading(false);
      return;
    }

    const [companiesRes, tasksRes, docsRes] = await Promise.all([
      supabase.from("companies").select("*").order("created_at", { ascending: false }),
      supabase.from("tasks").select("*").order("due_date", { ascending: true }),
      supabase.from("documents").select("*").order("created_at", { ascending: false }),
    ]);

    const clientList = (companiesRes.data ?? []).map(mapClient);
    const clientsById = new Map(clientList.map((c) => [c.id, c]));

    setClients(clientList);
    setTasks(sortTasks(computeTaskStatuses((tasksRes.data ?? []).map((r) => mapTask(r, clientsById)))));
    setDocuments((docsRes.data ?? []).map((r) => mapDocument(r, clientsById)));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (session === null && !user) {
      // not logged in
      setClients([]); setTasks([]); setDocuments([]); setTenantId(null); setLoading(false);
      return;
    }
    void fetchAll();
  }, [session, user, fetchAll]);

  // -------- Clients --------
  const addClient = useCallback(async (client: Omit<ClientData, "id" | "createdAt">) => {
    if (!tenantId) { toast.error("Tenant não encontrado"); return; }
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
        responsible_user_id: client.responsibleUserId || null,
      })
      .select("*")
      .maybeSingle();
    if (error) { toast.error("Erro ao adicionar cliente: " + error.message); return; }
    if (data) setClients((prev) => [mapClient(data), ...prev]);
  }, [tenantId]);

  const updateClient = useCallback(async (id: string, updates: Partial<ClientData>) => {
    const patch: Row = {};
    if (updates.name !== undefined) patch.name = updates.name;
    if (updates.cnpj !== undefined) patch.cnpj = updates.cnpj;
    if (updates.email !== undefined) patch.email = updates.email;
    if (updates.phone !== undefined) patch.phone = updates.phone;
    if (updates.taxRegime !== undefined) patch.tax_regime = updates.taxRegime;
    if (updates.serviceFee !== undefined) patch.service_fee = updates.serviceFee;
    if (updates.city !== undefined) patch.city = updates.city;
    if (updates.state !== undefined) patch.state = updates.state;
    if (updates.status !== undefined) patch.status = updates.status;
    if (updates.responsibleUserId !== undefined) patch.responsible_user_id = updates.responsibleUserId || null;

    setClients((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
    if (Object.keys(patch).length) {
      const { error } = await supabase.from("companies").update(patch).eq("id", id);
      if (error) toast.error("Erro ao atualizar cliente: " + error.message);
    }
  }, []);

  const deleteClient = useCallback(async (id: string) => {
    setClients((prev) => prev.filter((c) => c.id !== id));
    const { error } = await supabase.from("companies").delete().eq("id", id);
    if (error) toast.error("Erro ao remover cliente: " + error.message);
  }, []);

  // -------- Tasks --------
  const addTask = useCallback(async (task: Omit<TaskData, "id" | "createdAt" | "completedAt">) => {
    if (!tenantId) { toast.error("Tenant não encontrado"); return; }
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
        company_id: task.clientId || null,
        assigned_to: task.assignedToId || null,
        created_by: user?.id ?? null,
      })
      .select("*")
      .maybeSingle();
    if (error) { toast.error("Erro ao criar tarefa: " + error.message); return; }
    if (data) {
      const clientsById = new Map(clients.map((c) => [c.id, c]));
      const mapped = mapTask(data, clientsById);
      mapped.assignedToName = task.assignedToName;
      setTasks((prev) => sortTasks(computeTaskStatuses([mapped, ...prev])));
    }
  }, [tenantId, user, clients]);

  const updateTask = useCallback(async (id: string, updates: Partial<TaskData>) => {
    const patch: Row = {};
    if (updates.title !== undefined) patch.title = updates.title;
    if (updates.description !== undefined) patch.description = updates.description;
    if (updates.type !== undefined) patch.task_type = updates.type;
    if (updates.status !== undefined) patch.status = updates.status;
    if (updates.priority !== undefined) patch.priority = updates.priority;
    if (updates.dueDate !== undefined) patch.due_date = new Date(updates.dueDate).toISOString();
    if (updates.category !== undefined) patch.category = updates.category;
    if (updates.clientId !== undefined) patch.company_id = updates.clientId || null;
    if (updates.assignedToId !== undefined) patch.assigned_to = updates.assignedToId || null;
    if (updates.completedAt !== undefined) patch.completed_at = updates.completedAt;

    setTasks((prev) => sortTasks(prev.map((t) => (t.id === id ? { ...t, ...updates } : t))));
    if (Object.keys(patch).length) {
      const { error } = await supabase.from("tasks").update(patch).eq("id", id);
      if (error) toast.error("Erro ao atualizar tarefa: " + error.message);
    }
  }, []);

  const updateTaskStatus = useCallback(async (id: string, status: TaskStatus) => {
    const completedAt = status === "completed" ? new Date().toISOString() : null;
    setTasks((prev) => sortTasks(prev.map((t) => (t.id === id ? { ...t, status, completedAt } : t))));
    const { error } = await supabase.from("tasks").update({ status, completed_at: completedAt }).eq("id", id);
    if (error) toast.error("Erro ao atualizar status: " + error.message);
  }, []);

  const deleteTask = useCallback(async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) toast.error("Erro ao remover tarefa: " + error.message);
  }, []);

  // -------- Documents --------
  const persistDocument = useCallback(async (doc: DocumentData) => {
    if (!tenantId) return doc;
    const { data, error } = await supabase
      .from("documents")
      .insert({
        tenant_id: tenantId,
        company_id: doc.clientId,
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
      })
      .select("*")
      .maybeSingle();
    if (error) { toast.error("Erro ao salvar documento: " + error.message); return doc; }
    if (data) {
      const clientsById = new Map(clients.map((c) => [c.id, c]));
      return mapDocument(data, clientsById);
    }
    return doc;
  }, [tenantId, user, clients]);

  const addDocument = useCallback(async (doc: DocumentData) => {
    const saved = await persistDocument(doc);
    setDocuments((prev) => [saved, ...prev]);
  }, [persistDocument]);

  const updateDocument = useCallback(async (id: string, updates: Partial<DocumentData>) => {
    const patch: Row = {};
    if (updates.name !== undefined) patch.name = updates.name;
    if (updates.documentType !== undefined) patch.document_type = updates.documentType;
    if (updates.status !== undefined) patch.status = updates.status;
    if (updates.clientId !== undefined) patch.company_id = updates.clientId;
    if (updates.amount !== undefined) patch.amount = updates.amount;
    if (updates.readAt !== undefined) patch.read_at = updates.readAt;

    setDocuments((prev) => prev.map((d) => (d.id === id ? { ...d, ...updates } : d)));
    if (Object.keys(patch).length) {
      const { error } = await supabase.from("documents").update(patch).eq("id", id);
      if (error) toast.error("Erro ao atualizar documento: " + error.message);
    }
  }, []);

  const deleteDocument = useCallback(async (id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (error) toast.error("Erro ao remover documento: " + error.message);
  }, []);

  // -------- Pipeline (file upload simulation) --------
  const processFileUpload = useCallback(async (fileName: string) => {
    const result = executeDocumentPipeline(fileName, clients);
    const saved = await persistDocument(result.document);
    setDocuments((prev) => [saved, ...prev]);
    setPipelineHistory((prev) => [result.pipeline, ...prev]);
    if (result.notifications.length) setNotifications((prev) => [...result.notifications, ...prev]);

    if (saved.clientName) {
      toast.success(`Documento classificado como "${saved.documentType}" e associado a ${saved.clientName}`, {
        description: `Confiança: ${Math.round(saved.classificationConfidence * 100)}%`,
      });
    } else {
      toast.info(`Documento classificado como "${saved.documentType}" — cliente não identificado`);
    }
  }, [clients, persistDocument]);

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  return (
    <DataContext.Provider value={{
      loading, tenantId,
      clients, addClient, updateClient, deleteClient,
      tasks, addTask, updateTask, updateTaskStatus, deleteTask,
      documents, addDocument, updateDocument, deleteDocument,
      processFileUpload,
      notifications, markNotificationRead,
      pipelineHistory,
      refresh: fetchAll,
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within a DataProvider");
  return ctx;
};
