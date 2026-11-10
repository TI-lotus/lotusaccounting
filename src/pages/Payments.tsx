import { useMemo, useState } from "react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import {
  Plus,
  Calendar,
  List,
  Barcode,
  QrCode,
  CreditCard,
  Clock3,
  ArrowDownCircle,
  ArrowUpCircle,
  Copy,
  CheckCircle2,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { CalendarEventView } from "@/components/CalendarEventView";
import { TimelineView } from "@/components/TimelineView";
import { useViewMode } from "@/contexts/ViewModeContext";
import { useData } from "@/contexts/DataContext";

interface Payment {
  id: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  status: "completed" | "pending";
  date: string;
  rawDate: string | null;
  category: string;
  companyId: string | null;
  invoiceId: string | null;
  clientName: string;
  reconciledAt: string | null;
}

const currentMonthRange = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return {
    start: `${year}-${String(month).padStart(2, "0")}-01`,
    end: new Date(year, month, 0).toISOString().slice(0, 10),
  };
};

const Payments = () => {
  const { viewMode } = useViewMode();
  const {
    tenantId,
    clients,
    invoices,
    payments: paymentRows,
    addPayment,
    updatePayment,
  } = useData();
  const [valueSort, setValueSort] = useState<"none" | "asc" | "desc">("none");
  const [dateSort, setDateSort] = useState<"newest" | "oldest">("newest");
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">(
    "all",
  );
  const [view, setView] = useState<"list" | "calendar" | "timeline">("list");
  const [dateRange, setDateRange] = useState(currentMonthRange);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newPayment, setNewPayment] = useState({
    description: "",
    amount: "",
    type: "income" as "income" | "expense",
    category: "",
    companyId: "",
    invoiceId: "",
  });

  const fmt = (iso: string | null) =>
    new Date(iso ?? Date.now()).toLocaleDateString("pt-BR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  const payments = useMemo<Payment[]>(() => {
    const clientNameById = new Map(
      clients.map((client) => [client.id, client.name]),
    );
    return paymentRows.map((row) => ({
      id: row.id,
      description: row.description ?? `Pagamento ${row.id.slice(0, 6)}`,
      amount: Number(row.amount),
      type:
        row.direction === "saida" || row.direction === "expense"
          ? "expense"
          : "income",
      status:
        row.status === "completed" || row.status === "paid"
          ? "completed"
          : "pending",
      date: fmt(row.paid_at ?? row.due_date ?? row.created_at),
      rawDate: row.paid_at ?? row.due_date ?? row.created_at,
      category: row.category ?? row.method ?? "Outros",
      companyId: row.company_id,
      invoiceId: row.invoice_id,
      clientName: row.company_id
        ? (clientNameById.get(row.company_id) ?? "Cliente não encontrado")
        : "Sem cliente",
      reconciledAt: row.reconciled_at,
    }));
  }, [clients, paymentRows]);

  const filteredPayments = payments
    .filter((p) => typeFilter === "all" || p.type === typeFilter)
    .slice()
    .sort((a, b) => {
      if (valueSort === "asc") return a.amount - b.amount;
      if (valueSort === "desc") return b.amount - a.amount;
      return dateSort === "newest"
        ? new Date(b.rawDate ?? 0).getTime() - new Date(a.rawDate ?? 0).getTime()
        : new Date(a.rawDate ?? 0).getTime() - new Date(b.rawDate ?? 0).getTime();
    });

  const handleAddPayment = async () => {
    if (!newPayment.description || !newPayment.amount) {
      toast.error("Preencha descrição e valor");
      return;
    }
    if (!tenantId) {
      toast.error("Tenant não encontrado");
      return;
    }

    const amount = parseFloat(newPayment.amount);
    const saved = await addPayment({
      amount,
      status: "pending",
      direction: newPayment.type === "income" ? "entrada" : "saida",
      description: newPayment.description,
      category: newPayment.category || "Outros",
      company_id: newPayment.companyId || null,
      due_date:
        invoices.find((invoice) => invoice.id === newPayment.invoiceId)
          ?.due_date ?? null,
      invoice_id: newPayment.invoiceId || null,
      method: null,
      paid_at: null,
    });
    if (!saved) return;

    setNewPayment({
      description: "",
      amount: "",
      type: "income",
      category: "",
      companyId: "",
      invoiceId: "",
    });
    setDialogOpen(false);
    toast.success("Pagamento registrado com sucesso!");
  };

  const handleToggleStatus = async (id: string) => {
    const p = payments.find((x) => x.id === id);
    if (!p) return;
    if (p.reconciledAt) {
      toast.error("Pagamentos conciliados não podem ter o status alterado manualmente.");
      return;
    }
    const nextStatus: "completed" | "pending" =
      p.status === "completed" ? "pending" : "completed";
    if (!await updatePayment(id, {
      status: nextStatus,
      paid_at: nextStatus === "completed" ? new Date().toISOString() : null,
    })) return;
    toast.success("Status atualizado!");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between animate-fade-in">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Pagamentos
            </h1>
            <p className="text-muted-foreground">
              Acompanhe entradas e saídas financeiras
            </p>
          </div>
          {viewMode !== "client" && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-xl gap-2">
                  <Plus className="h-4 w-4" />
                  Registrar Pagamento
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Novo Pagamento</DialogTitle>
                  <DialogDescription>
                    Registre uma nova entrada ou saída financeira.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="type">Tipo</Label>
                    <Select
                      value={newPayment.type}
                      onValueChange={(value: "income" | "expense") =>
                        setNewPayment({ ...newPayment, type: value })
                      }
                    >
                      <SelectTrigger className="rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="income">Entrada</SelectItem>
                        <SelectItem value="expense">Saída</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="description">Descrição</Label>
                    <Input
                      id="description"
                      value={newPayment.description}
                      onChange={(e) =>
                        setNewPayment({
                          ...newPayment,
                          description: e.target.value,
                        })
                      }
                      placeholder="Ex: Fatura #1234"
                      className="rounded-xl"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Cliente</Label>
                    <Select
                      value={newPayment.companyId}
                      onValueChange={(value) =>
                        setNewPayment({
                          ...newPayment,
                          companyId: value,
                          invoiceId: "",
                        })
                      }
                    >
                      <SelectTrigger className="rounded-xl">
                        <SelectValue placeholder="Selecione um cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients.filter((client) => client.status === "active").map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Fatura vinculada</Label>
                    <Select
                      value={newPayment.invoiceId}
                      onValueChange={(value) =>
                        setNewPayment({ ...newPayment, invoiceId: value })
                      }
                    >
                      <SelectTrigger className="rounded-xl">
                        <SelectValue placeholder="Opcional" />
                      </SelectTrigger>
                      <SelectContent>
                        {invoices
                          .filter(
                            (invoice) =>
                              !newPayment.companyId ||
                              invoice.company_id === newPayment.companyId,
                          )
                          .map((invoice) => (
                            <SelectItem key={invoice.id} value={invoice.id}>
                              {invoice.number ||
                                `Fatura ${invoice.id.slice(0, 8)}`}{" "}
                              · R${" "}
                              {Number(invoice.amount).toLocaleString("pt-BR")}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="amount">Valor (R$)</Label>
                    <Input
                      id="amount"
                      type="number"
                      value={newPayment.amount}
                      onChange={(e) =>
                        setNewPayment({ ...newPayment, amount: e.target.value })
                      }
                      placeholder="0,00"
                      className="rounded-xl"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="category">Categoria</Label>
                    <Input
                      id="category"
                      value={newPayment.category}
                      onChange={(e) =>
                        setNewPayment({
                          ...newPayment,
                          category: e.target.value,
                        })
                      }
                      placeholder="Ex: Serviços, Software"
                      className="rounded-xl"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                    className="rounded-xl"
                  >
                    Cancelar
                  </Button>
                  <Button onClick={handleAddPayment} className="rounded-xl">
                    Registrar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="filter-toolbar flex flex-wrap items-center gap-3 animate-fade-in">
          <div className="flex rounded-2xl border border-border bg-card p-1">
            {[
              { value: "list", label: "Lista", icon: List },
              { value: "calendar", label: "Calendário", icon: Calendar },
              { value: "timeline", label: "Timeline", icon: Clock3 },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  key={item.value}
                  variant={view === item.value ? "default" : "ghost"}
                  size="sm"
                  className="rounded-xl"
                  onClick={() => setView(item.value as typeof view)}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Button>
              );
            })}
          </div>
          <div className="flex rounded-2xl border border-border bg-card p-1">
            <Button
              variant={typeFilter === "all" ? "default" : "ghost"}
              size="sm"
              className="rounded-xl"
              onClick={() => setTypeFilter("all")}
            >
              Todos
            </Button>
            <Button
              variant={typeFilter === "income" ? "default" : "ghost"}
              size="sm"
              className="rounded-xl"
              onClick={() => setTypeFilter("income")}
            >
              <ArrowDownCircle className="h-4 w-4" />
              Entradas
            </Button>
            <Button
              variant={typeFilter === "expense" ? "default" : "ghost"}
              size="sm"
              className="rounded-xl"
              onClick={() => setTypeFilter("expense")}
            >
              <ArrowUpCircle className="h-4 w-4" />
              Saídas
            </Button>
          </div>
        </div>

        {viewMode === "client" && (
          <div className="glass rounded-2xl p-5 space-y-4 animate-fade-in">
            <div>
              <h2 className="text-lg font-semibold">
                Pagamento de honorários Lotus
              </h2>
              <p className="text-sm text-muted-foreground">
                Consulte o extrato mensal. Pagamento online indisponível.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {[
                { id: "boleto", label: "Gerar boleto", icon: Barcode },
                { id: "pix", label: "Pagar com Pix", icon: QrCode },
                { id: "card", label: "Pagar com cartão", icon: CreditCard },
              ].map((method) => {
                const Icon = method.icon;
                return (
                  <Button
                    key={method.id}
                    variant="outline"
                    className="h-20 rounded-xl flex-col"
                    disabled
                  >
                    <Icon className="h-5 w-5" />
                    {method.label}
                  </Button>
                );
              })}
            </div>
          </div>
        )}


        {view === "timeline" && (
          <TimelineView
            title="Timeline financeira"
            events={payments.map((payment, index) => ({
              day: payment.rawDate ? new Date(payment.rawDate).getDate() : 1,
              title: payment.description,
              subtitle: payment.category,
              time: `${9 + (index % 8)}:00`,
              amount: `${payment.type === "income" ? "+" : "-"}R$ ${payment.amount.toLocaleString("pt-BR")}`,
              status: payment.status === "completed" ? "Concluído" : "Pendente",
            }))}
          />
        )}

        {view === "calendar" && (
          <CalendarEventView
            title="Calendário financeiro"
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            events={payments.map((payment) => ({
              day: payment.rawDate ? new Date(payment.rawDate).getDate() : 1,
              title: payment.description,
              subtitle: payment.category,
              time: "09:00",
              amount: `${payment.type === "income" ? "+" : "-"}R$ ${payment.amount.toLocaleString("pt-BR")}`,
              status: payment.status === "completed" ? "Concluído" : "Pendente",
            }))}
          />
        )}

        {view === "list" && (
          <div className="glass rounded-2xl p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Pagamentos Recentes</h3>
              <div className="flex gap-2">
                <Select
                  value={valueSort}
                  onValueChange={(value: typeof valueSort) =>
                    setValueSort(value)
                  }
                >
                  <SelectTrigger className="h-9 w-[170px] rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Valor</SelectItem>
                    <SelectItem value="desc">Maior valor</SelectItem>
                    <SelectItem value="asc">Menor valor</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={dateSort}
                  onValueChange={(value: typeof dateSort) => setDateSort(value)}
                >
                  <SelectTrigger className="h-9 w-[150px] rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Mais novo</SelectItem>
                    <SelectItem value="oldest">Mais antigo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-3">
              {filteredPayments.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Nenhum pagamento registrado ainda.
                </p>
              ) : (
                filteredPayments.map((payment, index) => (
                  <div
                    key={payment.id}
                    className="flex items-center gap-4 p-4 rounded-xl hover:bg-accent/50 transition-colors border border-transparent hover:border-border"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div
                      className={cn(
                        "p-2 rounded-xl w-2 h-8 shrink-0",
                        payment.type === "income"
                          ? "bg-emerald-500"
                          : "bg-red-500",
                      )}
                    />

                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {payment.description}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>{payment.date}</span>
                        <span>•</span>
                        <span>{payment.category}</span>
                        <span>•</span>
                        <span className="truncate">{payment.clientName}</span>
                      </div>
                    </div>
                    <Badge
                      variant={
                        payment.status === "completed" ? "default" : "secondary"
                      }
                      className={cn(
                        payment.status === "completed" &&
                          "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-400",
                      )}
                    >
                      {payment.status === "completed"
                        ? "Concluído"
                        : "Pendente"}
                    </Badge>
                    <p
                      className={cn(
                        "font-semibold min-w-[100px] text-right",
                        payment.type === "income"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400",
                      )}
                    >
                      {payment.type === "income" ? "+" : "-"}R${" "}
                      {payment.amount.toLocaleString("pt-BR")}
                    </p>
                    {viewMode !== "client" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl"
                        disabled={!!payment.reconciledAt}
                        onClick={() => handleToggleStatus(payment.id)}
                      >
                        {payment.status === "completed" ? (
                          <RotateCcw className="mr-2 h-4 w-4" />
                        ) : (
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                        )}
                        {payment.reconciledAt ? "Conciliado" : payment.status === "completed" ? "Reabrir" : "Confirmar"}
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Payments;
