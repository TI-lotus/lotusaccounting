import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import {
  Plus,
  Calendar,
  List,
  CreditCard,
  Clock3,
  Copy,
  CheckCircle2,
  RotateCcw,
  ArrowUp,
  ArrowDown,
  Eye,
  ExternalLink,
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
import { FilterPopover } from "@/components/FilterPopover";
import { IconTooltipButton } from "@/components/IconTooltipButton";
import { SortToggle } from "@/components/SortToggle";
import { BentoDataTable } from "@/components/BentoDataTable";
import { RowActions } from "@/components/RowActions";
import { MultiSelectFilter } from "@/components/MultiSelectFilter";

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

const currentQuarterRange = () => {
  const now = new Date();
  const year = now.getFullYear();
  const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
  return {
    start: `${year}-${String(quarterStartMonth + 1).padStart(2, "0")}-01`,
    end: new Date(year, quarterStartMonth + 3, 0).toISOString().slice(0, 10),
  };
};

type PaymentStatusFilter = "completed" | "pending";
type PaymentDateFilter = "all" | "month" | "quarter" | "custom";

const Payments = () => {
  const navigate = useNavigate();
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
  const [typeFilters, setTypeFilters] = useState<Payment["type"][]>([]);
  const [statusFilters, setStatusFilters] = useState<PaymentStatusFilter[]>([]);
  const [dateFilter, setDateFilter] = useState<PaymentDateFilter>("all");
  const [view, setView] = useState<"list" | "calendar" | "timeline">("list");
  const [dateRange, setDateRange] = useState(currentMonthRange);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [newPayment, setNewPayment] = useState({
    description: "",
    amount: "",
    type: "income" as "income" | "expense",
    category: "",
    companyId: "",
    invoiceId: "",
  });

  const handleDateFilterChange = (next: PaymentDateFilter) => {
    setDateFilter(next);
    if (next === "month") setDateRange(currentMonthRange());
    if (next === "quarter") setDateRange(currentQuarterRange());
  };

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
    .filter((p) => typeFilters.length === 0 || typeFilters.includes(p.type))
    .filter((p) => statusFilters.length === 0 || statusFilters.includes(p.status))
    .filter((p) => {
      if (dateFilter === "all") return true;
      if (!p.rawDate) return false;
      return p.rawDate.slice(0, 10) >= dateRange.start && p.rawDate.slice(0, 10) <= dateRange.end;
    })
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

  const paymentViewControls = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-full border border-border bg-card p-1">
        {[
          { value: "list", label: "Lista", icon: List },
          { value: "calendar", label: "Calendário", icon: Calendar },
          { value: "timeline", label: "Timeline", icon: Clock3 },
        ].map((item) => (
          <IconTooltipButton
            key={item.value}
            icon={item.icon}
            label={item.label}
            variant={view === item.value ? "default" : "ghost"}
            className="rounded-full"
            aria-pressed={view === item.value}
            onClick={() => setView(item.value as typeof view)}
          />
        ))}
      </div>
      <FilterPopover
        title="Filtrar e ordenar pagamentos"
        description="Combine tipo, status, período e ordenação em um único controle."
        activeCount={[typeFilters.length > 0, statusFilters.length > 0, dateFilter !== "all", valueSort !== "none", dateSort !== "newest"].filter(Boolean).length}
        onClear={() => {
          setTypeFilters([]);
          setStatusFilters([]);
          handleDateFilterChange("all");
          setValueSort("none");
          setDateSort("newest");
        }}
      >
        <MultiSelectFilter
          label="Tipo"
          emptyLabel="Entradas e saídas"
          options={[
            { value: "income", label: "Entradas" },
            { value: "expense", label: "Saídas" },
          ]}
          value={typeFilters}
          onChange={(value) => setTypeFilters(value as Payment["type"][])}
        />
        <MultiSelectFilter
          label="Status"
          emptyLabel="Todos os status"
          options={[
            { value: "completed", label: "Concluídos" },
            { value: "pending", label: "Pendentes" },
          ]}
          value={statusFilters}
          onChange={(value) => setStatusFilters(value as PaymentStatusFilter[])}
        />
        <div className="space-y-1.5">
          <Label htmlFor="payment-date-filter">Período</Label>
          <Select value={dateFilter} onValueChange={(value: PaymentDateFilter) => handleDateFilterChange(value)}>
            <SelectTrigger id="payment-date-filter" className="w-full rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os períodos</SelectItem>
              <SelectItem value="month">Mês atual</SelectItem>
              <SelectItem value="quarter">Trimestre atual</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {dateFilter === "custom" && (
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1 text-xs font-medium text-muted-foreground" htmlFor="payment-date-start">
              Início
              <Input id="payment-date-start" type="date" value={dateRange.start} max={dateRange.end} onChange={(event) => event.target.value && setDateRange({ ...dateRange, start: event.target.value })} />
            </label>
            <label className="space-y-1 text-xs font-medium text-muted-foreground" htmlFor="payment-date-end">
              Fim
              <Input id="payment-date-end" type="date" value={dateRange.end} min={dateRange.start} onChange={(event) => event.target.value && setDateRange({ ...dateRange, end: event.target.value })} />
            </label>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="payment-value-sort">Valor</Label>
            <Select value={valueSort} onValueChange={(value: typeof valueSort) => setValueSort(value)}>
              <SelectTrigger id="payment-value-sort" className="w-full rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem ordenação</SelectItem>
                <SelectItem value="desc">Maior valor</SelectItem>
                <SelectItem value="asc">Menor valor</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="payment-date-sort">Data</Label>
            <Select value={dateSort} onValueChange={(value: typeof dateSort) => setDateSort(value)}>
              <SelectTrigger id="payment-date-sort" className="w-full rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Mais novo</SelectItem>
                <SelectItem value="oldest">Mais antigo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </FilterPopover>
      <SortToggle
        label="data do lançamento"
        direction={dateSort === "newest" ? "desc" : "asc"}
        onChange={(direction) => setDateSort(direction === "asc" ? "oldest" : "newest")}
      />
      <SortToggle
        label="valor"
        direction={valueSort === "asc" ? "asc" : "desc"}
        onChange={(direction) => setValueSort(direction)}
      />
    </div>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between animate-fade-in">
          <div>
            <h1 className="text-[28px] font-normal tracking-[-0.035em]">
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
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/70 bg-secondary/35 p-4">
              <CreditCard className="h-5 w-5 text-gilver" aria-hidden="true" />
              <p className="min-w-0 flex-1 text-sm text-muted-foreground">Boleto, Pix e cartão serão habilitados quando a cobrança online estiver conectada.</p>
              <Button variant="ghost" className="rounded-full border-0" disabled>Em breve</Button>
            </div>
          </div>
        )}


        {view === "timeline" && (
          <TimelineView
            title="Timeline financeira"
            headerActions={paymentViewControls}
            events={filteredPayments.map((payment, index) => ({
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
            headerActions={paymentViewControls}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            events={filteredPayments.map((payment) => ({
              day: payment.rawDate ? new Date(payment.rawDate).getDate() : 1,
              date: payment.rawDate ?? undefined,
              title: payment.description,
              subtitle: payment.category,
              time: "09:00",
              amount: `${payment.type === "income" ? "+" : "-"}R$ ${payment.amount.toLocaleString("pt-BR")}`,
              status: payment.status === "completed" ? "Concluído" : "Pendente",
            }))}
          />
        )}

        {view === "list" && (
          <section className="page-section animate-fade-in space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-medium">Pagamentos recentes</h2>
                <p className="mt-1 text-sm text-muted-foreground">Extrato de recebimentos e despesas do workspace.</p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Badge variant="secondary">{filteredPayments.length} registros</Badge>
                {paymentViewControls}
              </div>
            </div>
            <BentoDataTable
              rows={filteredPayments}
              getRowKey={(payment) => payment.id}
              empty="Nenhum pagamento registrado ainda."
              columns={[
                {
                  key: "reference",
                  label: "Referência",
                  render: (payment) => <div className="min-w-0"><p className="max-w-[220px] truncate font-medium">{payment.description}</p><p className="max-w-[220px] truncate text-xs text-muted-foreground">{payment.clientName}</p></div>,
                },
                {
                  key: "date",
                  label: "Data",
                  sortValue: (payment) => payment.rawDate ? new Date(payment.rawDate) : null,
                  render: (payment) => <span className="whitespace-nowrap text-sm text-muted-foreground">{payment.date}</span>,
                },
                {
                  key: "type",
                  label: "Tipo",
                  render: (payment) => { const Icon = payment.type === "income" ? ArrowUp : ArrowDown; return <span className={cn("inline-flex items-center gap-2 text-sm", payment.type === "income" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}><Icon className="h-4 w-4" aria-hidden="true" />{payment.type === "income" ? "Receita" : "Despesa"}</span>; },
                },
                {
                  key: "category",
                  label: "Categoria",
                  render: (payment) => <span className="text-sm text-muted-foreground">{payment.category}</span>,
                },
                {
                  key: "value",
                  label: "Valor",
                  sortValue: (payment) => payment.amount,
                  className: "text-right font-medium tabular-nums",
                  headerClassName: "text-right",
                  render: (payment) => <span className={cn("whitespace-nowrap", payment.type === "income" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>{payment.type === "income" ? "+" : "-"} {payment.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>,
                },
                {
                  key: "status",
                  label: "Status",
                  render: (payment) => <Badge variant={payment.status === "completed" ? "default" : "secondary"}>{payment.status === "completed" ? "Concluído" : "Pendente"}</Badge>,
                },
              ]}
              actions={(payment) => (
                <RowActions
                  primaryLabel={viewMode === "client" ? "Ver detalhes" : payment.reconciledAt ? "Já conciliado" : payment.status === "completed" ? "Reabrir pagamento" : "Confirmar pagamento"}
                  primaryIcon={viewMode === "client" ? Eye : payment.status === "completed" ? RotateCcw : CheckCircle2}
                  primaryDisabled={viewMode !== "client" && Boolean(payment.reconciledAt)}
                  onPrimary={() => { if (viewMode === "client") setSelectedPayment(payment); else void handleToggleStatus(payment.id); }}
                  menuItems={[
                    { label: "Ver detalhes", icon: Eye, onSelect: () => setSelectedPayment(payment) },
                    { label: "Abrir conciliação", icon: ExternalLink, onSelect: () => navigate("/reconciliation") },
                  ]}
                />
              )}
            />
          </section>
        )}
      </div>
      <Dialog open={Boolean(selectedPayment)} onOpenChange={(open) => !open && setSelectedPayment(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedPayment?.description}</DialogTitle>
            <DialogDescription>Detalhes do lançamento financeiro.</DialogDescription>
          </DialogHeader>
          {selectedPayment && (
            <dl className="grid grid-cols-2 gap-4 rounded-2xl border border-border/70 bg-secondary/35 p-4 text-sm">
              <div><dt className="text-xs text-muted-foreground">Referência</dt><dd className="mt-1 font-medium break-words">{selectedPayment.description}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Valor</dt><dd className="mt-1 font-medium tabular-nums">{selectedPayment.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Data</dt><dd className="mt-1">{selectedPayment.date}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Tipo</dt><dd className="mt-1">{selectedPayment.type === "income" ? "Receita" : "Despesa"}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Categoria</dt><dd className="mt-1">{selectedPayment.category}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Cliente</dt><dd className="mt-1 break-words">{selectedPayment.clientName}</dd></div>
            </dl>
          )}
          <DialogFooter><Button variant="ghost" className="border-0" onClick={() => setSelectedPayment(null)}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Payments;
