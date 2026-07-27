import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Scale, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useData } from "@/contexts/DataContext";
import { toast } from "sonner";

interface Payment {
  id: string; amount: number; status: string; direction: string;
  description: string | null; paid_at: string | null; due_date: string | null;
  reconciled?: boolean;
}

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString("pt-BR") : "—");

const Reconciliation = () => {
  const { tenantId } = useData();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [reconciled, setReconciled] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      const { data } = await supabase
        .from("payments")
        .select("id, amount, status, direction, description, paid_at, due_date")
        .order("created_at", { ascending: false });
      setPayments((data ?? []) as any);
    })();
  }, [tenantId]);

  const totals = useMemo(() => {
    const pendentes = payments.filter(p => !reconciled[p.id]);
    const conciliados = payments.filter(p => reconciled[p.id]);
    return {
      pendCount: pendentes.length,
      pendAmount: pendentes.reduce((s, p) => s + Number(p.amount), 0),
      okCount: conciliados.length,
      okAmount: conciliados.reduce((s, p) => s + Number(p.amount), 0),
    };
  }, [payments, reconciled]);

  const toggle = (id: string) => {
    setReconciled(prev => ({ ...prev, [id]: !prev[id] }));
    toast.success(reconciled[id] ? "Marcado como pendente" : "Conciliado");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Conciliação</h1>
          <p className="text-muted-foreground">Reconcilie lançamentos com extratos bancários</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">A conciliar</span>
                <AlertCircle className="h-4 w-4 text-amber-500" />
              </div>
              <p className="text-2xl font-semibold">{totals.pendCount}</p>
              <p className="text-xs text-muted-foreground">{brl(totals.pendAmount)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Conciliados</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              </div>
              <p className="text-2xl font-semibold">{totals.okCount}</p>
              <p className="text-xs text-muted-foreground">{brl(totals.okAmount)}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Scale className="h-4 w-4" />Lançamentos</CardTitle></CardHeader>
          <CardContent>
            {payments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum lançamento a conciliar</p>
            ) : (
              <div className="space-y-2">
                {payments.map(p => {
                  const ok = reconciled[p.id];
                  return (
                    <div key={p.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-accent/50 transition-colors">
                      <div>
                        <p className="text-sm font-medium">{p.description || "Sem descrição"}</p>
                        <p className="text-xs text-muted-foreground">{fmt(p.paid_at ?? p.due_date)} • {p.direction === "income" ? "Entrada" : "Saída"}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold">{brl(Number(p.amount))}</span>
                        {ok && <Badge className="bg-emerald-500 hover:bg-emerald-500 text-white">Conciliado</Badge>}
                        <Button size="sm" variant={ok ? "outline" : "default"} className="rounded-xl" onClick={() => toggle(p.id)}>
                          {ok ? "Desfazer" : "Conciliar"}
                        </Button>
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

export default Reconciliation;
