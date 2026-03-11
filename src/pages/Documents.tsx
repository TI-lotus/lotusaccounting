import { useState, useRef } from "react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { FileText, Plus, Download, Eye, MoreHorizontal, Trash2, Send, Check, Upload } from "lucide-react";
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

interface Document {
  id: number;
  name: string;
  client: string;
  type: string;
  status: "paid" | "pending" | "overdue" | "final";
  amount: string;
  date: string;
  month: number;
  year: number;
}

const statusColors = {
  paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  overdue: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  final: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
};

const statusLabels = {
  paid: "Pago",
  pending: "Pendente",
  overdue: "Atrasado",
  final: "Finalizado",
};

const now = new Date();
const currentMonth = now.getMonth() + 1;
const currentYear = now.getFullYear();

const initialDocuments: Document[] = [
  { id: 1, name: "Fatura #1234", client: "Acme Corporation", type: "Fatura", status: "paid", amount: "R$ 12.500,00", date: "12 Jan, 2026", month: 1, year: 2026 },
  { id: 2, name: "Fatura #1231", client: "TechStart Inc", type: "Fatura", status: "pending", amount: "R$ 8.750,00", date: "10 Jan, 2026", month: 1, year: 2026 },
  { id: 3, name: "Relatório Financeiro Q4", client: "Interno", type: "Relatório", status: "final", amount: "-", date: "5 Jan, 2026", month: 1, year: 2026 },
  { id: 4, name: "Fatura #1228", client: "Global Finance", type: "Fatura", status: "paid", amount: "R$ 15.000,00", date: "9 Jan, 2026", month: 1, year: 2026 },
  { id: 5, name: "Fatura #1220", client: "Acme Corporation", type: "Fatura", status: "overdue", amount: "R$ 5.200,00", date: "28 Dez, 2025", month: 12, year: 2025 },
  { id: 6, name: "Fatura #1215", client: "DataFlow Systems", type: "Fatura", status: "paid", amount: "R$ 22.000,00", date: "20 Dez, 2025", month: 12, year: 2025 },
  { id: 7, name: "Contrato de Serviços", client: "Verde Soluções", type: "Contrato", status: "final", amount: "-", date: "15 Dez, 2025", month: 12, year: 2025 },
  { id: 8, name: "Fatura #1210", client: "Nexus Tecnologia", type: "Fatura", status: "pending", amount: "R$ 18.900,00", date: "10 Dez, 2025", month: 12, year: 2025 },
  { id: 9, name: "DAS Simples Nacional", client: "Interno", type: "Guia", status: "paid", amount: "R$ 1.230,00", date: "20 Nov, 2025", month: 11, year: 2025 },
  { id: 10, name: "Balancete Mensal", client: "Interno", type: "Relatório", status: "final", amount: "-", date: "05 Nov, 2025", month: 11, year: 2025 },
];

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

