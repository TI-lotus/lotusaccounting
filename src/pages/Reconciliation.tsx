import { useMemo } from "react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Scale, CheckCircle2, AlertCircle } from "lucide-react";
import { useData } from "@/contexts/DataContext";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmt = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("pt-BR") : "—";
const isIncome = (direction: string | null) =>
  direction === "entrada" || direction === "income";

const Reconciliation = () => {
  const { payments, updatePayment } = useData();
  const { user } = useAuth();

  const totals = useMemo(() => {
    const pendentes = payments.filter((p) => !p.reconciled_at);
    const conciliados = payments.filter((p) => p.reconciled_at);
    return {
      pendCount: pendentes.length,
      pendAmount: pendentes.reduce((s, p) => s + Number(p.amount), 0),
      okCount: conciliados.length,
      okAmount: conciliados.reduce((s, p) => s + Number(p.amount), 0),
    };
  }, [payments]);

  const toggle = async (id: string) => {
    const payment = payments.find((p) => p.id === id);
    if (!payment) return;
    const isReconciled = !!payment.reconciled_at;

    await updatePayment(id, {
      reconciled_at: isReconciled ? null : new Date().toISOString(),
      reconciled_by: isReconciled ? null : (user?.id ?? null),
    });
    toast.success(isReconciled ? "Marcado como pendente" : "Conciliado");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Conciliação</h1>
          <p className="text-muted-foreground">
            Reconcilie lançamentos com extratos bancários
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">
                  A conciliar
                </span>
                <AlertCircle className="h-4 w-4 text-amber-500" />
              </div>
              <p className="text-2xl font-semibold">{totals.pendCount}</p>
              <p className="text-xs text-muted-foreground">
                {brl(totals.pendAmount)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">
                  Conciliados
                </span>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              </div>
              <p className="text-2xl font-semibold">{totals.okCount}</p>
              <p className="text-xs text-muted-foreground">
                {brl(totals.okAmount)}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Scale className="h-4 w-4" />
              Lançamentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {payments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum lançamento a conciliar
              </p>
            ) : (
              <div className="space-y-2">
                {payments.map((p) => {
                  const ok = !!p.reconciled_at;
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-3 rounded-xl hover:bg-accent/50 transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {p.description || "Sem descrição"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {fmt(p.paid_at ?? p.due_date)} •{" "}
                          {isIncome(p.direction) ? "Entrada" : "Saída"}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold">
                          {brl(Number(p.amount))}
                        </span>
                        {ok && (
                          <Badge className="bg-emerald-500 hover:bg-emerald-500 text-white">
                            Conciliado
                          </Badge>
                        )}
                        <Button
                          size="sm"
                          variant={ok ? "outline" : "default"}
                          className="rounded-xl"
                          onClick={() => toggle(p.id)}
                        >
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
