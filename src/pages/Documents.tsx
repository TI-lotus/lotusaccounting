import { useState, useRef } from "react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { FileText, Plus, Download, Eye, MoreHorizontal, Trash2, Send, Check, Upload, FileCode, File, ScanText, Calendar, LayoutDashboard, List } from "lucide-react";
import { DocumentViewer, ViewableDocument } from "@/components/DocumentViewer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useData } from "@/contexts/DataContext";
import { documentTypeLabels } from "@/lib/documentClassifier";
import { DocumentData, DocumentType } from "@/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { CalendarEventView } from "@/components/CalendarEventView";

const statusColors: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  overdue: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  final: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  unread: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  read: "bg-muted text-muted-foreground",
  processed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
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

const now = new Date();
const currentMonth = now.getMonth() + 1;
const currentYear = now.getFullYear();

const months = [
  { value: "1", label: "Janeiro" }, { value: "2", label: "Fevereiro" }, { value: "3", label: "Março" },
  { value: "4", label: "Abril" }, { value: "5", label: "Maio" }, { value: "6", label: "Junho" },
  { value: "7", label: "Julho" }, { value: "8", label: "Agosto" }, { value: "9", label: "Setembro" },
  { value: "10", label: "Outubro" }, { value: "11", label: "Novembro" }, { value: "12", label: "Dezembro" },
];

const years = ["2024", "2025", "2026"];

const lotusDocumentTypes = [
  "advertencia", "balanço patrimonial", "comprovante de pagamento", "documentos pessoais", "documentos dos sócios",
  "documentos IRPF", "documentos para contratação", "exame admissional", "exame demissional", "exame periodico",
  "extrato bancário", "folha de ponto", "impostos CRF", "impostos fiscais", "pedido de demissão",
  "rescisão assinada", "informações de funcionário", "pendencias exigidas",
];

interface MockFile {
  id: string;
  name: string;
  type: "pdf" | "xml" | "xlsx" | "docx" | "csv";
  size: string;
  clientName: string;
  category: string;
  uploadedAt: string;
  preview: string;
  extractedText: string;
}

const mockFiles: MockFile[] = [];

const fileTypeIcons: Record<string, React.ReactNode> = {
  pdf: <FileText className="h-4 w-4 text-red-500" />,
  xml: <FileCode className="h-4 w-4 text-emerald-500" />,
  xlsx: <File className="h-4 w-4 text-green-600" />,
  docx: <FileText className="h-4 w-4 text-blue-500" />,
  csv: <File className="h-4 w-4 text-amber-500" />,
};

