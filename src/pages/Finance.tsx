import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowDownCircle, ArrowUpCircle, Wallet, AlertTriangle, Receipt, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useData } from "@/contexts/DataContext";
import { RevenueChart } from "@/components/dashboard/RevenueChart";

interface PaymentRow {
  id: string; amount: number; status: string; direction: string;
  description: string | null; category: string | null;
  paid_at: string | null; due_date: string | null; created_at: string;
}
interface InvoiceRow {
  id: string; number: string | null; amount: number; status: string;
  issued_at: string | null; due_date: string | null;
}

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const Finance = () => {
  const { tenantId } = useData();
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);

  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      const [p, i] = await Promise.all([
        supabase.from("payments").select("id, amount, status, direction, description, category, paid_at, due_date, created_at"),
        supabase.from("invoices").select("id, number, amount, status, issued_at, due_date"),
      ]);
      setPayments((p.data ?? []) as any);
      setInvoices((i.data ?? []) as any);
    })();
  }, [tenantId]);

  const kpi = useMemo(() => {
    const income = payments.filter(p => p.direction === "income" && p.status === "completed").reduce((s, p) => s + Number(p.amount), 0);
    const expense = payments.filter(p => p.direction === "expense" && p.status === "completed").reduce((s, p) => s + Number(p.amount), 0);
    const pending = payments.filter(p => p.status === "pending").reduce((s, p) => s + Number(p.amount), 0);
    const overdue = invoices.filter(i => i.status === "overdue").reduce((s, i) => s + Number(i.amount), 0);
    return { income, expense, profit: income - expense, pending, overdue };
  }, [payments, invoices]);

  const cards = [
    { label: "Receitas", value: brl(kpi.income), icon: ArrowUpCircle, color: "text-emerald-600" },
    { label: "Despesas", value: brl(kpi.expense), icon: ArrowDownCircle, color: "text-red-600" },
    { label: "Lucro", value: brl(kpi.profit), icon: TrendingUp, color: kpi.profit >= 0 ? "text-emerald-600" : "text-red-600" },
    { label: "A receber", value: brl(kpi.pending), icon: Wallet, color: "text-amber-600" },
    { label: "Em atraso", value: brl(kpi.overdue), icon: AlertTriangle, color: "text-red-600" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Financeiro</h1>
          <p className="text-muted-foreground">Visão consolidada de receitas, despesas e recebíveis</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {cards.map(c => {
            const Icon = c.icon;
            return (
              <Card key={c.label}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">{c.label}</span>
                    <Icon className={`h-4 w-4 ${c.color}`} />
                  </div>
                  <p className={`text-xl font-semibold ${c.color}`}>{c.value}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <RevenueChart />

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Receipt className="h-4 w-4" />Últimos lançamentos</CardTitle></CardHeader>
          <CardContent>
            {payments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum lançamento registrado</p>
            ) : (
              <div className="space-y-2">
                {payments.slice(0, 10).map(p => (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-accent/50 transition-colors">
                    <div className="flex items-center gap-3">
                      {p.direction === "income"
                        ? <ArrowUpCircle className="h-4 w-4 text-emerald-600" />
                        : <ArrowDownCircle className="h-4 w-4 text-red-600" />}
                      <div>
                        <p className="text-sm font-medium">{p.description || "Sem descrição"}</p>
                        <p className="text-xs text-muted-foreground">{p.category || "Sem categoria"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={p.status === "completed" ? "default" : "secondary"} className={p.status === "completed" ? "bg-emerald-500 hover:bg-emerald-500" : ""}>
                        {p.status === "completed" ? "Concluído" : "Pendente"}
                      </Badge>
                      <span className={`text-sm font-semibold ${p.direction === "income" ? "text-emerald-600" : "text-red-600"}`}>
                        {p.direction === "income" ? "+" : "-"} {brl(Number(p.amount))}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Finance;
