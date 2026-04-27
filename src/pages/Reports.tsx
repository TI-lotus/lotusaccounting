import { useState } from "react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { BarChart3, Download, Calendar, TrendingUp, PieChart, DollarSign, FileText, Users, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { QuickStats } from "@/components/dashboard/QuickStats";
import { CalendarEventView } from "@/components/CalendarEventView";

const reports = [
  { id: 1, name: "DRE Mensal", period: "Março 2026", type: "Financeiro", generated: "01 Abr, 2026" },
  { id: 2, name: "Análise de Fl	uxo de Caixa", period: "1º Trimestre 2026", type: "Fluxo de Caixa", generated: "an 01 Abr, 2026" },
  { id: 3, name: "Contas a Receber - Aging", period: "Atual", type: "Contas a Receber", generated: "01 Abr, 2026" },
  { id: 4, name: "Resumo Fiscal Anual", period: "Exercício 2025", type: "Fiscal", generated: "02 Jan, 2026" },
  { id: 5, name: "Balancete Mensal", period: "Março 2026", type: "Contábil", generated: "01 Abr, 2026" },
  { id: 6, name: "Folha de Pagamento", period: "Março 2026", type: "Trabalhista", generated: "28 Mar, 2026" },
];

const kpiData = [
  { label: "Receita Total", value: "R$ 287.450", change: "+12.5%", icon: DollarSign, positive: true },
  { label: "Clientes Ativos", value: "48", change: "+3", icon: Users, positive: true },
  { label: "Documentos Emitidos", value: "342", change: "+18%", icon: FileText, positive: true },
  { label: "Taxa de Inadimplência", value: "3.2%", change: "-0.8%", icon: TrendingUp, positive: true },
];

const Reports = () => {
  const [view, setView] = useState<"dashboard" | "calendar">("dashboard");
  const [dateRange, setDateRange] = useState({ start: "2026-03-01", end: "2026-03-31" });

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

        <div className="flex flex-wrap items-center justify-between gap-3 animate-fade-in">
          <div className="flex rounded-2xl border border-border bg-card p-1">
            <Button variant={view === "dashboard" ? "default" : "ghost"} size="sm" className="rounded-xl" onClick={() => setView("dashboard")}>
              <LayoutDashboard className="h-4 w-4" /> Dashboard
            </Button>
            <Button variant={view === "calendar" ? "default" : "ghost"} size="sm" className="rounded-xl" onClick={() => setView("calendar")}>
              <Calendar className="h-4 w-4" /> Calendário
            </Button>
          </div>
        </div>

        {view === "calendar" && (
          <CalendarEventView
            title="Calendário de relatórios"
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            events={reports.map((report, index) => ({ day: index + 1, title: report.name, time: "10:00" }))}
          />
        )}

        {view === "dashboard" && <>
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
          {kpiData.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <Card key={kpi.label}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">{kpi.label}</span>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-2xl font-semibold">{kpi.value}</p>
                  <p className={`text-xs ${kpi.positive ? "text-emerald-600" : "text-red-600"}`}>{kpi.change} vs mês anterior</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Tabs defaultValue="overview" className="animate-fade-in">
          <TabsList>
            <TabsTrigger value="overview" className="gap-2"><BarChart3 className="h-4 w-4" />Visão Geral</TabsTrigger>
            <TabsTrigger value="financial" className="gap-2"><DollarSign className="h-4 w-4" />Financeiro</TabsTrigger>
            <TabsTrigger value="tax" className="gap-2"><FileText className="h-4 w-4" />Fiscal</TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2"><PieChart className="h-4 w-4" />Analítico</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <RevenueChart className="lg:col-span-2" />
              <QuickStats />
            </div>
          </TabsContent>

          <TabsContent value="financial" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle>DRE - Demonstração de Resultado</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { label: "Receita Bruta", value: "R$ 287.450,00" },
                      { label: "(-) Deduções", value: "R$ -12.340,00" },
                      { label: "Receita Líquida", value: "R$ 275.110,00" },
                      { label: "(-) Custos", value: "R$ -98.400,00" },
                      { label: "Lucro Bruto", value: "R$ 176.710,00" },
                      { label: "(-) Despesas Operacionais", value: "R$ -45.200,00" },
                      { label: "Lucro Operacional", value: "R$ 131.510,00" },
                    ].map(row => (
                      <div key={row.label} className="flex justify-between py-2 border-b border-border last:border-0">
                        <span className="text-sm">{row.label}</span>
                        <span className="text-sm font-medium">{row.value}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Fluxo de Caixa</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { label: "Saldo Inicial", value: "R$ 145.800,00" },
                      { label: "(+) Entradas", value: "R$ 287.450,00" },
                      { label: "(-) Saídas", value: "R$ -155.940,00" },
                      { label: "Saldo Final", value: "R$ 277.310,00" },
                    ].map(row => (
                      <div key={row.label} className="flex justify-between py-2 border-b border-border last:border-0">
                        <span className="text-sm">{row.label}</span>
                        <span className="text-sm font-medium">{row.value}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="tax" className="space-y-6 mt-6">
            <Card>
              <CardHeader><CardTitle>Obrigações Fiscais</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { name: "DCTF", deadline: "15 Abr, 2026", status: "pendente" },
                    { name: "EFD Contribuições", deadline: "20 Abr, 2026", status: "pendente" },
                    { name: "SPED Fiscal", deadline: "25 Abr, 2026", status: "pendente" },
                    { name: "DAS - Simples Nacional", deadline: "20 Abr, 2026", status: "concluído" },
                    { name: "DIRF", deadline: "28 Fev, 2026", status: "concluído" },
                    { name: "ECD", deadline: "31 Mai, 2026", status: "pendente" },
                  ].map(item => (
                    <div key={item.name} className="flex items-center justify-between p-3 rounded-xl hover:bg-accent/50 transition-colors">
                      <div>
                        <p className="font-medium text-sm">{item.name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" />{item.deadline}</p>
                      </div>
                      <Badge variant={item.status === "concluído" ? "default" : "secondary"}>
                        {item.status === "concluído" ? "Concluído" : "Pendente"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle>Distribuição por Regime Tributário</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { regime: "Simples Nacional", count: 28, pct: 58 },
                      { regime: "Lucro Presumido", count: 12, pct: 25 },
                      { regime: "Lucro Real", count: 5, pct: 10 },
                      { regime: "MEI", count: 3, pct: 7 },
                    ].map(item => (
                      <div key={item.regime}>
                        <div className="flex justify-between text-sm mb-1">
                          <span>{item.regime}</span>
                          <span className="text-muted-foreground">{item.count} clientes ({item.pct}%)</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full">
                          <div className="h-full bg-gilver rounded-full" style={{ width: `${item.pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Top Clientes por Receita</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { name: "DataFlow Systems", value: "R$ 22.000" },
                      { name: "Global Finance Ltd", value: "R$ 15.000" },
                      { name: "Acme Corporation", value: "R$ 12.500" },
                      { name: "TechStart Inc", value: "R$ 8.750" },
                      { name: "Verde Soluções", value: "R$ 6.200" },
                    ].map((client, i) => (
                      <div key={client.name} className="flex items-center gap-3 p-2 rounded-xl hover:bg-accent/50 transition-colors">
                        <span className="text-sm font-medium text-muted-foreground w-6">#{i + 1}</span>
                        <span className="flex-1 text-sm">{client.name}</span>
                        <span className="text-sm font-semibold">{client.value}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Available Reports */}
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
        </>}
      </div>
    </DashboardLayout>
  );
};

export default Reports;
