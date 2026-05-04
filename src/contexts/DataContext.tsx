import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import {
  ClientData,
  TaskData,
  DocumentData,
  Notification,
  PipelineExecution,
  TaskStatus,
  DocumentType,
} from "@/types";
import { computeTaskStatuses, sortTasks, filterTasks } from "@/lib/taskUtils";
import { executeDocumentPipeline } from "@/lib/workflowPipeline";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// =============================================
// Mock Data
// =============================================

const mockClients: ClientData[] = [
  { id: "c1", name: "Acme Corporation", cnpj: "12.345.678/0001-90", taxRegime: "lucro_presumido", responsibleUserId: "u2", responsibleUserName: "Ana Costa", serviceFee: 2500, city: "São Paulo", state: "SP", status: "active", email: "billing@acme.com", phone: "(11) 99999-1234", createdAt: "2024-01-15" },
  { id: "c2", name: "TechStart Inc", cnpj: "23.456.789/0001-01", taxRegime: "simples_nacional", responsibleUserId: "u3", responsibleUserName: "Roberto Santos", serviceFee: 1800, city: "São Paulo", state: "SP", status: "active", email: "finance@techstart.io", phone: "(11) 98888-5678", createdAt: "2024-03-01" },
  { id: "c3", name: "Global Finance Ltd", cnpj: "34.567.890/0001-12", taxRegime: "lucro_real", responsibleUserId: "u2", responsibleUserName: "Ana Costa", serviceFee: 4500, city: "Rio de Janeiro", state: "RJ", status: "pending", email: "accounts@globalfinance.com", phone: "(21) 97777-9012", createdAt: "2024-05-10" },
  { id: "c4", name: "Innovation Labs", cnpj: "45.678.901/0001-23", taxRegime: "simples_nacional", responsibleUserId: "u4", responsibleUserName: "Carlos Mendes", serviceFee: 1200, city: "São Paulo", state: "SP", status: "active", email: "hello@innovationlabs.co", phone: "(11) 96666-3456", createdAt: "2024-06-20" },
  { id: "c5", name: "Sunrise Media", cnpj: "56.789.012/0001-34", taxRegime: "mei", responsibleUserId: "u3", responsibleUserName: "Roberto Santos", serviceFee: 600, city: "Belo Horizonte", state: "MG", status: "inactive", email: "billing@sunrisemedia.net", phone: "(31) 95555-7890", createdAt: "2023-11-05" },
  { id: "c6", name: "DataFlow Systems", cnpj: "67.890.123/0001-45", taxRegime: "lucro_presumido", responsibleUserId: "u2", responsibleUserName: "Ana Costa", serviceFee: 3200, city: "São Paulo", state: "SP", status: "active", email: "contato@dataflow.com.br", phone: "(11) 94444-1234", createdAt: "2024-02-14" },
  { id: "c7", name: "Verde Soluções", cnpj: "78.901.234/0001-56", taxRegime: "simples_nacional", responsibleUserId: "u4", responsibleUserName: "Carlos Mendes", serviceFee: 1500, city: "Campinas", state: "SP", status: "active", email: "financeiro@verdesolucoes.com", phone: "(19) 93333-5678", createdAt: "2024-04-01" },
  { id: "c8", name: "Nexus Tecnologia", cnpj: "89.012.345/0001-67", taxRegime: "lucro_presumido", responsibleUserId: "u2", responsibleUserName: "Ana Costa", serviceFee: 2800, city: "São Paulo", state: "SP", status: "pending", email: "admin@nexustec.io", phone: "(11) 92222-9012", createdAt: "2024-07-15" },
];

