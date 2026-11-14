import { useState } from "react";
import { PageShell } from "@/components/PageShell";
import { MultiSelectFilter } from "@/components/MultiSelectFilter";
import { FilterPopover } from "@/components/FilterPopover";
import { EmptyState, LoadingState } from "@/components/PageStates";
import { DetailSheet } from "@/components/DetailSheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Receipt, Eye, ExternalLink, CheckCircle2, Trash2, Search, XCircle } from "lucide-react";
import { useData } from "@/contexts/DataContext";
import { useViewMode } from "@/contexts/ViewModeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspacePermission } from "@/hooks/useWorkspacePermission";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { toastWithUndo } from "@/lib/toastUndo";
import { BentoDataTable } from "@/components/BentoDataTable";
import { RowActions } from "@/components/RowActions";
import { ConfirmDestructiveDialog } from "@/components/ConfirmDestructiveDialog";

type Invoice = Pick<
  Database["public"]["Tables"]["invoices"]["Row"],
  | "id"
  | "number"
  | "amount"
  | "status"
  | "issued_at"
  | "due_date"
  | "company_id"
>;

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmt = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("pt-BR") : "—";

const statusMeta: Record<string, { label: string; className: string }> = {
  paid: {
    label: "Paga",
    className: "bg-emerald-500 hover:bg-emerald-500 text-white",
  },
  pending: {
    label: "Pendente",
    className: "bg-amber-500 hover:bg-amber-500 text-white",
  },
  overdue: {
    label: "Atrasada",
    className: "bg-red-500 hover:bg-red-500 text-white",
  },
  draft: { label: "Rascunho", className: "" },
  cancelled: {
    label: "Cancelada",
    className: "bg-muted text-muted-foreground",
  },
  canceled: {
    label: "Cancelada",
    className: "bg-muted text-muted-foreground",
  },
};

