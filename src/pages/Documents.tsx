import { useState, useRef } from "react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import {
  FileText,
  Plus,
  Download,
  Eye,
  MoreHorizontal,
  Trash2,
  Send,
  Check,
  Upload,
  FileCode,
  File,
  ScanText,
  Calendar,
  Clock,
  LayoutDashboard,
  List,
} from "lucide-react";
import { FilterPopover } from "@/components/FilterPopover";
import { MultiSelectFilter } from "@/components/MultiSelectFilter";
import { DocumentViewer, ViewableDocument } from "@/components/DocumentViewer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useData } from "@/contexts/DataContext";
import { documentTypeLabels } from "@/lib/documentClassifier";
import { DocumentData, DocumentType } from "@/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { CalendarEventView } from "@/components/CalendarEventView";
import { supabase } from "@/integrations/supabase/client";
import { useViewMode } from "@/contexts/ViewModeContext";
import { BentoStatStrip } from "@/components/dashboard/BentoStatStrip";
import { IconTooltipButton } from "@/components/IconTooltipButton";

const statusColors: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  overdue: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  final: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  unread: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  read: "bg-muted text-muted-foreground",
  processed:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
};

const statusLabels: Record<string, string> = {
  paid: "Pago",
  pending: "Pendente",
  overdue: "Atrasado",
  final: "Finalizado",
  unread: "Não Lido",
  read: "Lido",
  processed: "Processado",
};

type DocumentRequestView = "actionable" | "approval" | "rejected" | "overdue" | "resolved" | "all";

const documentRequestStatusLabels: Record<string, string> = {
  requested: "Solicitado",
  uploaded: "Aguardando aprovação",
  approved: "Aprovado",
  rejected: "Recusado",
  waived: "Dispensado",
};

const documentRequestStatusStyles: Record<string, string> = {
  requested: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  uploaded: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  waived: "bg-slate-100 text-slate-700 dark:bg-slate-950 dark:text-slate-300",
};

const now = new Date();
const currentMonth = now.getMonth() + 1;
const currentYear = now.getFullYear();
const currentMonthStart = `${currentYear}-${String(currentMonth).padStart(2, "0")}-01`;
const currentMonthEnd = new Date(currentYear, currentMonth, 0)
  .toISOString()
  .slice(0, 10);
const todayIso = new Date().toISOString().slice(0, 10);

