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
    updateInvoice,
  } = useData();
  const [valueSort, setValueSort] = useState<"none" | "asc" | "desc">("none");
  const [dateSort, setDateSort] = useState<"newest" | "oldest">("newest");
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">(
    "all",
  );
  const [view, setView] = useState<"list" | "calendar" | "timeline">("list");
  const [dateRange, setDateRange] = useState(currentMonthRange);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<
    "boleto" | "pix" | "card" | null
  >(null);
  const [methodModalOpen, setMethodModalOpen] = useState(false);
  const [cardData, setCardData] = useState({
    number: "",
    name: "",
    expiry: "",
    cvv: "",
  });
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
    }));
  }, [clients, paymentRows]);

  const filteredPayments = payments
    .filter((p) => typeFilter === "all" || p.type === typeFilter)
    .slice()
    .sort((a, b) => {
      if (valueSort === "asc") return a.amount - b.amount;
      if (valueSort === "desc") return b.amount - a.amount;
      return dateSort === "newest"
        ? new Date(b.date).getTime() - new Date(a.date).getTime()
        : new Date(a.date).getTime() - new Date(b.date).getTime();
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
    const nextStatus: "completed" | "pending" =
      p.status === "completed" ? "pending" : "completed";
    await updatePayment(id, {
      status: nextStatus,
      paid_at: nextStatus === "completed" ? new Date().toISOString() : null,
    });
    if (p.invoiceId) {
      await updateInvoice(p.invoiceId, {
        status: nextStatus === "completed" ? "paid" : "pending",
      });
    }
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
                        {clients.map((client) => (
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

        <div className="flex flex-wrap items-center gap-3 animate-fade-in">
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
                Escolha uma forma de pagamento e consulte o extrato mensal.
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
                    onClick={() => {
                      setSelectedMethod(method.id as typeof selectedMethod);
                      setMethodModalOpen(true);
                    }}
                  >
                    <Icon className="h-5 w-5" />
                    {method.label}
                  </Button>
                );
              })}
            </div>
          </div>
        )}

        {/* Payment method modal */}
        <Dialog open={methodModalOpen} onOpenChange={setMethodModalOpen}>
          <DialogContent className="sm:max-w-[460px]">
            <DialogHeader>
              <DialogTitle>
                {selectedMethod === "boleto" && "Pagamento via Boleto"}
                {selectedMethod === "pix" && "Pagamento via Pix"}
                {selectedMethod === "card" && "Pagamento com Cartão"}
              </DialogTitle>
              <DialogDescription>
                {selectedMethod === "boleto" &&
                  "Use o código de barras abaixo para pagar em qualquer banco."}
                {selectedMethod === "pix" &&
                  "Escaneie o QR code ou copie a chave Pix."}
                {selectedMethod === "card" &&
                  "Preencha os dados do seu cartão de crédito."}
              </DialogDescription>
            </DialogHeader>

            {selectedMethod === "boleto" && (
              <div className="space-y-4">
                <div className="rounded-xl border border-border p-4 bg-card">
                  <div
                    className="flex items-end gap-px h-16 mb-3"
                    aria-label="código de barras"
                  >
                    {Array.from({ length: 60 }).map((_, i) => (
                      <div
                        key={i}
                        style={{
                          width: Math.random() > 0.5 ? 2 : 3,
                          height: "100%",
                          background:
                            Math.random() > 0.3
                              ? "hsl(var(--foreground))"
                              : "transparent",
                        }}
                      />
                    ))}
                  </div>
                  <p className="text-sm font-mono text-center break-all">
                    23793.38128 60028.123456 78901.234567 8 92340000150000
                  </p>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Valor</span>
                  <span className="font-semibold">R$ 1.500,00</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Vencimento</span>
                  <span className="font-semibold">10/02/2026</span>
                </div>
                <Button
                  className="w-full rounded-xl gap-2"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      "23793381286002812345678901234567892340000150000",
                    );
                    toast.success("Código copiado!");
                  }}
                >
                  <Copy className="h-4 w-4" />
                  Copiar código de barras
                </Button>
              </div>
            )}

            {selectedMethod === "pix" && (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <div className="rounded-xl border border-border p-4 bg-white">
                    <div
                      className="w-48 h-48 grid grid-cols-[repeat(20,1fr)] gap-px"
                      aria-label="QR code Pix"
                    >
                      {Array.from({ length: 400 }).map((_, i) => (
                        <div
                          key={i}
                          style={{
                            background: Math.random() > 0.5 ? "#000" : "#fff",
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-border p-3 bg-muted/40 text-xs font-mono break-all">
                  00020126360014BR.GOV.BCB.PIX0114+551199999999952040000530398654041500.005802BR5925LOTUS
                  CONTABILIDADE LTDA6009SAO PAULO62070503***6304ABCD
                </div>
                <Button
                  className="w-full rounded-xl gap-2"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      "00020126360014BR.GOV.BCB.PIX...",
                    );
                    toast.success("Chave Pix copiada!");
                  }}
                >
                  <Copy className="h-4 w-4" />
                  Copiar chave Pix
                </Button>
              </div>
            )}

            {selectedMethod === "card" && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Número do cartão</Label>
                  <Input
                    placeholder="0000 0000 0000 0000"
                    value={cardData.number}
                    onChange={(e) =>
                      setCardData({ ...cardData, number: e.target.value })
                    }
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nome impresso</Label>
                  <Input
                    placeholder="Nome como está no cartão"
                    value={cardData.name}
                    onChange={(e) =>
                      setCardData({ ...cardData, name: e.target.value })
                    }
                    className="rounded-xl"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Validade</Label>
                    <Input
                      placeholder="MM/AA"
                      value={cardData.expiry}
                      onChange={(e) =>
                        setCardData({ ...cardData, expiry: e.target.value })
                      }
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>CVV</Label>
                    <Input
                      placeholder="123"
                      value={cardData.cvv}
                      onChange={(e) =>
                        setCardData({ ...cardData, cvv: e.target.value })
                      }
                      className="rounded-xl"
                    />
                  </div>
                </div>
                <Button
                  className="w-full rounded-xl mt-2"
                  onClick={() => {
                    toast.success("Pagamento autorizado!");
                    setMethodModalOpen(false);
                  }}
                >
                  Pagar R$ 1.500,00
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {view === "timeline" && (
          <TimelineView
            title="Timeline financeira"
            events={payments.map((payment) => ({
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
                    className="flex items-center gap-4 p-4 rounded-xl hover:bg-accent/50 transition-colors border border-transparent hover:border-border cursor-pointer"
                    style={{ animationDelay: `${index * 50}ms` }}
                    onClick={() =>
                      viewMode !== "client" && handleToggleStatus(payment.id)
                    }
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
                        "cursor-pointer",
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
