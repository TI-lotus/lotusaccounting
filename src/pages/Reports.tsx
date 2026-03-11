import { DashboardLayout } from "@/layouts/DashboardLayout";
import { BarChart3, Download, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { QuickStats } from "@/components/dashboard/QuickStats";

const reports = [
  { id: 1, name: "DRE Mensal", period: "Janeiro 2026", type: "Financeiro", generated: "12 Jan, 2026" },
  { id: 2, name: "Análise de Fluxo de Caixa", period: "4º Trimestre 2025", type: "Fluxo de Caixa", generated: "05 Jan, 2026" },
  { id: 3, name: "Contas a Receber - Aging", period: "Atual", type: "Contas a Receber", generated: "12 Jan, 2026" },
  { id: 4, name: "Resumo Fiscal Anual", period: "Exercício 2025", type: "Fiscal", generated: "02 Jan, 2026" },
];

const Reports = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between animate-fade-in">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Relatórios</h1>
            <p className="text-muted-foreground">Relatórios financeiros e análises</p>
          </div>
          <Button className="rounded-xl gap-2">
            <BarChart3 className="h-4 w-4" />
            Gerar Relatório
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <RevenueChart className="lg:col-span-2" />
          <QuickStats />
        </div>

        <div className="glass rounded-2xl p-6 animate-fade-in">
          <h3 className="text-lg font-semibold mb-4">Relatórios Disponíveis</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {reports.map((report, index) => (
              <div
                key={report.id}
                className="flex items-center gap-4 p-4 rounded-xl border border-border hover:bg-accent/50 transition-colors"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="p-3 rounded-xl bg-primary/10">
                  <BarChart3 className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{report.name}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>{report.period}</span>
                    <span>•</span>
                    <span>{report.type}</span>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="rounded-lg shrink-0">
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Reports;
