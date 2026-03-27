import { useState, useRef } from "react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { FileText, Plus, Download, Eye, MoreHorizontal, Trash2, Send, Check, Upload } from "lucide-react";
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

const Documents = () => {
  const { documents, addDocument, updateDocument, deleteDocument, processFileUpload, clients } = useData();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterMonth, setFilterMonth] = useState<string>(String(currentMonth));
  const [filterYear, setFilterYear] = useState<string>(String(currentYear));
  const [filterClient, setFilterClient] = useState<string>("all");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newDoc, setNewDoc] = useState({ name: "", client: "", type: "fatura" as DocumentType, amount: "" });

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
            <Button variant="outline" className="rounded-xl gap-2" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4" />
              Enviar Arquivos
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-xl gap-2">
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
                      <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(documentTypeLabels).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="docName">Nome do Documento</Label>
                    <Input id="docName" value={newDoc.name} onChange={(e) => setNewDoc({ ...newDoc, name: e.target.value })} placeholder="Ex: Fatura #1235" className="rounded-xl" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="docClient">Cliente</Label>
                    <Select value={newDoc.client} onValueChange={(v) => setNewDoc({ ...newDoc, client: v })}>
                      <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
                      <SelectContent>
                        {clients.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="docAmount">Valor (opcional)</Label>
                    <Input id="docAmount" type="number" value={newDoc.amount} onChange={(e) => setNewDoc({ ...newDoc, amount: e.target.value })} placeholder="0,00" className="rounded-xl" />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">Cancelar</Button>
                  <Button onClick={handleAddDocument} className="rounded-xl">Criar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center animate-fade-in">
          <div className="flex gap-2">
            {["all", "pending", "paid", "overdue", "unread"].map((s) => (
              <Button key={s} variant={filterStatus === s ? "default" : "outline"} size="sm" onClick={() => setFilterStatus(s)} className="rounded-lg">
                {s === "all" ? "Todos" : statusLabels[s] || s}
              </Button>
            ))}
          </div>
          <div className="ml-auto flex gap-2">
            <Select value={filterClient} onValueChange={setFilterClient}>
              <SelectTrigger className="w-[160px] rounded-lg h-9 text-sm"><SelectValue placeholder="Todos clientes" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos clientes</SelectItem>
                {clients.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="w-[140px] rounded-lg h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {months.map((m) => (<SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger className="w-[100px] rounded-lg h-9 text-sm"><SelectValue /></SelectTrigger>
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
                        <div className="p-2 rounded-lg bg-accent">
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
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => {
                          if (doc.status === "unread") handleMarkAsRead(doc.id);
                          toast.info("Visualizando documento...");
                        }}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => toast.success("Download iniciado!")}>
                          <Download className="h-4 w-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl">
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
      </div>
    </DashboardLayout>
  );
};

export default Documents;