const mockTasks: TaskData[] = [
  { id: "t1", title: "Enviar documentos fiscais", description: "Enviar notas fiscais do mês de janeiro para o contador", type: "monthly", status: "pending", priority: "high", dueDate: "2026-02-05", category: "Documentos", clientId: "c1", clientName: "Acme Corporation", assignedToId: "u2", assignedToName: "Ana Costa", createdAt: "2026-01-15", completedAt: null },
  { id: "t2", title: "Revisar relatório mensal", description: "Verificar e aprovar o relatório financeiro de dezembro", type: "monthly", status: "in_progress", priority: "medium", dueDate: "2026-02-10", category: "Relatórios", clientId: "c2", clientName: "TechStart Inc", assignedToId: "u3", assignedToName: "Roberto Santos", createdAt: "2026-01-20", completedAt: null },
  { id: "t3", title: "Atualizar dados cadastrais", description: "Atualizar endereço e telefone da empresa no sistema", type: "one_time", status: "completed", priority: "low", dueDate: "2026-01-28", category: "Cadastro", clientId: "c4", clientName: "Innovation Labs", assignedToId: "u4", assignedToName: "Carlos Mendes", createdAt: "2026-01-10", completedAt: "2026-01-25" },
  { id: "t4", title: "Aprovar fatura pendente", description: "Verificar e aprovar fatura #INV-2024-0089", type: "monthly", status: "overdue", priority: "high", dueDate: "2026-01-03", category: "Pagamentos", clientId: "c3", clientName: "Global Finance Ltd", assignedToId: "u2", assignedToName: "Ana Costa", createdAt: "2025-12-28", completedAt: null },
  { id: "t5", title: "Assinar contrato de serviço", description: "Assinar digitalmente o novo contrato de prestação de serviços", type: "one_time", status: "pending", priority: "medium", dueDate: "2026-02-08", category: "Contratos", clientId: "c6", clientName: "DataFlow Systems", assignedToId: "u3", assignedToName: "Roberto Santos", createdAt: "2026-01-22", completedAt: null },
  { id: "t6", title: "Responder questionário fiscal", description: "Preencher questionário sobre atividades da empresa para declaração anual", type: "annual", status: "in_progress", priority: "high", dueDate: "2026-02-15", category: "Fiscal", clientId: "c1", clientName: "Acme Corporation", assignedToId: "u2", assignedToName: "Ana Costa", createdAt: "2026-01-18", completedAt: null },
  { id: "t7", title: "Declaração IRPJ", description: "Preparar e enviar declaração de imposto de renda pessoa jurídica", type: "annual", status: "pending", priority: "high", dueDate: "2026-03-31", category: "Fiscal", clientId: "c6", clientName: "DataFlow Systems", assignedToId: "u2", assignedToName: "Ana Costa", createdAt: "2026-01-05", completedAt: null },
  { id: "t8", title: "Enviar DAS mensal", description: "Gerar e enviar guia DAS do Simples Nacional", type: "monthly", status: "pending", priority: "medium", dueDate: "2026-02-20", category: "Fiscal", clientId: "c7", clientName: "Verde Soluções", assignedToId: "u4", assignedToName: "Carlos Mendes", createdAt: "2026-02-01", completedAt: null },
  { id: "t9", title: "Conciliação bancária", description: "Realizar conciliação bancária mensal", type: "monthly", status: "pending", priority: "medium", dueDate: "2026-02-15", category: "Financeiro", clientId: "c8", clientName: "Nexus Tecnologia", assignedToId: "u3", assignedToName: "Roberto Santos", createdAt: "2026-02-01", completedAt: null },
  { id: "t10", title: "Entrega SPED Fiscal", description: "Preparar e transmitir o SPED Fiscal do período", type: "monthly", status: "overdue", priority: "high", dueDate: "2026-01-15", category: "Fiscal", clientId: "c3", clientName: "Global Finance Ltd", assignedToId: "u2", assignedToName: "Ana Costa", createdAt: "2025-12-20", completedAt: null },
];

const now = new Date();
const currentMonth = now.getMonth() + 1;
const currentYear = now.getFullYear();