const months = [
  { value: "1", label: "Janeiro" },
  { value: "2", label: "Fevereiro" },
  { value: "3", label: "Março" },
  { value: "4", label: "Abril" },
  { value: "5", label: "Maio" },
  { value: "6", label: "Junho" },
  { value: "7", label: "Julho" },
  { value: "8", label: "Agosto" },
  { value: "9", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
];

const years = ["2024", "2025", "2026"];

const lotusDocumentTypes = [
  "advertencia",
  "balanço patrimonial",
  "comprovante de pagamento",
  "documentos pessoais",
  "documentos dos sócios",
  "documentos IRPF",
  "documentos para contratação",
  "exame admissional",
  "exame demissional",
  "exame periodico",
  "extrato bancário",
  "folha de ponto",
  "impostos CRF",
  "impostos fiscais",
  "pedido de demissão",
  "rescisão assinada",
  "informações de funcionário",
  "pendencias exigidas",
];

const formatFileSize = (bytes?: number | null) => {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getFileExtension = (fileName: string) =>
  fileName.split(".").pop()?.toLowerCase() || "pdf";

const isRequestOverdue = (request: { dueDate: string | null; status: string }) =>
  Boolean(
    request.dueDate &&
      request.dueDate < todayIso &&
      !["approved", "waived"].includes(request.status),
  );

const fileTypeIcons: Record<string, React.ReactNode> = {
  pdf: <FileText className="h-4 w-4 text-red-500" />,
  xml: <FileCode className="h-4 w-4 text-emerald-500" />,
  xlsx: <File className="h-4 w-4 text-green-600" />,
  docx: <FileText className="h-4 w-4 text-blue-500" />,
  csv: <File className="h-4 w-4 text-amber-500" />,
};

const Documents = () => {
  const { viewMode } = useViewMode();
  const {
    documents,
    addDocument,
    updateDocument,
    deleteDocument,
    processFileUpload,
    documentRequests,
    clients,
  } = useData();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filterStatuses, setFilterStatuses] = useState<string[]>([]);
  const [filterMonth, setFilterMonth] = useState<string>(String(currentMonth));
  const [filterYear, setFilterYear] = useState<string>(String(currentYear));
  const [filterClient, setFilterClient] = useState<string>("all");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadRequestId, setUploadRequestId] = useState<string | undefined>();
  const [newDoc, setNewDoc] = useState({
    name: "",
    client: "",
    type: "fatura" as DocumentType,
    amount: "",
  });
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("recebidos");
  const [requestViews, setRequestViews] = useState<DocumentRequestView[]>(["actionable"]);
  const [view, setView] = useState<"dashboard" | "list" | "calendar">(
    "dashboard",
  );
  const [dateRange, setDateRange] = useState({
    start: currentMonthStart,
    end: currentMonthEnd,
  });
  const [viewerDoc, setViewerDoc] = useState<ViewableDocument | null>(null);

  const filteredDocuments = documents.filter((doc) => {
    const statusMatch = filterStatuses.length === 0 || filterStatuses.includes(doc.status);
    const monthMatch = doc.month === parseInt(filterMonth);
    const yearMatch = doc.year === parseInt(filterYear);
    const clientMatch = filterClient === "all" || doc.clientId === filterClient;
    return statusMatch && monthMatch && yearMatch && clientMatch;
  });
  const visibleDocumentRequests = documentRequests.filter((request) =>
    filterClient === "all" || request.companyId === filterClient,
  );
  const pendingDocumentRequests = visibleDocumentRequests.filter((request) =>
    ["requested", "rejected"].includes(request.status),
  );
  const requestCounts = {
    actionable: visibleDocumentRequests.filter((request) => ["requested", "rejected"].includes(request.status)).length,
    approval: visibleDocumentRequests.filter((request) => request.status === "uploaded").length,
    rejected: visibleDocumentRequests.filter((request) => request.status === "rejected").length,
    overdue: visibleDocumentRequests.filter(isRequestOverdue).length,
    resolved: visibleDocumentRequests.filter((request) => ["approved", "waived"].includes(request.status)).length,
    all: visibleDocumentRequests.length,
  };
  const matchesRequestView = (request: (typeof visibleDocumentRequests)[number], view: DocumentRequestView) => {
    if (view === "actionable") return ["requested", "rejected"].includes(request.status);
    if (view === "approval") return request.status === "uploaded";
    if (view === "rejected") return request.status === "rejected";
    if (view === "overdue") return isRequestOverdue(request);
    if (view === "resolved") return ["approved", "waived"].includes(request.status);
    return true;
  };
  const filteredDocumentRequests = visibleDocumentRequests.filter((request) =>
    requestViews.length === 0 || requestViews.some((view) => matchesRequestView(request, view)),
  );

  const handleAddDocument = async () => {
    if (!newDoc.name || !newDoc.client) {
      toast.error("Preencha nome e cliente");
      return;
    }
    const selectedClient = clients.find((c) => c.id === newDoc.client);
    const doc: DocumentData = {
      id: crypto.randomUUID(),
      name: newDoc.name,
      originalFileName: newDoc.name + ".pdf",
      documentType: newDoc.type,
      status: "pending",
      clientId: newDoc.client,
      clientName: selectedClient?.name ?? newDoc.client,
      amount: newDoc.amount ? parseFloat(newDoc.amount) : null,
      date: new Date().toLocaleDateString("pt-BR", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
      month: currentMonth,
      year: currentYear,
      readAt: null,
      createdAt: new Date().toISOString(),
      classifiedAutomatically: false,
      classificationConfidence: 1,
    };
    if (!await addDocument(doc)) return;
    toast.success("Documento criado com sucesso!");
    setNewDoc({ name: "", client: "", type: "fatura", amount: "" });
    setDialogOpen(false);
  };

  const handleDeleteDocument = async (id: string) => {
    if (!await deleteDocument(id)) return;
    toast.success("Documento removido!");
  };

  const handleMarkAsPaid = async (id: string) => {
    if (!await updateDocument(id, { status: "paid" })) return;
    toast.success("Marcado como pago!");
  };

  const handleMarkAsRead = async (id: string) => {
    if (!await updateDocument(id, { status: "read", readAt: new Date().toISOString() })) return;
    toast.success("Marcado como lido!");
  };

  const handleSendReminder = (doc: DocumentData) => {
    toast.info(`Envio de lembretes para ${doc.clientName ?? "o cliente"} depende de um canal conectado.`);
  };

  const createDocumentUrl = async (doc: DocumentData) => {
    if (!doc.filePath) return null;
    const { data, error } = await supabase.storage
      .from("documents")
      .createSignedUrl(doc.filePath, 60);
    if (error) {
      toast.error("Erro ao acessar arquivo: " + error.message);
      return null;
    }
    return data.signedUrl;
  };

  const handleDownloadDocument = async (doc: DocumentData) => {
    const signedUrl = await createDocumentUrl(doc);
    if (!signedUrl) {
      toast.info("Este documento ainda não possui arquivo armazenado");
      return;
    }
    window.open(signedUrl, "_blank", "noopener,noreferrer");
  };

  const openDocumentInViewer = async (doc: DocumentData) => {
    if (doc.status === "unread") handleMarkAsRead(doc.id);
    const signedUrl = await createDocumentUrl(doc);
    setViewerDoc({
      id: doc.id,
      name: doc.name,
      type: getFileExtension(doc.originalFileName),
      size: formatFileSize(doc.fileSize),
      clientName: doc.clientName || "",
      category: documentTypeLabels[doc.documentType],
      date: doc.date,
      downloadUrl: signedUrl,
      content: [
        `Documento: ${doc.name}`,
        `Arquivo original: ${doc.originalFileName}`,
        `Cliente: ${doc.clientName ?? "Não identificado"}`,
        `Tipo: ${documentTypeLabels[doc.documentType]}`,
        `Status: ${statusLabels[doc.status] || doc.status}`,
        `Valor: ${doc.amount ? `R$ ${doc.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}`,
        `MIME: ${doc.mimeType ?? "—"}`,
        signedUrl
          ? "Arquivo disponível para download/visualização em nova aba."
          : "Arquivo físico não encontrado no Storage para este registro.",
      ].join("\n"),
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        void processFileUpload(files[i], uploadRequestId);
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
      setUploadRequestId(undefined);
    }
  };

  const uploadForRequest = (requestId: string) => {
    setUploadRequestId(requestId);
    fileInputRef.current?.click();
  };

  return (
    <DashboardLayout>
      <div className="flex h-full">
        <div
          className={cn(
            "space-y-6 transition-all",
            viewerDoc ? "flex-1 min-w-0" : "w-full",
          )}
        >
          <div className="page-header flex items-center justify-between gap-4 animate-fade-in">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Documentos
              </h1>
              <p className="text-muted-foreground">
                Gerencie faturas, relatórios e documentos
              </p>
            </div>
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileUpload}
              />
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => {
                  setUploadRequestId(undefined);
                  fileInputRef.current?.click();
                }}
              >
                <Upload className="h-4 w-4" />
                Enviar Arquivos
              </Button>
              {viewMode !== "client" && (
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="gap-2">
                      <Plus className="h-4 w-4" />
                      Criar Fatura
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>Novo Documento</DialogTitle>
                      <DialogDescription>
                        Crie uma nova fatura ou documento.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="docType">Tipo</Label>
                        <Select
                          value={newDoc.type}
                          onValueChange={(value: DocumentType) =>
                            setNewDoc({ ...newDoc, type: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {lotusDocumentTypes.map((label) => (
                              <SelectItem
                                key={label}
                                value={label as DocumentType}
                              >
                                {label}
                              </SelectItem>
                            ))}
                            {Object.entries(documentTypeLabels).map(
                              ([key, label]) => (
                                <SelectItem key={key} value={key}>
                                  {label}
                                </SelectItem>
                              ),
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="docName">Nome do Documento</Label>
                        <Input
                          id="docName"
                          value={newDoc.name}
                          onChange={(e) =>
                            setNewDoc({ ...newDoc, name: e.target.value })
                          }
                          placeholder="Ex: Fatura #1235"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="docClient">Cliente</Label>
                        <Select
                          value={newDoc.client}
                          onValueChange={(v) =>
                            setNewDoc({ ...newDoc, client: v })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um cliente" />
                          </SelectTrigger>
                          <SelectContent>
                            {clients.filter((client) => client.status === "active").map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="docAmount">Valor (opcional)</Label>
                        <Input
                          id="docAmount"
                          type="number"
                          value={newDoc.amount}
                          onChange={(e) =>
                            setNewDoc({ ...newDoc, amount: e.target.value })
                          }
                          placeholder="0,00"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setDialogOpen(false)}
                      >
                        Cancelar
                      </Button>
                      <Button onClick={handleAddDocument}>Criar</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>

          {visibleDocumentRequests.length > 0 && (
            <div className="glass rounded-2xl p-6 animate-fade-in">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">Solicitações de documentos</h3>
                  <p className="text-sm text-muted-foreground">
                    {pendingDocumentRequests.length} solicitação(ões) aguardando envio ou reenvio e {requestCounts.approval} aguardando aprovação.
                  </p>
                </div>
                <Badge variant="outline">{visibleDocumentRequests.length} no total</Badge>
              </div>
              <div className="mb-4 flex justify-end">
                <FilterPopover
                  title="Filtrar solicitações"
                  description="Combine estados para acompanhar o fluxo de envio e aprovação."
                  activeCount={requestViews.length}
                  onClear={() => setRequestViews([])}
                >
                  <MultiSelectFilter
                    label="Visão"
                    emptyLabel="Todas"
                    options={[
                      { value: "actionable", label: "Pendentes", count: requestCounts.actionable },
                      { value: "approval", label: "Aprovação", count: requestCounts.approval },
                      { value: "rejected", label: "Recusados", count: requestCounts.rejected },
                      { value: "overdue", label: "Vencidos", count: requestCounts.overdue },
                      { value: "resolved", label: "Resolvidos", count: requestCounts.resolved },
                      { value: "all", label: "Todos", count: requestCounts.all },
                    ]}
                    value={requestViews}
                    onChange={(values) => setRequestViews(values as DocumentRequestView[])}
                  />
                </FilterPopover>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {filteredDocumentRequests.map((request) => {
                  const client = clients.find((item) => item.id === request.companyId);
                  const canUpload = ["requested", "rejected"].includes(request.status);
                  const overdue = isRequestOverdue(request);
                  return (
                    <div key={request.id} className="rounded-xl border border-border p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{request.title}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {client?.name ?? "Cliente"} · venc. {request.dueDate ? new Date(`${request.dueDate}T00:00:00`).toLocaleDateString("pt-BR") : "sem prazo"}
                          </p>
                        </div>
                        <Badge className={cn("shrink-0 text-[10px]", documentRequestStatusStyles[request.status])}>
                          {documentRequestStatusLabels[request.status] ?? request.status}
                        </Badge>
                      </div>
                      {overdue && <Badge variant="destructive" className="mt-2 text-[10px]">Vencido</Badge>}
                      {request.description && <p className="mt-2 text-xs text-muted-foreground">{request.description}</p>}
                      {request.rejectionReason && <p className="mt-2 text-xs text-red-600">{request.rejectionReason}</p>}
                      {request.waivedReason && <p className="mt-2 text-xs text-muted-foreground">{request.waivedReason}</p>}
                      {canUpload && (
                        <Button className="mt-3 h-8 rounded-lg gap-2" size="sm" onClick={() => uploadForRequest(request.id)}>
                          <Upload className="h-3.5 w-3.5" />
                          {request.status === "rejected" ? "Reenviar arquivo" : "Enviar arquivo"}
                        </Button>
                      )}
                    </div>
                  );
                })}
                {filteredDocumentRequests.length === 0 && (
                  <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground lg:col-span-2">
                    Nenhuma solicitação nesta visão.
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 animate-fade-in">
            <div className="flex rounded-2xl border border-border bg-card p-1">
              {[
                {
                  value: "dashboard",
                  label: "Dashboard",
                  icon: LayoutDashboard,
                },
                { value: "list", label: "Lista", icon: List },
                { value: "calendar", label: "Calendário", icon: Calendar },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <IconTooltipButton
                    key={item.value}
                    icon={Icon}
                    label={item.label}
                    variant={view === item.value ? "default" : "ghost"}
                    className="rounded-xl"
                    aria-pressed={view === item.value}
                    onClick={() => setView(item.value as typeof view)}
                  />
                );
              })}
            </div>
          </div>

          {view === "dashboard" && (
            <BentoStatStrip
              className="animate-fade-in"
              items={[
                { label: "Documentos", value: documents.length, icon: FileText },
                {
                  label: "Pendentes",
                  value: documents.filter((doc) => doc.status === "pending").length,
                  icon: Clock,
                },
                {
                  label: "Período",
                  value: months.find((m) => m.value === filterMonth)?.label,
                  icon: Calendar,
                },
              ]}
            />
          )}

          {view === "calendar" && (
            <CalendarEventView
              title="Calendário de documentos"
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
              events={documents.map((doc) => ({
                day: new Date(doc.createdAt).getDate(),
                title: doc.name,
                subtitle: `${doc.clientName ?? "Sem cliente"} • ${documentTypeLabels[doc.documentType]}`,
                time: "09:00",
                amount: doc.amount
                  ? `R$ ${doc.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                  : undefined,
                status: statusLabels[doc.status] || doc.status,
              }))}
            />
          )}

          {view !== "calendar" && (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="rounded-2xl">
                <TabsTrigger value="recebidos" className="rounded-xl">
                  Recebidos
                </TabsTrigger>
                <TabsTrigger value="enviados" className="rounded-xl">
                  Enviados
                </TabsTrigger>
                <TabsTrigger value="arquivos" className="rounded-xl">
                  Arquivos
                </TabsTrigger>
              </TabsList>

              <TabsContent
                value={activeTab === "enviados" ? "enviados" : "recebidos"}
                className="space-y-4 mt-4"
              >
                {/* Filters */}
                <div className="filter-toolbar flex flex-wrap items-center justify-between gap-2 animate-fade-in">
                  <div className="flex min-w-0 items-center gap-2">
                    <Badge variant="secondary" className="shrink-0">
                      {filteredDocuments.length} documento(s)
                    </Badge>
                    <span className="hidden text-xs text-muted-foreground sm:inline">
                      {filterStatuses.length === 0
                        ? "Todos os status"
                        : `${filterStatuses.length} status selecionado(s)`}
                    </span>
                  </div>
                  <FilterPopover
                    title="Filtrar documentos"
                    description="Ajuste status, competência e cliente."
                    activeCount={
                      filterStatuses.length +
                      (filterClient === "all" ? 0 : 1) +
                      (filterMonth === String(currentMonth) ? 0 : 1) +
                      (filterYear === String(currentYear) ? 0 : 1)
                    }
                    onClear={() => {
                      setFilterStatuses([]);
                      setFilterClient("all");
                      setFilterMonth(String(currentMonth));
                      setFilterYear(String(currentYear));
                    }}
                  >
                    <MultiSelectFilter
                      label="Status"
                      options={["pending", "paid", "overdue", "unread"].map((status) => ({
                        value: status,
                        label: statusLabels[status] ?? status,
                        count: documents.filter((doc) => doc.status === status).length,
                      }))}
                      value={filterStatuses}
                      onChange={setFilterStatuses}
                    />
                    {viewMode !== "client" && (
                      <div className="space-y-1.5">
                        <Label>Cliente</Label>
                        <Select value={filterClient} onValueChange={setFilterClient}>
                          <SelectTrigger><SelectValue placeholder="Todos clientes" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos clientes</SelectItem>
                            {clients.filter((client) => client.status === "active").map((c) => (
                              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1.5">
                        <Label>Competência</Label>
                        <Select value={filterMonth} onValueChange={setFilterMonth}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{months.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Ano</Label>
                        <Select value={filterYear} onValueChange={setFilterYear}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                  </FilterPopover>
                </div>

                <div className="table-surface animate-fade-in">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border bg-accent/30">
                          <th className="text-left p-4 font-medium text-muted-foreground">
                            Documento
                          </th>
                          <th className="text-left p-4 font-medium text-muted-foreground hidden md:table-cell">
                            Cliente
                          </th>
                          <th className="text-left p-4 font-medium text-muted-foreground hidden sm:table-cell">
                            Tipo
                          </th>
                          <th className="text-left p-4 font-medium text-muted-foreground">
                            Status
                          </th>
                          <th className="text-right p-4 font-medium text-muted-foreground">
                            Valor
                          </th>
                          <th className="text-right p-4 font-medium text-muted-foreground">
                            Ações
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDocuments.map((doc, index) => (
                          <tr
                            key={doc.id}
                            className="border-b border-border last:border-0 hover:bg-accent/30 transition-colors"
                            style={{ animationDelay: `${index * 50}ms` }}
                          >
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-accent">
                                  <FileText className="h-4 w-4 text-accent-foreground" />
                                </div>
                                <div>
                                  <p className="font-medium">{doc.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {doc.date}
                                  </p>
                                  {doc.classifiedAutomatically && (
                                    <p className="text-xs text-muted-foreground/70">
                                      Classificado automaticamente
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="p-4 hidden md:table-cell text-muted-foreground">
                              {doc.clientName || "—"}
                            </td>
                            <td className="p-4 hidden sm:table-cell text-muted-foreground">
                              {documentTypeLabels[doc.documentType]}
                            </td>
                            <td className="p-4">
                              <Badge
                                className={statusColors[doc.status] || ""}
                                variant="secondary"
                              >
                                {statusLabels[doc.status] || doc.status}
                              </Badge>
                            </td>
                            <td className="p-4 text-right font-medium">
                              {doc.amount
                                ? `R$ ${doc.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                                : "—"}
                            </td>
                            <td className="p-4">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => void openDocumentInViewer(doc)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() =>
                                    void handleDownloadDocument(doc)
                                  }
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                    >
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    {doc.status === "unread" && (
                                      <DropdownMenuItem
                                        className="gap-2"
                                        onClick={() => handleMarkAsRead(doc.id)}
                                      >
                                        <Eye className="h-4 w-4" />
                                        Marcar como Lido
                                      </DropdownMenuItem>
                                    )}
                                    {viewMode !== "client" &&
                                      (doc.status === "pending" ||
                                        doc.status === "overdue") && (
                                        <>
                                          <DropdownMenuItem
                                            className="gap-2"
                                            onClick={() =>
                                              handleMarkAsPaid(doc.id)
                                            }
                                          >
                                            <Check className="h-4 w-4" />
                                            Marcar como Pago
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            className="gap-2"
                                            onClick={() =>
                                              handleSendReminder(doc)
                                            }
                                          >
                                            <Send className="h-4 w-4" />
                                            Enviar Lembrete
                                          </DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                        </>
                                      )}
                                    {viewMode !== "client" && (
                                      <DropdownMenuItem
                                        className="gap-2 text-destructive focus:text-destructive"
                                        onClick={() =>
                                          handleDeleteDocument(doc.id)
                                        }
                                      >
                                        <Trash2 className="h-4 w-4" />
                                        Excluir
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {filteredDocuments.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>
                        Nenhum documento encontrado para o período selecionado
                      </p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="arquivos" className="space-y-4 mt-4">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
                  {/* File list */}
                  <div className="lg:col-span-1 space-y-2">
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">
                      Arquivos Recentes
                    </h3>
                    {documents.filter((doc) => doc.filePath).length === 0 && (
                      <div className="rounded-2xl border border-dashed border-border p-6 text-center text-muted-foreground">
                        <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
                        <p className="text-sm font-medium">
                          Nenhum documento encontrado
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-4 rounded-2xl"
                          disabled
                        >
                          <ScanText className="h-4 w-4" />
                          Extrair texto
                        </Button>
                      </div>
                    )}
                    {documents
                      .filter((doc) => doc.filePath)
                      .map((file) => (
                        <button
                          key={file.id}
                          onClick={() => {
                            setSelectedFileId(file.id);
                            void openDocumentInViewer(file);
                          }}
                          className={`w-full text-left p-3 rounded-2xl border transition-all ${
                            selectedFileId === file.id
                              ? "border-primary bg-accent/50"
                              : "border-border hover:bg-accent/30"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-accent shrink-0">
                              {fileTypeIcons[
                                getFileExtension(file.originalFileName)
                              ] ?? fileTypeIcons.pdf}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">
                                {file.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {file.clientName ?? "Sem cliente"} ·{" "}
                                {formatFileSize(file.fileSize)}
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className="text-xs shrink-0 ml-auto uppercase"
                            >
                              {getFileExtension(file.originalFileName)}
                            </Badge>
                          </div>
                        </button>
                      ))}
                  </div>

                  {/* File preview */}
                  <div className="lg:col-span-2">
                    {selectedFileId ? (
                      <div className="glass rounded-2xl p-6 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-3 rounded-xl bg-accent">
                              <FileText className="h-4 w-4 text-accent-foreground" />
                            </div>
                            <div>
                              <h3 className="font-semibold">
                                {
                                  documents.find(
                                    (doc) => doc.id === selectedFileId,
                                  )?.name
                                }
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                {documents.find(
                                  (doc) => doc.id === selectedFileId,
                                )?.clientName ?? "Sem cliente"}{" "}
                                ·{" "}
                                {
                                  documents.find(
                                    (doc) => doc.id === selectedFileId,
                                  )?.date
                                }
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const doc = documents.find(
                                  (item) => item.id === selectedFileId,
                                );
                                if (doc) void handleDownloadDocument(doc);
                              }}
                            >
                              <Download className="h-4 w-4 mr-1" />
                              Baixar
                            </Button>
                            <Button size="sm" disabled>
                              <ScanText className="h-4 w-4 mr-1" />
                              Extrair texto
                            </Button>
                          </div>
                        </div>

                        <div className="border-t border-border pt-4">
                          <h4 className="text-sm font-medium text-muted-foreground mb-3">
                            Metadados do arquivo
                          </h4>
                          <ScrollArea className="h-[400px]">
                            <pre className="text-sm whitespace-pre-wrap bg-accent/30 rounded-xl p-4 font-mono leading-relaxed">
                              {(() => {
                                const doc = documents.find(
                                  (item) => item.id === selectedFileId,
                                );
                                if (!doc) return "";
                                return [
                                  `Documento: ${doc.name}`,
                                  `Arquivo original: ${doc.originalFileName}`,
                                  `Cliente: ${doc.clientName ?? "Não identificado"}`,
                                  `Tipo: ${documentTypeLabels[doc.documentType]}`,
                                  `Tamanho: ${formatFileSize(doc.fileSize)}`,
                                  `MIME: ${doc.mimeType ?? "—"}`,
                                  `Caminho: ${doc.filePath ?? "—"}`,
                                ].join("\n");
                              })()}
                            </pre>
                          </ScrollArea>
                        </div>
                      </div>
                    ) : (
                      <div className="glass rounded-2xl p-12 text-center text-muted-foreground">
                        <FileText className="h-16 w-16 mx-auto mb-4 opacity-30" />
                        <p className="text-lg font-medium">
                          Nenhum documento encontrado
                        </p>
                        <p className="text-sm">
                          Envie um arquivo para pré-visualizar e extrair textos
                        </p>
                        <Button
                          variant="outline"
                          className="mt-4 rounded-2xl"
                          disabled
                        >
                          <ScanText className="h-4 w-4" />
                          Extrair texto
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>
        <DocumentViewer
          document={viewerDoc}
          onClose={() => setViewerDoc(null)}
        />
      </div>
    </DashboardLayout>
  );
};

export default Documents;