const Documents = () => {
  const { documents, addDocument, updateDocument, deleteDocument, processFileUpload, clients } = useData();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterMonth, setFilterMonth] = useState<string>(String(currentMonth));
  const [filterYear, setFilterYear] = useState<string>(String(currentYear));
  const [filterClient, setFilterClient] = useState<string>("all");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newDoc, setNewDoc] = useState({ name: "", client: "", type: "fatura" as DocumentType, amount: "" });
  const [selectedFile, setSelectedFile] = useState<MockFile | null>(null);
  const [extractedFileIds, setExtractedFileIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("recebidos");
  const [view, setView] = useState<"dashboard" | "list" | "calendar">("dashboard");
  const [dateRange, setDateRange] = useState({ start: "2026-01-01", end: "2026-01-31" });
  const [viewerDoc, setViewerDoc] = useState<ViewableDocument | null>(null);

  const handleExtractText = (file: MockFile) => {
    setExtractedFileIds((current) => current.includes(file.id) ? current : [...current, file.id]);
    toast.success("Texto extraído com sucesso!");
  };

  const openFileInViewer = (file: MockFile) => {
    setViewerDoc({
      id: file.id,
      name: file.name,
      type: file.type,
      category: file.category,
      clientName: file.clientName,
      date: file.uploadedAt,
      content: file.extractedText,
      size: file.size,
    });
  };

  const filteredDocuments = documents.filter((doc, index) => {
    const statusMatch = filterStatus === "all" || doc.status === filterStatus;
    const monthMatch = doc.month === parseInt(filterMonth);
    const yearMatch = doc.year === parseInt(filterYear);
    const clientMatch = filterClient === "all" || doc.clientId === filterClient;
    const directionMatch = activeTab === "recebidos" ? index % 2 === 0 : activeTab === "enviados" ? index % 2 !== 0 : true;
    return statusMatch && monthMatch && yearMatch && clientMatch && directionMatch;
  });

  const handleAddDocument = () => {
    if (!newDoc.name || !newDoc.client) {
      toast.error("Preencha nome e cliente");
      return;
    }
    const selectedClient = clients.find(c => c.id === newDoc.client);
    const doc: DocumentData = {
      id: crypto.randomUUID(),
      name: newDoc.name,
      originalFileName: newDoc.name + ".pdf",
      documentType: newDoc.type,
      status: "pending",
      clientId: newDoc.client,
      clientName: selectedClient?.name ?? newDoc.client,
      amount: newDoc.amount ? parseFloat(newDoc.amount) : null,
      date: new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" }),
      month: currentMonth,
      year: currentYear,
      readAt: null,
      createdAt: new Date().toISOString(),
      classifiedAutomatically: false,
      classificationConfidence: 1,
    };
    addDocument(doc);
    toast.success("Documento criado com sucesso!");
    setNewDoc({ name: "", client: "", type: "fatura", amount: "" });
    setDialogOpen(false);
  };

  const handleDeleteDocument = (id: string) => {
    deleteDocument(id);
    toast.success("Documento removido!");
  };

  const handleMarkAsPaid = (id: string) => {
    updateDocument(id, { status: "paid" });
    toast.success("Marcado como pago!");
  };

  const handleMarkAsRead = (id: string) => {
    updateDocument(id, { status: "read", readAt: new Date().toISOString() });
    toast.success("Marcado como lido!");
  };

  const handleSendReminder = (doc: DocumentData) => {
    toast.success(`Lembrete enviado para ${doc.clientName}!`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        processFileUpload(files[i].name);
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <DashboardLayout>
      <div className="flex h-full">
        <div className={cn("space-y-6 transition-all", viewerDoc ? "flex-1 min-w-0" : "w-full")}>
        <div className="flex items-center justify-between animate-fade-in">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Documentos</h1>
            <p className="text-muted-foreground">Gerencie faturas, relatórios e documentos</p>
          </div>
          <div className="flex gap-2">
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileUpload} />
            <Button variant="outline" className="gap-2" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4" />
              Enviar Arquivos
            </Button>
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
                  <DialogDescription>Crie uma nova fatura ou documento.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="docType">Tipo</Label>
                    <Select value={newDoc.type} onValueChange={(value: DocumentType) => setNewDoc({ ...newDoc, type: value })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {lotusDocumentTypes.map((label) => (
                          <SelectItem key={label} value={label as DocumentType}>{label}</SelectItem>
                        ))}
                        {Object.entries(documentTypeLabels).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="docName">Nome do Documento</Label>
                    <Input id="docName" value={newDoc.name} onChange={(e) => setNewDoc({ ...newDoc, name: e.target.value })} placeholder="Ex: Fatura #1235" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="docClient">Cliente</Label>
                    <Select value={newDoc.client} onValueChange={(v) => setNewDoc({ ...newDoc, client: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
                      <SelectContent>
                        {clients.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="docAmount">Valor (opcional)</Label>
                    <Input id="docAmount" type="number" value={newDoc.amount} onChange={(e) => setNewDoc({ ...newDoc, amount: e.target.value })} placeholder="0,00" />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                  <Button onClick={handleAddDocument}>Criar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 animate-fade-in">
          <div className="flex rounded-2xl border border-border bg-card p-1">
            {[
              { value: "dashboard", label: "Dashboard", icon: LayoutDashboard },
              { value: "list", label: "Lista", icon: List },
              { value: "calendar", label: "Calendário", icon: Calendar },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Button key={item.value} variant={view === item.value ? "default" : "ghost"} size="sm" className="rounded-xl" onClick={() => setView(item.value as typeof view)}>
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Button>
              );
            })}
          </div>
        </div>

        {view === "dashboard" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in">
            <div className="kpi-card"><p className="text-sm text-muted-foreground">Documentos</p><p className="text-2xl font-semibold">{documents.length}</p></div>
            <div className="kpi-card"><p className="text-sm text-muted-foreground">Pendentes</p><p className="text-2xl font-semibold">{documents.filter((doc) => doc.status === "pending").length}</p></div>
            <div className="kpi-card"><p className="text-sm text-muted-foreground">Período</p><p className="text-2xl font-semibold">{months.find((m) => m.value === filterMonth)?.label}</p></div>
          </div>
        )}

        {view === "calendar" && (
          <CalendarEventView
            title="Calendário de documentos"
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            events={documents.map((doc, index) => ({
              day: ((index * 2) % 30) + 1,
              title: doc.name,
              subtitle: `${doc.clientName ?? "Sem cliente"} • ${documentTypeLabels[doc.documentType]}`,
              time: "09:00",
              amount: doc.amount ? `R$ ${doc.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : undefined,
              status: statusLabels[doc.status] || doc.status,
            }))}
          />
        )}

        {view !== "calendar" && <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="rounded-2xl">
            <TabsTrigger value="recebidos" className="rounded-xl">Recebidos</TabsTrigger>
            <TabsTrigger value="enviados" className="rounded-xl">Enviados</TabsTrigger>
            <TabsTrigger value="arquivos" className="rounded-xl">Arquivos</TabsTrigger>
          </TabsList>

          <TabsContent value="recebidos" className="space-y-4 mt-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-2 items-center animate-fade-in">
              <div className="flex gap-2">
                {["all", "pending", "paid", "overdue", "unread"].map((s) => (
                  <Button key={s} variant={filterStatus === s ? "default" : "outline"} size="sm" onClick={() => setFilterStatus(s)}>
                    {s === "all" ? "Todos" : statusLabels[s] || s}
                  </Button>
                ))}
              </div>
              <div className="ml-auto flex gap-2">
                <Select value={filterClient} onValueChange={setFilterClient}>
                  <SelectTrigger className="w-[160px] h-9 text-sm"><SelectValue placeholder="Todos clientes" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos clientes</SelectItem>
                    {clients.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterMonth} onValueChange={setFilterMonth}>
                  <SelectTrigger className="w-[140px] h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {months.map((m) => (<SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>))}
                  </SelectContent>
                </Select>
                <Select value={filterYear} onValueChange={setFilterYear}>
                  <SelectTrigger className="w-[100px] h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (<SelectItem key={y} value={y}>{y}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="glass rounded-2xl overflow-hidden animate-fade-in">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-accent/30">
                      <th className="text-left p-4 font-medium text-muted-foreground">Documento</th>
                      <th className="text-left p-4 font-medium text-muted-foreground hidden md:table-cell">Cliente</th>
                      <th className="text-left p-4 font-medium text-muted-foreground hidden sm:table-cell">Tipo</th>
                      <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                      <th className="text-right p-4 font-medium text-muted-foreground">Valor</th>
                      <th className="text-right p-4 font-medium text-muted-foreground">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDocuments.map((doc, index) => (
                      <tr key={doc.id} className="border-b border-border last:border-0 hover:bg-accent/30 transition-colors" style={{ animationDelay: `${index * 50}ms` }}>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-accent">
                              <FileText className="h-4 w-4 text-accent-foreground" />
                            </div>
                            <div>
                              <p className="font-medium">{doc.name}</p>
                              <p className="text-xs text-muted-foreground">{doc.date}</p>
                              {doc.classifiedAutomatically && (
                                <p className="text-xs text-muted-foreground/70">Classificado automaticamente</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-4 hidden md:table-cell text-muted-foreground">{doc.clientName || "—"}</td>
                        <td className="p-4 hidden sm:table-cell text-muted-foreground">{documentTypeLabels[doc.documentType]}</td>
                        <td className="p-4">
                          <Badge className={statusColors[doc.status] || ""} variant="secondary">
                            {statusLabels[doc.status] || doc.status}
                          </Badge>
                        </td>
                        <td className="p-4 text-right font-medium">
                          {doc.amount ? `R$ ${doc.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                              if (doc.status === "unread") handleMarkAsRead(doc.id);
                              openFileInViewer({
                                id: doc.id, name: doc.name, type: "pdf", size: "—",
                                clientName: doc.clientName || "", category: documentTypeLabels[doc.documentType],
                                uploadedAt: doc.date,
                                preview: `Pré-visualização de ${doc.name}`,
                                extractedText: `Documento: ${doc.name}\nCliente: ${doc.clientName}\nTipo: ${documentTypeLabels[doc.documentType]}\nStatus: ${doc.status}\nValor: ${doc.amount ? `R$ ${doc.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}`
                              });
                            }}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toast.success("Download iniciado!")}>
                              <Download className="h-4 w-4" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {doc.status === "unread" && (
                                  <DropdownMenuItem className="gap-2" onClick={() => handleMarkAsRead(doc.id)}>
                                    <Eye className="h-4 w-4" />
                                    Marcar como Lido
                                  </DropdownMenuItem>
                                )}
                                {(doc.status === "pending" || doc.status === "overdue") && (
                                  <>
                                    <DropdownMenuItem className="gap-2" onClick={() => handleMarkAsPaid(doc.id)}>
                                      <Check className="h-4 w-4" />
                                      Marcar como Pago
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="gap-2" onClick={() => handleSendReminder(doc)}>
                                      <Send className="h-4 w-4" />
                                      Enviar Lembrete
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                  </>
                                )}
                                <DropdownMenuItem className="gap-2 text-destructive focus:text-destructive" onClick={() => handleDeleteDocument(doc.id)}>
                                  <Trash2 className="h-4 w-4" />
                                  Excluir
                                </DropdownMenuItem>
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
                  <p>Nenhum documento encontrado para o período selecionado</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="arquivos" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
              {/* File list */}
              <div className="lg:col-span-1 space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground mb-3">Arquivos Recentes</h3>
                {mockFiles.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-border p-6 text-center text-muted-foreground">
                    <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm font-medium">Nenhum documento encontrado</p>
                    <Button variant="outline" size="sm" className="mt-4 rounded-2xl" disabled>
                      <ScanText className="h-4 w-4" />
                      Extrair texto
                    </Button>
                  </div>
                )}
                {mockFiles.map((file) => (
                  <button
                    key={file.id}
                    onClick={() => { setSelectedFile(file); openFileInViewer(file); }}
                    className={`w-full text-left p-3 rounded-2xl border transition-all ${
                      selectedFile?.id === file.id
                        ? "border-primary bg-accent/50"
                        : "border-border hover:bg-accent/30"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-accent shrink-0">
                        {fileTypeIcons[file.type]}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{file.name}</p>
                        <p className="text-xs text-muted-foreground">{file.clientName} · {file.size}</p>
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0 ml-auto uppercase">{file.type}</Badge>
                    </div>
                  </button>
                ))}
              </div>

              {/* File preview */}
              <div className="lg:col-span-2">
                {selectedFile ? (
                  <div className="glass rounded-2xl p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl bg-accent">
                          {fileTypeIcons[selectedFile.type]}
                        </div>
                        <div>
                          <h3 className="font-semibold">{selectedFile.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {selectedFile.clientName} · {selectedFile.category} · {selectedFile.uploadedAt}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => toast.success("Download iniciado!")}>
                          <Download className="h-4 w-4 mr-1" />
                          Baixar
                        </Button>
                        <Button size="sm" onClick={() => handleExtractText(selectedFile)}>
                          <ScanText className="h-4 w-4 mr-1" />
                          Extrair texto
                        </Button>
                      </div>
                    </div>

                    <div className="border-t border-border pt-4">
                      <h4 className="text-sm font-medium text-muted-foreground mb-3">
                        {extractedFileIds.includes(selectedFile.id) ? "Texto Extraído" : "Pré-visualização"}
                      </h4>
                      <ScrollArea className="h-[400px]">
                        <pre className="text-sm whitespace-pre-wrap bg-accent/30 rounded-xl p-4 font-mono leading-relaxed">
                          {extractedFileIds.includes(selectedFile.id) ? selectedFile.extractedText : selectedFile.preview}
                        </pre>
                      </ScrollArea>
                    </div>
                  </div>
                ) : (
                  <div className="glass rounded-2xl p-12 text-center text-muted-foreground">
                    <FileText className="h-16 w-16 mx-auto mb-4 opacity-30" />
                    <p className="text-lg font-medium">Nenhum documento encontrado</p>
                    <p className="text-sm">Envie um arquivo para pré-visualizar e extrair textos</p>
                    <Button variant="outline" className="mt-4 rounded-2xl" disabled>
                      <ScanText className="h-4 w-4" />
                      Extrair texto
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>}
        </div>
        <DocumentViewer document={viewerDoc} onClose={() => setViewerDoc(null)} />
      </div>
    </DashboardLayout>
  );
};

export default Documents;