const mockDocuments: DocumentData[] = [
  { id: "d1", name: "Fatura #1234", originalFileName: "fatura_1234_acme.pdf", documentType: "fatura", status: "paid", clientId: "c1", clientName: "Acme Corporation", amount: 12500, date: "12 Jan, 2026", month: 1, year: 2026, readAt: "2026-01-12", createdAt: "2026-01-12", classifiedAutomatically: true, classificationConfidence: 0.9 },
  { id: "d2", name: "Fatura #1231", originalFileName: "fatura_1231_techstart.pdf", documentType: "fatura", status: "pending", clientId: "c2", clientName: "TechStart Inc", amount: 8750, date: "10 Jan, 2026", month: 1, year: 2026, readAt: null, createdAt: "2026-01-10", classifiedAutomatically: true, classificationConfidence: 0.9 },
  { id: "d3", name: "Relatório Financeiro Q4", originalFileName: "relatorio_financeiro_q4.pdf", documentType: "relatorio", status: "read", clientId: null, clientName: "Interno", amount: null, date: "5 Jan, 2026", month: 1, year: 2026, readAt: "2026-01-06", createdAt: "2026-01-05", classifiedAutomatically: true, classificationConfidence: 0.8 },
  { id: "d4", name: "Fatura #1228", originalFileName: "fat_1228_globalfinance.pdf", documentType: "fatura", status: "paid", clientId: "c3", clientName: "Global Finance Ltd", amount: 15000, date: "9 Jan, 2026", month: 1, year: 2026, readAt: "2026-01-09", createdAt: "2026-01-09", classifiedAutomatically: true, classificationConfidence: 0.9 },
  { id: "d5", name: "Fatura #1220", originalFileName: "fatura_1220_acme.pdf", documentType: "fatura", status: "overdue", clientId: "c1", clientName: "Acme Corporation", amount: 5200, date: "28 Dez, 2025", month: 12, year: 2025, readAt: null, createdAt: "2025-12-28", classifiedAutomatically: true, classificationConfidence: 0.9 },
  { id: "d6", name: "Fatura #1215", originalFileName: "fatura_1215_dataflow.pdf", documentType: "fatura", status: "paid", clientId: "c6", clientName: "DataFlow Systems", amount: 22000, date: "20 Dez, 2025", month: 12, year: 2025, readAt: "2025-12-21", createdAt: "2025-12-20", classifiedAutomatically: true, classificationConfidence: 0.9 },
  { id: "d7", name: "Contrato de Serviços", originalFileName: "contrato_verde_solucoes.pdf", documentType: "contrato", status: "read", clientId: "c7", clientName: "Verde Soluções", amount: null, date: "15 Dez, 2025", month: 12, year: 2025, readAt: "2025-12-16", createdAt: "2025-12-15", classifiedAutomatically: true, classificationConfidence: 0.85 },
  { id: "d8", name: "Fatura #1210", originalFileName: "fatura_1210_nexus.pdf", documentType: "fatura", status: "pending", clientId: "c8", clientName: "Nexus Tecnologia", amount: 18900, date: "10 Dez, 2025", month: 12, year: 2025, readAt: null, createdAt: "2025-12-10", classifiedAutomatically: true, classificationConfidence: 0.9 },
  { id: "d9", name: "DAS Simples Nacional", originalFileName: "das_simples_nacional_nov.pdf", documentType: "das", status: "paid", clientId: "c2", clientName: "TechStart Inc", amount: 1230, date: "20 Nov, 2025", month: 11, year: 2025, readAt: "2025-11-21", createdAt: "2025-11-20", classifiedAutomatically: true, classificationConfidence: 0.85 },
  { id: "d10", name: "Balancete Mensal", originalFileName: "balancete_mensal_nov.pdf", documentType: "balancete", status: "read", clientId: null, clientName: "Interno", amount: null, date: "05 Nov, 2025", month: 11, year: 2025, readAt: "2025-11-06", createdAt: "2025-11-05", classifiedAutomatically: true, classificationConfidence: 0.9 },
];

// =============================================
// Context
// =============================================

interface DataContextType {
  // Clients
  clients: ClientData[];
  addClient: (client: Omit<ClientData, "id" | "createdAt">) => Promise<void> | void;
  updateClient: (id: string, updates: Partial<ClientData>) => Promise<void> | void;
  deleteClient: (id: string) => Promise<void> | void;

  // Tasks
  tasks: TaskData[];
  addTask: (task: Omit<TaskData, "id" | "createdAt" | "completedAt">) => void;
  updateTaskStatus: (id: string, status: TaskStatus) => void;
  deleteTask: (id: string) => void;

  // Documents
  documents: DocumentData[];
  addDocument: (doc: DocumentData) => void;
  updateDocument: (id: string, updates: Partial<DocumentData>) => void;
  deleteDocument: (id: string) => void;

  // Document upload pipeline
  processFileUpload: (fileName: string) => void;

  // Notifications
  notifications: Notification[];
  markNotificationRead: (id: string) => void;

