import { useState, useRef } from "react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { FileText, Plus, Download, Eye, MoreHorizontal, Trash2, Send, Check, Upload, FileCode, File } from "lucide-react";
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

interface MockFile {
  id: string;
  name: string;
  type: "pdf" | "xml" | "xlsx" | "docx" | "csv";
  size: string;
  clientName: string;
  category: string;
  uploadedAt: string;
  extractedText: string;
}

const mockFiles: MockFile[] = [
  {
    id: "mf1", name: "NF-e_001234.xml", type: "xml", size: "45 KB",
    clientName: "TechSoft Ltda", category: "NF-e",
    uploadedAt: "02/04/2026",
    extractedText: "NOTA FISCAL ELETRÔNICA\nNúmero: 001234\nSérie: 1\nEmitente: TechSoft Soluções Ltda\nCNPJ: 12.345.678/0001-90\nDestinatário: ABC Comércio S.A.\nValor Total: R$ 15.750,00\nICMS: R$ 2.835,00\nDescrição: Serviços de desenvolvimento de software - Módulo ERP Financeiro\nData Emissão: 01/04/2026"
  },
  {
    id: "mf2", name: "DAS_03_2026.pdf", type: "pdf", size: "128 KB",
    clientName: "Café & Cia ME", category: "DAS",
    uploadedAt: "01/04/2026",
    extractedText: "DOCUMENTO DE ARRECADAÇÃO DO SIMPLES NACIONAL\nPeríodo de Apuração: 03/2026\nCNPJ: 98.765.432/0001-10\nRazão Social: Café & Companhia ME\nValor do DAS: R$ 1.234,56\nReceita Bruta: R$ 28.500,00\nAlíquota Efetiva: 4,33%\nVencimento: 20/04/2026\nCódigo de Barras: 85890.00001 23456.789012 34567.890123 1 98760000123456"
  },
  {
    id: "mf3", name: "Balanco_Q1_2026.xlsx", type: "xlsx", size: "2.3 MB",
    clientName: "Construtora Horizonte", category: "Balanço",
    uploadedAt: "31/03/2026",
    extractedText: "BALANÇO PATRIMONIAL - 1º TRIMESTRE 2026\nATIVO TOTAL: R$ 4.567.890,00\n  Ativo Circulante: R$ 1.234.567,00\n    Caixa e Equivalentes: R$ 345.678,00\n    Contas a Receber: R$ 567.890,00\n    Estoques: R$ 320.999,00\n  Ativo Não Circulante: R$ 3.333.323,00\nPASSIVO TOTAL: R$ 4.567.890,00\n  Passivo Circulante: R$ 987.654,00\n  Patrimônio Líquido: R$ 2.345.678,00"
  },
  {
    id: "mf4", name: "DARF_IRPJ_03_2026.pdf", type: "pdf", size: "95 KB",
    clientName: "AutoPeças Nacional", category: "DARF",
    uploadedAt: "28/03/2026",
    extractedText: "DOCUMENTO DE ARRECADAÇÃO DE RECEITAS FEDERAIS\nCódigo da Receita: 2089 - IRPJ\nPeríodo de Apuração: 03/2026\nCNPJ: 45.678.901/0001-23\nNome: AutoPeças Nacional Ltda\nValor do Principal: R$ 8.456,00\nValor da Multa: R$ 0,00\nValor dos Juros: R$ 0,00\nValor Total: R$ 8.456,00\nData de Vencimento: 30/04/2026"
  },
  {
    id: "mf5", name: "Contrato_Servicos_2026.docx", type: "docx", size: "320 KB",
    clientName: "TechSoft Ltda", category: "Contrato",
    uploadedAt: "15/03/2026",
    extractedText: "CONTRATO DE PRESTAÇÃO DE SERVIÇOS CONTÁBEIS\nCONTRATANTE: TechSoft Soluções Ltda\nCONTRATADA: Lótus Contabilidade\nOBJETO: Prestação de serviços contábeis, fiscais e trabalhistas\nVIGÊNCIA: 01/01/2026 a 31/12/2026\nHONORÁRIOS: R$ 3.500,00/mês\nCLÁUSULA 5: Obrigações da Contratada incluem escrituração contábil, apuração de impostos, folha de pagamento e obrigações acessórias."
  },
  {
    id: "mf6", name: "Folha_Pagamento_03_2026.csv", type: "csv", size: "78 KB",
    clientName: "Construtora Horizonte", category: "Folha",
    uploadedAt: "05/04/2026",
    extractedText: "FOLHA DE PAGAMENTO - MARÇO/2026\nTotal de Funcionários: 45\nSalário Bruto Total: R$ 187.500,00\nINSS Patronal: R$ 37.500,00\nFGTS: R$ 15.000,00\nIRRF Retido: R$ 12.350,00\nSalário Líquido Total: R$ 142.650,00\nHoras Extras: R$ 8.900,00\nBenefícios: R$ 22.500,00"
  },
  {
    id: "mf7", name: "SPED_Fiscal_03_2026.xml", type: "xml", size: "1.8 MB",
    clientName: "AutoPeças Nacional", category: "SPED",
    uploadedAt: "10/04/2026",
    extractedText: "ESCRITURAÇÃO FISCAL DIGITAL - EFD ICMS/IPI\nPeríodo: 03/2026\nCNPJ: 45.678.901/0001-23\nInscrição Estadual: 123.456.789.001\nTotal de Registros: 4.567\nNotas de Entrada: 234\nNotas de Saída: 189\nValor Total Entradas: R$ 456.789,00\nValor Total Saídas: R$ 678.901,00\nICMS a Recolher: R$ 34.567,00"
  },
];

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
  const [activeTab, setActiveTab] = useState("faturas");

  const filteredDocuments = documents.filter((doc) => {
    const statusMatch = filterStatus === "all" || doc.status === filterStatus;
    const monthMatch = doc.month === parseInt(filterMonth);
    const yearMatch = doc.year === parseInt(filterYear);
    const clientMatch = filterClient === "all" || doc.clientId === filterClient;
    return statusMatch && monthMatch && yearMatch && clientMatch;
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
      <div className="space-y-6">
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

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="rounded-2xl">
            <TabsTrigger value="faturas" className="rounded-xl">Faturas</TabsTrigger>
            <TabsTrigger value="arquivos" className="rounded-xl">Arquivos</TabsTrigger>
          </TabsList>

          <TabsContent value="faturas" className="space-y-4 mt-4">
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
                              toast.info("Visualizando documento...");
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
                {mockFiles.map((file) => (
                  <button
                    key={file.id}
                    onClick={() => setSelectedFile(file)}
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
                      </div>
                    </div>

                    <div className="border-t border-border pt-4">
                      <h4 className="text-sm font-medium text-muted-foreground mb-3">Texto Extraído</h4>
                      <ScrollArea className="h-[400px]">
                        <pre className="text-sm whitespace-pre-wrap bg-accent/30 rounded-xl p-4 font-mono leading-relaxed">
                          {selectedFile.extractedText}
                        </pre>
                      </ScrollArea>
                    </div>
                  </div>
                ) : (
                  <div className="glass rounded-2xl p-12 text-center text-muted-foreground">
                    <FileText className="h-16 w-16 mx-auto mb-4 opacity-30" />
                    <p className="text-lg font-medium">Selecione um arquivo</p>
                    <p className="text-sm">Clique em um arquivo à esquerda para visualizar o conteúdo extraído</p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Documents;