const Invoices = () => {
  const { viewMode } = useViewMode();
  const isClientView = viewMode === "client";
  const {
    tenantId,
    loading,
    clients,
    invoices,
    addInvoice,
    deleteInvoice,
    addPayment,
    updateInvoice,
    generateMonthlyServiceFeeInvoices,
  } = useData();
  const { user, profile } = useAuth();
  const canCreateFinancial = useWorkspacePermission({
    tenantId,
    userId: user?.id,
    accountType: profile?.account_type,
    resource: "financial",
    action: "create",
  });
  const canDeleteFinancial = useWorkspacePermission({
    tenantId,
    userId: user?.id,
    accountType: profile?.account_type,
    resource: "financial",
    action: "delete",
  });
  const canUpdateFinancial = useWorkspacePermission({
    tenantId,
    userId: user?.id,
    accountType: profile?.account_type,
    resource: "financial",
    action: "update",
  });
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [invoiceToCancel, setInvoiceToCancel] = useState<Invoice | null>(null);
  const [form, setForm] = useState({
    number: "",
    amount: "",
    company_id: "",
    due_date: "",
    status: "pending",
  });
  const activeClients = clients.filter((client) => client.status === "active");

  const create = async () => {
    if (!canCreateFinancial) {
      toast.error("Seu perfil não tem permissão para criar faturas.");
      return;
    }
    if (!tenantId || !form.amount) {
      toast.error("Preencha o valor");
      return;
    }
    if (form.status === "paid") {
      toast.error("Crie a fatura como pendente e registre o pagamento para marcá-la como paga.");
      return;
    }
    const saved = await addInvoice({
      number: form.number || null,
      amount: Number(form.amount),
      status: form.status,
      due_date: form.due_date || null,
      company_id: form.company_id || null,
      issued_at: new Date().toISOString(),
    });
    if (!saved) return;
    toast.success("Fatura criada");
    setOpen(false);
    setForm({
      number: "",
      amount: "",
      company_id: "",
      due_date: "",
      status: "pending",
    });
  };

  const generateServiceFeeInvoices = async () => {
    if (!canCreateFinancial) {
      toast.error("Seu perfil não tem permissão para gerar faturas.");
      return;
    }
    const created = await generateMonthlyServiceFeeInvoices();
    if (created > 0) {
      toast.success(`${created} fatura(s) mensal(is) de honorários gerada(s)`);
    } else {
      toast.info("Nenhuma fatura nova foi gerada para este mês");
    }
  };

  const removeInvoice = (inv: Invoice) => {
    if (!canDeleteFinancial) {
      toast.error("Seu perfil não tem permissão para remover faturas.");
      return;
    }
    setSelected(null);
    toastWithUndo({
      message: "Remoção de fatura agendada",
      description: inv.number || inv.id.slice(0, 8),
      onUndo: () => undefined,
      onConfirm: async () => {
        await deleteInvoice(inv.id);
      },
    });
  };

  const registerPaymentFromInvoice = async (inv: Invoice) => {
    if (!canCreateFinancial) {
      toast.error("Seu perfil não tem permissão para registrar pagamentos.");
      return;
    }
    const saved = await addPayment({
      amount: Number(inv.amount),
      status: "completed",
      direction: "entrada",
      description: `Pagamento da ${inv.number || `fatura ${inv.id.slice(0, 8)}`}`,
      category: "Faturas",
      company_id: inv.company_id,
      due_date: inv.due_date,
      invoice_id: inv.id,
      method: null,
      paid_at: new Date().toISOString(),
    });
    if (!saved) return;
    setSelected({ ...inv, status: "paid" });
    toast.success("Pagamento registrado e fatura marcada como paga");
  };

  const cancelInvoice = async () => {
    if (!invoiceToCancel) return false;
    if (!canUpdateFinancial) {
      toast.error("Seu perfil não tem permissão para cancelar faturas.");
      return false;
    }
    if (invoiceToCancel.status === "paid") {
      toast.error("Faturas pagas não podem ser canceladas sem estornar o pagamento.");
      return false;
    }
    const updated = await updateInvoice(invoiceToCancel.id, { status: "cancelled" });
    if (!updated) return false;
    setSelected((current) => current?.id === invoiceToCancel.id ? { ...current, status: "cancelled" } : current);
    toast.success("Fatura cancelada");
    return true;
  };

  const clientName = (id: string | null) =>
    clients.find((c) => c.id === id)?.name ?? "—";

  const filtered = invoices
    .filter((i) => statusFilters.length === 0 || statusFilters.includes(i.status))
    .filter((i) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        (i.number ?? "").toLowerCase().includes(q) ||
        clientName(i.company_id).toLowerCase().includes(q)
      );
    });

  const activeInvoices = invoices.filter((invoice) => !["cancelled", "canceled"].includes(invoice.status ?? ""));
  const total = activeInvoices.reduce((a, i) => a + Number(i.amount || 0), 0);
  const totalPaid = invoices
    .filter((i) => i.status === "paid")
    .reduce((a, i) => a + Number(i.amount || 0), 0);
  const totalPending = invoices
    .filter((i) => i.status === "pending")
    .reduce((a, i) => a + Number(i.amount || 0), 0);
  const totalOverdue = invoices
    .filter((i) => i.status === "overdue")
    .reduce((a, i) => a + Number(i.amount || 0), 0);

  const invoiceTrend = (targetStatus?: Invoice["status"]) =>
    Array.from({ length: 6 }, (_, index) => {
      const reference = new Date();
      reference.setDate(1);
      reference.setMonth(reference.getMonth() - (5 - index));
      return activeInvoices
        .filter((invoice) => {
          if (targetStatus && invoice.status !== targetStatus) return false;
          const issuedAt = invoice.issued_at ? new Date(invoice.issued_at) : null;
          return issuedAt?.getFullYear() === reference.getFullYear() && issuedAt.getMonth() === reference.getMonth();
        })
        .reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);
    });

  const statusOptions = [
    { value: "pending", label: "Pendentes" },
    { value: "paid", label: "Pagas" },
    { value: "overdue", label: "Atrasadas" },
    { value: "draft", label: "Rascunhos" },
    { value: "cancelled", label: "Canceladas" },
  ];

  return (
    <>
      <PageShell
        title="Faturas"
        description="Emissão e acompanhamento de faturas"
        primaryAction={
          isClientView || !canCreateFinancial ? undefined : (
            <div className="flex flex-wrap gap-2">
              {profile?.account_type === "admin" && (
                <Button variant="outline" className="rounded-xl" onClick={generateServiceFeeInvoices}>
                  Gerar honorários do mês
                </Button>
              )}
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-xl gap-2">
                  <Plus className="h-4 w-4" />
                  Nova fatura
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nova fatura</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3">
                  <div className="grid gap-1.5">
                    <Label>Número</Label>
                    <Input
                      value={form.number}
                      onChange={(e) =>
                        setForm({ ...form, number: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Valor</Label>
                    <Input
                      type="number"
                      value={form.amount}
                      onChange={(e) =>
                        setForm({ ...form, amount: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Cliente</Label>
                    <Select
                      value={form.company_id}
                      onValueChange={(v) => setForm({ ...form, company_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeClients.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Vencimento</Label>
                    <Input
                      type="date"
                      value={form.due_date}
                      onChange={(e) =>
                        setForm({ ...form, due_date: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Status</Label>
                    <Select
                      value={form.status}
                      onValueChange={(v) => setForm({ ...form, status: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Rascunho</SelectItem>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="overdue">Atrasada</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={create}>Criar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            </div>
          )
        }
        kpis={[
          { label: "Total emitido", value: brl(total), trend: invoiceTrend() },
          { label: "Pagas", value: brl(totalPaid), trend: invoiceTrend("paid") },
          { label: "Pendentes", value: brl(totalPending), trend: invoiceTrend("pending") },
          { label: "Atrasadas", value: brl(totalOverdue), trend: invoiceTrend("overdue") },
        ]}
      >
        <section className="page-section space-y-4 p-0 overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-4 px-5 pt-5 sm:px-6 sm:pt-6">
            <div>
              <h2 className="text-base font-medium">Faturas emitidas</h2>
              <p className="mt-1 text-sm text-muted-foreground">Referências, vencimentos, status e valores do período.</p>
            </div>
            <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
              <div className="relative min-w-[220px] flex-1 sm:max-w-[280px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar faturas…"
                  name="invoice-search"
                  autoComplete="off"
                  aria-label="Buscar faturas por número ou cliente"
                  className="h-10 rounded-xl border-border/70 bg-card/80 pl-9"
                />
              </div>
              <FilterPopover activeCount={statusFilters.length} onClear={() => setStatusFilters([])}>
                <MultiSelectFilter
                  label="Status"
                  options={statusOptions}
                  value={statusFilters}
                  onChange={setStatusFilters}
                />
              </FilterPopover>
              <Badge variant="secondary">{filtered.length} registros</Badge>
            </div>
          </div>
          {loading ? (
            <div className="px-5 pb-5 sm:px-6 sm:pb-6"><LoadingState /></div>
          ) : (
            <BentoDataTable
              rows={filtered}
              getRowKey={(invoice) => invoice.id}
              empty={<EmptyState icon={<Receipt className="h-8 w-8" />} title="Nenhuma fatura encontrada" description="Ajuste os filtros ou crie uma nova fatura." />}
              className="rounded-none border-x-0 border-b-0"
              columns={[
                {
                  key: "reference",
                  label: "Referência",
                  render: (invoice) => <span className="block max-w-[210px] truncate font-medium">{invoice.number || `Fatura ${invoice.id.slice(0, 8)}`}</span>,
                },
                {
                  key: "client",
                  label: "Cliente",
                  render: (invoice) => <span className="block max-w-[190px] truncate text-sm text-muted-foreground">{clientName(invoice.company_id)}</span>,
                },
                {
                  key: "due",
                  label: "Vencimento",
                  sortValue: (invoice) => invoice.due_date ? new Date(invoice.due_date) : null,
                  render: (invoice) => <span className="whitespace-nowrap text-sm text-muted-foreground">{fmt(invoice.due_date)}</span>,
                },
                {
                  key: "status",
                  label: "Status",
                  render: (invoice) => { const meta = statusMeta[invoice.status] ?? { label: invoice.status, className: "" }; return <Badge className={meta.className}>{meta.label}</Badge>; },
                },
                {
                  key: "value",
                  label: "Valor",
                  sortValue: (invoice) => Number(invoice.amount ?? 0),
                  className: "text-right font-medium tabular-nums",
                  headerClassName: "text-right",
                  render: (invoice) => <span className="whitespace-nowrap">{brl(Number(invoice.amount))}</span>,
                },
              ]}
              actions={(invoice) => (
                <RowActions
                  primaryLabel="Abrir fatura"
                  primaryIcon={Eye}
                  onPrimary={() => setSelected(invoice)}
                  menuItems={[
                    { label: "Abrir fatura", icon: ExternalLink, onSelect: () => setSelected(invoice) },
                    ...(!isClientView && canCreateFinancial && !["paid", "cancelled", "canceled"].includes(invoice.status ?? "") ? [{ label: "Registrar pagamento", icon: CheckCircle2, onSelect: () => void registerPaymentFromInvoice(invoice) }] : []),
                    ...(!isClientView && canUpdateFinancial && !["paid", "cancelled", "canceled"].includes(invoice.status) ? [{ label: "Cancelar fatura", icon: XCircle, separatorBefore: true, onSelect: () => setInvoiceToCancel(invoice) }] : []),
                    ...(!isClientView && canDeleteFinancial && !["paid", "cancelled", "canceled"].includes(invoice.status) ? [{ label: "Remover fatura", icon: Trash2, destructive: true, separatorBefore: true, onSelect: () => removeInvoice(invoice) }] : []),
                  ]}
                />
              )}
            />
          )}
        </section>
      </PageShell>

      <DetailSheet
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
        title={
          selected?.number ||
          (selected ? `Fatura ${selected.id.slice(0, 8)}` : "")
        }
        description={selected ? clientName(selected.company_id) : undefined}
        actions={
          selected && (
            <>
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => setSelected(null)}
              >
                Fechar
              </Button>
              {!isClientView && canCreateFinancial && !["paid", "cancelled", "canceled"].includes(selected.status ?? "") && (
                <Button
                  className="rounded-xl"
                  onClick={() => registerPaymentFromInvoice(selected)}
                >
                  Registrar pagamento
                </Button>
              )}
              {!isClientView && canUpdateFinancial && !["paid", "cancelled", "canceled"].includes(selected.status) && (
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => setInvoiceToCancel(selected)}
                >
                  Cancelar fatura
                </Button>
              )}
              {!isClientView && canDeleteFinancial && !["paid", "cancelled", "canceled"].includes(selected.status) && (
                <Button
                  variant="destructive"
                  className="rounded-xl"
                  onClick={() => removeInvoice(selected)}
                >
                  Remover
                </Button>
              )}
            </>
          )
        }
      >
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Valor</p>
                <p className="font-semibold">{brl(Number(selected.amount))}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <Badge
                  className={
                    (statusMeta[selected.status] ?? { className: "" }).className
                  }
                >
                  {statusMeta[selected.status]?.label ?? selected.status}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Emissão</p>
                <p>{fmt(selected.issued_at)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Vencimento</p>
                <p>{fmt(selected.due_date)}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-2">Histórico</p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Fatura emitida em {fmt(selected.issued_at)}
                </div>
                {selected.status === "paid" && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Pagamento confirmado
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </DetailSheet>
      <ConfirmDestructiveDialog
        open={Boolean(invoiceToCancel)}
        onOpenChange={(open) => !open && setInvoiceToCancel(null)}
        title="Cancelar esta fatura?"
        description="A fatura permanecerá no histórico com o status cancelada e não poderá ser paga ou removida por este fluxo."
        confirmLabel="Cancelar fatura"
        onConfirm={cancelInvoice}
      />
    </>
  );
};

export default Invoices;
