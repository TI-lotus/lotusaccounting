import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import {
  ArrowDown,
  ArrowUp,
  Wallet,
  AlertTriangle,
  Receipt,
  DollarSign,
  ExternalLink,
} from "lucide-react";
import { useData } from "@/contexts/DataContext";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { BentoStatStrip } from "@/components/dashboard/BentoStatStrip";
import { BentoDataTable } from "@/components/BentoDataTable";
import { RowActions } from "@/components/RowActions";
import { contractedMonthlyFees } from "@/lib/financialMetrics";
import { cn } from "@/lib/utils";
import { NoPermissionState } from "@/components/PageStates";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspacePermission } from "@/hooks/useWorkspacePermission";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const isIncome = (direction: string | null) =>
  direction === "entrada" || direction === "income";

const Finance = () => {
  const { payments, invoices, clients, tenantId } = useData();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const canReadFinancial = useWorkspacePermission({
    tenantId,
    userId: user?.id,
    accountType: profile?.account_type,
    resource: "financial",
    action: "read",
  });

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

  const trends = useMemo(() => {
    const monthly = (predicate: (payment: (typeof payments)[number]) => boolean) =>
      Array.from({ length: 6 }, (_, index) => {
        const reference = new Date();
        reference.setDate(1);
        reference.setMonth(reference.getMonth() - (5 - index));
        return payments
          .filter((payment) => {
            if (!predicate(payment)) return false;
            const date = payment.paid_at ?? payment.created_at;
            if (!date) return false;
            const parsed = new Date(date);
            return parsed.getFullYear() === reference.getFullYear() && parsed.getMonth() === reference.getMonth();
          })
          .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
      });
    const income = monthly((payment) => isIncome(payment.direction) && payment.status === "completed");
    const expense = monthly((payment) => !isIncome(payment.direction) && payment.status === "completed");
    return {
      contracted: [kpi.contractedFees],
      income,
      expense,
      profit: income.map((value, index) => value - expense[index]),
      pending: monthly((payment) => payment.status === "pending"),
      overdue: Array.from({ length: 6 }, (_, index) => {
        const reference = new Date();
        reference.setDate(1);
        reference.setMonth(reference.getMonth() - (5 - index));
        return invoices
          .filter((invoice) => invoice.status === "overdue")
          .filter((invoice) => {
            const date = invoice.due_date ?? invoice.issued_at;
            if (!date) return false;
            const parsed = new Date(date);
            return parsed.getFullYear() === reference.getFullYear() && parsed.getMonth() === reference.getMonth();
          })
          .reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);
      }),
    };
  }, [invoices, kpi.contractedFees, payments]);

  const cards = [
    {
      label: "Honorários mensais contratados",
      value: brl(kpi.contractedFees),
      icon: Receipt,
      trend: trends.contracted,
    },
    {
      label: "Receitas",
      value: brl(kpi.income),
      icon: ArrowUp,
      trend: trends.income,
    },
    {
      label: "Despesas",
      value: brl(kpi.expense),
      icon: ArrowDown,
      trend: trends.expense,
    },
    {
      label: "Lucro",
      value: brl(kpi.profit),
      icon: DollarSign,
      trend: trends.profit,
    },
    {
      label: "A receber",
      value: brl(kpi.pending),
      icon: Wallet,
      trend: trends.pending,
    },
    {
      label: "Em atraso",
      value: brl(kpi.overdue),
      icon: AlertTriangle,
      trend: trends.overdue,
    },
  ];

  if (!canReadFinancial) {
    return (
      <DashboardLayout>
        <NoPermissionState
          title="Financeiro indisponível"
          description="Você não tem permissão para visualizar os dados financeiros deste workspace."
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-[28px] font-normal tracking-[-0.035em]">Financeiro</h1>
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
            trend: card.trend,
          }))}
        />

        <RevenueChart />

        <section className="page-section animate-fade-in space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-medium">Últimos lançamentos</h2>
              <p className="mt-1 text-sm text-muted-foreground">Movimentações recentes do financeiro.</p>
            </div>
            <Badge variant="secondary">{payments.length} registros</Badge>
          </div>
          <BentoDataTable
            rows={payments.slice(0, 10)}
            getRowKey={(payment) => payment.id}
            empty="Nenhum lançamento registrado."
            columns={[
              {
                key: "reference",
                label: "Referência",
                render: (payment) => <span className="block max-w-[230px] truncate font-medium">{payment.description || "Sem descrição"}</span>,
              },
              {
                key: "category",
                label: "Categoria",
                render: (payment) => <span className="text-sm text-muted-foreground">{payment.category || "Sem categoria"}</span>,
              },
              {
                key: "date",
                label: "Data",
                sortValue: (payment) => new Date(payment.paid_at ?? payment.due_date ?? payment.created_at),
                render: (payment) => <span className="whitespace-nowrap text-sm text-muted-foreground">{new Date(payment.paid_at ?? payment.due_date ?? payment.created_at).toLocaleDateString("pt-BR")}</span>,
              },
              {
                key: "type",
                label: "Tipo",
                render: (payment) => {
                  const income = isIncome(payment.direction);
                  const Icon = income ? ArrowUp : ArrowDown;
                  return <span className={cn("inline-flex items-center gap-2 text-sm", income ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}><Icon className="h-4 w-4" aria-hidden="true" />{income ? "Receita" : "Despesa"}</span>;
                },
              },
              {
                key: "value",
                label: "Valor",
                sortValue: (payment) => Number(payment.amount),
                className: "text-right font-medium tabular-nums",
                headerClassName: "text-right",
                render: (payment) => <span className={cn("whitespace-nowrap", isIncome(payment.direction) ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>{isIncome(payment.direction) ? "+" : "-"} {brl(Number(payment.amount))}</span>,
              },
              {
                key: "status",
                label: "Status",
                render: (payment) => <Badge variant={payment.status === "completed" ? "default" : "secondary"}>{payment.status === "completed" ? "Concluído" : "Pendente"}</Badge>,
              },
            ]}
            actions={() => (
              <RowActions
                primaryLabel="Abrir pagamentos"
                primaryIcon={ExternalLink}
                onPrimary={() => navigate("/payments")}
                menuItems={[{ label: "Abrir pagamentos", icon: ExternalLink, onSelect: () => navigate("/payments") }]}
              />
            )}
          />
        </section>
      </div>
    </DashboardLayout>
  );
};

export default Finance;
