import { DashboardLayout } from "@/layouts/DashboardLayout";
import { KPICard } from "@/components/dashboard/KPICard";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import { QuickStats } from "@/components/dashboard/QuickStats";
import { AlertsPanel } from "@/components/dashboard/AlertsPanel";
import { useViewMode } from "@/contexts/ViewModeContext";
import {
  DollarSign,
  TrendingUp,
  Users,
  FileText,
  CheckSquare,
  Clock,
  AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const ClientDashboard = () => {
  const recentDocs = [
    { name: "Balancete Mensal - Jan/2026", date: "12 Jan, 2026", type: "Relatório" },
    { name: "Fatura #1234", date: "10 Jan, 2026", type: "Fatura" },
    { name: "DAS - Janeiro", date: "08 Jan, 2026", type: "Guia" },
    { name: "Nota Fiscal #892", date: "05 Jan, 2026", type: "NF" },
  ];

  const alerts = [
    { text: "Declaração IRPJ vence em 15 dias", type: "warning" as const },
    { text: "Fatura #1220 pendente de aprovação", type: "warning" as const },
    { text: "Documentos de janeiro processados", type: "success" as const },
  ];

  return (
    <div className="space-y-6">
      <div className="animate-fade-in">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Bem-vindo de volta, Claison. Aqui está o resumo da sua empresa.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Tarefas Abertas"
          value="4"
          change={-2}
          changeLabel="2 com prazo esta semana"
          icon={CheckSquare}
        />
        <KPICard
          title="Tarefas Concluídas"
          value="18"
          change={25}
          changeLabel="vs mês anterior"
          icon={Clock}
        />
        <KPICard
          title="Documentos Recentes"
          value="12"
          change={8}
          changeLabel="vs mês anterior"
          icon={FileText}
        />
        <KPICard
          title="Pagamentos Pendentes"
          value="2"
          changeLabel="R$ 3.450,00 total"
          icon={AlertCircle}
        />
      </div>

      {/* Recent Documents */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass rounded-2xl p-6 animate-fade-in">
          <h3 className="text-lg font-semibold mb-4">Documentos Recentes</h3>
          <div className="space-y-3">
            {recentDocs.map((doc, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl hover:bg-accent/50 transition-colors">
                <div className="p-2 rounded-lg bg-accent">
                  <FileText className="h-4 w-4 text-accent-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{doc.name}</p>
                  <p className="text-xs text-muted-foreground">{doc.date}</p>
                </div>
                <Badge variant="outline" className="text-xs">{doc.type}</Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Alerts */}
        <div className="glass rounded-2xl p-6 animate-fade-in">
          <h3 className="text-lg font-semibold mb-4">Avisos Importantes</h3>
          <div className="space-y-3">
            {alerts.map((alert, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl border",
                  alert.type === "warning"
                    ? "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800"
                    : "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800"
                )}
              >
                <AlertCircle className={cn(
                  "h-5 w-5 shrink-0",
                  alert.type === "warning" ? "text-amber-500" : "text-emerald-500"
                )} />
                <p className="text-sm">{alert.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Payment Summary */}
      <div className="glass rounded-2xl p-6 animate-fade-in">
        <h3 className="text-lg font-semibold mb-4">Resumo de Pagamentos</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30">
            <p className="text-sm text-muted-foreground">Pagos este mês</p>
            <p className="text-xl font-semibold text-emerald-600 dark:text-emerald-400">R$ 8.750,00</p>
          </div>
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30">
            <p className="text-sm text-muted-foreground">Pendentes</p>
            <p className="text-xl font-semibold text-amber-600 dark:text-amber-400">R$ 3.450,00</p>
          </div>
          <div className="p-4 rounded-xl bg-muted">
            <p className="text-sm text-muted-foreground">Total do mês</p>
            <p className="text-xl font-semibold">R$ 12.200,00</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const Index = () => {
  const { viewMode } = useViewMode();

  if (viewMode === "client") {
    return (
      <DashboardLayout>
        <ClientDashboard />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="animate-fade-in">
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Bem-vindo de volta, John. Aqui está seu panorama financeiro.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            title="Receita Total"
            value="R$ 284.500,00"
            change={12.5}
            icon={DollarSign}
          />
          <KPICard
            title="Lucro Líquido"
            value="R$ 68.200,00"
            change={8.2}
            icon={TrendingUp}
          />
          <KPICard
            title="Clientes Ativos"
            value="142"
            change={4.1}
            icon={Users}
          />
          <KPICard
            title="Faturas Pendentes"
            value="23"
            change={-15}
            changeLabel="12 vencem esta semana"
            icon={FileText}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <RevenueChart className="lg:col-span-2" />
          <QuickStats />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RecentTransactions />
          <AlertsPanel />
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Index;
