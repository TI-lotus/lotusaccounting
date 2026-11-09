import { useState } from "react";
import { PageShell } from "@/components/PageShell";
import { EmptyState, LoadingState } from "@/components/PageStates";
import { DetailSheet } from "@/components/DetailSheet";
import { Card, CardContent } from "@/components/ui/card";
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
import { Plus, Receipt, FileText } from "lucide-react";
import { useData } from "@/contexts/DataContext";
import { useViewMode } from "@/contexts/ViewModeContext";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { toastWithUndo } from "@/lib/toastUndo";

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
  const { profile } = useAuth();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [form, setForm] = useState({
    number: "",
    amount: "",
    company_id: "",
    due_date: "",
    status: "pending",
  });
  const activeClients = clients.filter((client) => client.status === "active");

  const create = async () => {
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
    const created = await generateMonthlyServiceFeeInvoices();
    if (created > 0) {
      toast.success(`${created} fatura(s) mensal(is) de honorários gerada(s)`);
    } else {
      toast.info("Nenhuma fatura nova foi gerada para este mês");
    }
  };

  const removeInvoice = (inv: Invoice) => {
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

  const clientName = (id: string | null) =>
    clients.find((c) => c.id === id)?.name ?? "—";

  const filtered = invoices
    .filter((i) => statusFilter === "all" || i.status === statusFilter)
    .filter((i) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        (i.number ?? "").toLowerCase().includes(q) ||
        clientName(i.company_id).toLowerCase().includes(q)
      );
    });

  const total = invoices.reduce((a, i) => a + Number(i.amount || 0), 0);
  const totalPaid = invoices
    .filter((i) => i.status === "paid")
    .reduce((a, i) => a + Number(i.amount || 0), 0);
  const totalPending = invoices
    .filter((i) => i.status === "pending")
    .reduce((a, i) => a + Number(i.amount || 0), 0);
  const totalOverdue = invoices
    .filter((i) => i.status === "overdue")
    .reduce((a, i) => a + Number(i.amount || 0), 0);

  const statusTabs = [
    { value: "all", label: "Todas" },
    { value: "pending", label: "Pendentes" },
    { value: "paid", label: "Pagas" },
    { value: "overdue", label: "Atrasadas" },
    { value: "draft", label: "Rascunhos" },
  ];

  return (
    <>
      <PageShell
        title="Faturas"
        description="Emissão e acompanhamento de faturas"
        primaryAction={
          isClientView ? undefined : (
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
          { label: "Total emitido", value: brl(total) },
          { label: "Pagas", value: brl(totalPaid) },
          { label: "Pendentes", value: brl(totalPending) },
          { label: "Atrasadas", value: brl(totalOverdue) },
        ]}
        tabs={statusTabs}
        activeTab={statusFilter}
        onTabChange={setStatusFilter}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por número ou cliente..."
      >
        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <LoadingState />
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={<Receipt className="h-8 w-8" />}
                title="Nenhuma fatura encontrada"
                description="Ajuste os filtros ou crie uma nova fatura."
              />
            ) : (
              <div className="space-y-2">
                {filtered.map((inv) => {
                  const meta = statusMeta[inv.status] ?? {
                    label: inv.status,
                    className: "",
                  };
                  return (
                    <button
                      key={inv.id}
                      onClick={() => setSelected(inv)}
                      className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-accent/50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-primary/10">
                          <FileText className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {inv.number || `Fatura ${inv.id.slice(0, 8)}`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {clientName(inv.company_id)} • Venc.{" "}
                            {fmt(inv.due_date)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className={meta.className}>{meta.label}</Badge>
                        <span className="text-sm font-semibold">
                          {brl(Number(inv.amount))}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
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
              {!isClientView && selected.status !== "paid" && (
                <Button
                  className="rounded-xl"
                  onClick={() => registerPaymentFromInvoice(selected)}
                >
                  Registrar pagamento
                </Button>
              )}
              {!isClientView && selected.status !== "paid" && (
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
    </>
  );
};

export default Invoices;