  // Pipeline history
  pipelineHistory: PipelineExecution[];
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider = ({ children }: { children: ReactNode }) => {
  const [clients, setClients] = useState<ClientData[]>(mockClients);
  const [tasks, setTasks] = useState<TaskData[]>(() => sortTasks(computeTaskStatuses(mockTasks)));
  const [documents, setDocuments] = useState<DocumentData[]>(mockDocuments);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [pipelineHistory, setPipelineHistory] = useState<PipelineExecution[]>([]);

  // Load persisted clients (companies table) on mount; merge with mocks.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from("companies").select("id, name, cnpj, email, phone, created_at");
      if (cancelled || error || !data?.length) return;
      const dbClients: ClientData[] = data.map((row) => ({
        id: row.id,
        name: row.name,
        cnpj: row.cnpj ?? "",
        taxRegime: "simples_nacional",
        responsibleUserId: "u2",
        responsibleUserName: "Ana Costa",
        serviceFee: 0,
        city: "",
        state: "",
        status: "active",
        email: row.email ?? "",
        phone: row.phone ?? "",
        createdAt: row.created_at ?? new Date().toISOString(),
      }));
      // Prepend persisted clients above mocks, dedup by id
      setClients((prev) => {
        const existingIds = new Set(prev.map((c) => c.id));
        const merged = [...dbClients.filter((c) => !existingIds.has(c.id)), ...prev];
        return merged;
      });
    })();
    return () => { cancelled = true; };
  }, []);

  // --- Clients ---
  const addClient = useCallback(async (client: Omit<ClientData, "id" | "createdAt">) => {
    const { data, error } = await supabase
      .from("companies")
      .insert({ name: client.name, cnpj: client.cnpj, email: client.email, phone: client.phone })
      .select("id, created_at")
      .maybeSingle();

    if (error) {
      toast.error("Não foi possível salvar no banco. Salvando localmente.");
    }
    const newClient: ClientData = {
      ...client,
      id: data?.id ?? crypto.randomUUID(),
      createdAt: data?.created_at ?? new Date().toISOString(),
    };
    setClients(prev => [newClient, ...prev]);
  }, []);

  const updateClient = useCallback(async (id: string, updates: Partial<ClientData>) => {
    setClients(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    const dbPatch: Record<string, unknown> = {};
    if (updates.name !== undefined) dbPatch.name = updates.name;
    if (updates.cnpj !== undefined) dbPatch.cnpj = updates.cnpj;
    if (updates.email !== undefined) dbPatch.email = updates.email;
    if (updates.phone !== undefined) dbPatch.phone = updates.phone;
    if (Object.keys(dbPatch).length) {
      await supabase.from("companies").update(dbPatch).eq("id", id);
    }
  }, []);

  const deleteClient = useCallback(async (id: string) => {
    setClients(prev => prev.filter(c => c.id !== id));
    await supabase.from("companies").delete().eq("id", id);
  }, []);

  // --- Tasks ---
  const addTask = useCallback((task: Omit<TaskData, "id" | "createdAt" | "completedAt">) => {
    const newTask: TaskData = {
      ...task,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      completedAt: null,
    };
    setTasks(prev => sortTasks(computeTaskStatuses([newTask, ...prev])));
  }, []);

  const updateTaskStatus = useCallback((id: string, status: TaskStatus) => {
    setTasks(prev => {
      const updated = prev.map(t => {
        if (t.id !== id) return t;
        return {
          ...t,
          status,
          completedAt: status === "completed" ? new Date().toISOString() : null,
        };
      });
      return sortTasks(updated);
    });
  }, []);

  const deleteTask = useCallback((id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  }, []);

  // --- Documents ---
  const addDocument = useCallback((doc: DocumentData) => {
    setDocuments(prev => [doc, ...prev]);
  }, []);

  const updateDocument = useCallback((id: string, updates: Partial<DocumentData>) => {
    setDocuments(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));
  }, []);

  const deleteDocument = useCallback((id: string) => {
    setDocuments(prev => prev.filter(d => d.id !== id));
  }, []);

  // --- Pipeline ---
  const processFileUpload = useCallback((fileName: string) => {
    const result = executeDocumentPipeline(fileName, clients);

    // Add document
    setDocuments(prev => [result.document, ...prev]);

    // Add pipeline execution to history
    setPipelineHistory(prev => [result.pipeline, ...prev]);

    // Add notifications
    if (result.notifications.length > 0) {
      setNotifications(prev => [...result.notifications, ...prev]);
    }

    // Show toast with pipeline result
    const clientName = result.document.clientName;
    const docType = result.document.documentType;

    if (clientName) {
      toast.success(`Documento classificado como "${docType}" e associado a ${clientName}`, {
        description: `Confiança: ${Math.round(result.document.classificationConfidence * 100)}%`,
      });
    } else {
      toast.info(`Documento classificado como "${docType}" — cliente não identificado`, {
        description: "Associe manualmente o cliente ao documento.",
      });
    }
  }, [clients]);

  // --- Notifications ---
  const markNotificationRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  return (
    <DataContext.Provider value={{
      clients, addClient, updateClient, deleteClient,
      tasks, addTask, updateTaskStatus, deleteTask,
      documents, addDocument, updateDocument, deleteDocument,
      processFileUpload,
      notifications, markNotificationRead,
      pipelineHistory,
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error("useData must be used within a DataProvider");
  }
  return context;
};
