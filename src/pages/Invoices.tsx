import { useEffect, useState } from "react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Receipt, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useData } from "@/contexts/DataContext";
import { toast } from "sonner";

interface Invoice {
  id: string; number: string | null; amount: number; status: string;
  issued_at: string | null; due_date: string | null; company_id: string | null;
}

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString("pt-BR") : "—");

const statusMeta: Record<string, { label: string; className: string }> = {
  paid: { label: "Paga", className: "bg-emerald-500 hover:bg-emerald-500 text-white" },
  pending: { label: "Pendente", className: "bg-amber-500 hover:bg-amber-500 text-white" },
  overdue: { label: "Atrasada", className: "bg-red-500 hover:bg-red-500 text-white" },
  draft: { label: "Rascunho", className: "" },
};

const Invoices = () => {
  const { tenantId, clients } = useData();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ number: "", amount: "", company_id: "", due_date: "", status: "pending" });

  const load = async () => {
    const { data } = await supabase
      .from("invoices")
      .select("id, number, amount, status, issued_at, due_date, company_id")
      .order("created_at", { ascending: false });
    setInvoices((data ?? []) as any);
  };

  useEffect(() => { if (tenantId) load(); }, [tenantId]);

  const create = async () => {
    if (!tenantId || !form.amount) { toast.error("Preencha o valor"); return; }
    const { error } = await supabase.from("invoices").insert({
      tenant_id: tenantId,
      number: form.number || null,
      amount: Number(form.amount),
      status: form.status,
      due_date: form.due_date || null,
      company_id: form.company_id || null,
      issued_at: new Date().toISOString(),
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Fatura criada");
    setOpen(false);
    setForm({ number: "", amount: "", company_id: "", due_date: "", status: "pending" });
    load();
  };

  const filtered = invoices.filter(i => statusFilter === "all" || i.status === statusFilter);
  const clientName = (id: string | null) => clients.find(c => c.id === id)?.name ?? "—";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Faturas</h1>
            <p className="text-muted-foreground">Emissão e acompanhamento de faturas</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-xl gap-2"><Plus className="h-4 w-4" />Nova fatura</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova fatura</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <div className="grid gap-1.5"><Label>Número</Label><Input value={form.number} onChange={e => setForm({ ...form, number: e.target.value })} /></div>
                <div className="grid gap-1.5"><Label>Valor</Label><Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
                <div className="grid gap-1.5"><Label>Cliente</Label>
                  <Select value={form.company_id} onValueChange={v => setForm({ ...form, company_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5"><Label>Vencimento</Label><Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} /></div>
                <div className="grid gap-1.5"><Label>Status</Label>
                  <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Rascunho</SelectItem>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="paid">Paga</SelectItem>
                      <SelectItem value="overdue">Atrasada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter><Button onClick={create}>Criar</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex gap-2">
          {["all", "pending", "paid", "overdue", "draft"].map(s => (
            <Button key={s} variant={statusFilter === s ? "default" : "outline"} size="sm" className="rounded-xl" onClick={() => setStatusFilter(s)}>
              {s === "all" ? "Todas" : statusMeta[s]?.label ?? s}
            </Button>
          ))}
        </div>

        <Card>
          <CardContent className="pt-6">
            {filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Receipt className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhuma fatura encontrada</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map(inv => {
                  const meta = statusMeta[inv.status] ?? { label: inv.status, className: "" };
                  return (
                    <div key={inv.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-accent/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-primary/10"><FileText className="h-4 w-4 text-primary" /></div>
                        <div>
                          <p className="text-sm font-medium">{inv.number || `Fatura ${inv.id.slice(0, 8)}`}</p>
                          <p className="text-xs text-muted-foreground">{clientName(inv.company_id)} • Venc. {fmt(inv.due_date)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className={meta.className}>{meta.label}</Badge>
                        <span className="text-sm font-semibold">{brl(Number(inv.amount))}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Invoices;