const Documents = () => {
  const [documents, setDocuments] = useState<Document[]>(initialDocuments);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterMonth, setFilterMonth] = useState<string>(String(currentMonth));
  const [filterYear, setFilterYear] = useState<string>(String(currentYear));
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newDoc, setNewDoc] = useState({
    name: "",
    client: "",
    type: "Fatura",
    amount: "",
  });

  const filteredDocuments = documents.filter((doc) => {
    const statusMatch = filterStatus === "all" || doc.status === filterStatus;
    const monthMatch = doc.month === parseInt(filterMonth);
    const yearMatch = doc.year === parseInt(filterYear);
    return statusMatch && monthMatch && yearMatch;
  });

  const handleAddDocument = () => {
    if (!newDoc.name || !newDoc.client) {
      toast.error("Preencha nome e cliente");
      return;
    }

    const doc: Document = {
      id: Date.now(),
      name: newDoc.name,
      client: newDoc.client,
      type: newDoc.type,
      status: "pending",
      amount: newDoc.amount ? `R$ ${newDoc.amount}` : "-",
      date: new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" }),
      month: currentMonth,
      year: currentYear,
    };

    setDocuments([doc, ...documents]);
    setNewDoc({ name: "", client: "", type: "Fatura", amount: "" });
    setDialogOpen(false);
    toast.success("Documento criado com sucesso!");
  };

  const handleDeleteDocument = (id: number) => {
    setDocuments(documents.filter((d) => d.id !== id));
    toast.success("Documento removido!");
  };

  const handleMarkAsPaid = (id: number) => {
    setDocuments(documents.map((d) => (d.id === id ? { ...d, status: "paid" as const } : d)));
    toast.success("Marcado como pago!");
  };

  const handleSendReminder = (doc: Document) => {
    toast.success(`Lembrete enviado para ${doc.client}!`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const count = files.length;
      toast.success(`${count} arquivo${count > 1 ? "s" : ""} enviado${count > 1 ? "s" : ""} com sucesso!`);
      // Reset input
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
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileUpload}
            />
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
                  <DialogDescription>
                    Crie uma nova fatura ou documento.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="docType">Tipo</Label>
                    <Select
                      value={newDoc.type}
                      onValueChange={(value) => setNewDoc({ ...newDoc, type: value })}
                    >
                      <SelectTrigger className="rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Fatura">Fatura</SelectItem>
                        <SelectItem value="Relatório">Relatório</SelectItem>
                        <SelectItem value="Contrato">Contrato</SelectItem>
                        <SelectItem value="Proposta">Proposta</SelectItem>
                        <SelectItem value="Guia">Guia</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="docName">Nome do Documento</Label>
                    <Input
                      id="docName"
                      value={newDoc.name}
                      onChange={(e) => setNewDoc({ ...newDoc, name: e.target.value })}
                      placeholder="Ex: Fatura #1235"
                      className="rounded-xl"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="docClient">Cliente</Label>
                    <Input
                      id="docClient"
                      value={newDoc.client}
                      onChange={(e) => setNewDoc({ ...newDoc, client: e.target.value })}
                      placeholder="Nome da empresa"
                      className="rounded-xl"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="docAmount">Valor (opcional)</Label>
                    <Input
                      id="docAmount"
                      value={newDoc.amount}
                      onChange={(e) => setNewDoc({ ...newDoc, amount: e.target.value })}
                      placeholder="0,00"
                      className="rounded-xl"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">
                    Cancelar
                  </Button>
                  <Button onClick={handleAddDocument} className="rounded-xl">
                    Criar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center animate-fade-in">
          <div className="flex gap-2">
            <Button
              variant={filterStatus === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterStatus("all")}
              className="rounded-lg"
            >
              Todos
            </Button>
            <Button
              variant={filterStatus === "pending" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterStatus("pending")}
              className="rounded-lg"
            >
              Pendentes
            </Button>
            <Button
              variant={filterStatus === "paid" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterStatus("paid")}
              className="rounded-lg"
            >
              Pagos
            </Button>
            <Button
              variant={filterStatus === "overdue" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterStatus("overdue")}
              className="rounded-lg"
            >
              Atrasados
            </Button>
          </div>
          <div className="ml-auto flex gap-2">
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="w-[140px] rounded-lg h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger className="w-[100px] rounded-lg h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={y}>{y}</SelectItem>
                ))}
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
                  <tr
                    key={doc.id}
                    className="border-b border-border last:border-0 hover:bg-accent/30 transition-colors"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-accent">
                          <FileText className="h-4 w-4 text-accent-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">{doc.name}</p>
                          <p className="text-xs text-muted-foreground">{doc.date}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 hidden md:table-cell text-muted-foreground">{doc.client}</td>
                    <td className="p-4 hidden sm:table-cell text-muted-foreground">{doc.type}</td>
                    <td className="p-4">
                      <Badge className={statusColors[doc.status]} variant="secondary">
                        {statusLabels[doc.status]}
                      </Badge>
                    </td>
                    <td className="p-4 text-right font-medium">{doc.amount}</td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => toast.info("Visualizando documento...")}>
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
                            <DropdownMenuItem
                              className="gap-2 text-destructive focus:text-destructive"
                              onClick={() => handleDeleteDocument(doc.id)}
                            >
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
