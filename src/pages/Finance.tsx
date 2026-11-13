import { useMemo } from "react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Wallet,
  AlertTriangle,
  Receipt,
  TrendingUp,
} from "lucide-react";
import { useData } from "@/contexts/DataContext";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { BentoStatStrip } from "@/components/dashboard/BentoStatStrip";
import { contractedMonthlyFees } from "@/lib/financialMetrics";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const isIncome = (direction: string | null) =>
  direction === "entrada" || direction === "income";

const Finance = () => {
  const { payments, invoices, clients } = useData();

  const kpi = useMemo(() => {
    const income = payments
      .filter((p) => isIncome(p.direction) && p.status === "completed")
      .reduce((s, p) => s + Number(p.amount), 0);
    const expense = payments
      .filter((p) => !isIncome(p.direction) && p.status === "completed")
      .reduce((s, p) => s + Number(p.amount), 0);
    const pending = payments
      .filter((p) => p.status === "pending")
      .reduce((s, p) => s + Number(p.amount), 0);
    const overdue = invoices
      .filter((i) => i.status === "overdue")
      .reduce((s, i) => s + Number(i.amount), 0);
    return { income, expense, profit: income - expense, pending, overdue, contractedFees: contractedMonthlyFees(clients) };
  }, [payments, invoices, clients]);

  const cards = [
    {
      label: "Honorários mensais contratados",
      value: brl(kpi.contractedFees),
      icon: Receipt,
    },
    {
      label: "Receitas",
      value: brl(kpi.income),
      icon: ArrowUpCircle,
    },
    {
      label: "Despesas",
      value: brl(kpi.expense),
      icon: ArrowDownCircle,
    },
    {
      label: "Lucro",
      value: brl(kpi.profit),
      icon: TrendingUp,
    },
    {
      label: "A receber",
      value: brl(kpi.pending),
      icon: Wallet,
    },
    {
      label: "Em atraso",
      value: brl(kpi.overdue),
      icon: AlertTriangle,
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Financeiro</h1>
          <p className="text-muted-foreground">
            Visão consolidada de receitas, despesas e recebíveis
          </p>
        </div>

        <BentoStatStrip
          className="animate-fade-in xl:grid-cols-3"
          items={cards.map((card) => ({
            label: card.label,
            value: card.value,
            icon: card.icon,
          }))}
        />

        <RevenueChart />

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Últimos lançamentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {payments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum lançamento registrado
              </p>
            ) : (
              <div className="space-y-2">
                {payments.slice(0, 10).map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-3 rounded-xl hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {isIncome(p.direction) ? (
                        <ArrowUpCircle className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <ArrowDownCircle className="h-4 w-4 text-red-600" />
                      )}
                      <div>
                        <p className="text-sm font-medium">
                          {p.description || "Sem descrição"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {p.category || "Sem categoria"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={
                          p.status === "completed" ? "default" : "secondary"
                        }
                        className={
                          p.status === "completed"
                            ? "bg-emerald-500 hover:bg-emerald-500"
                            : ""
                        }
                      >
                        {p.status === "completed" ? "Concluído" : "Pendente"}
                      </Badge>
                      <span
                        className={`text-sm font-semibold ${isIncome(p.direction) ? "text-emerald-600" : "text-red-600"}`}
                      >
                        {isIncome(p.direction) ? "+" : "-"}{" "}
                        {brl(Number(p.amount))}
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
