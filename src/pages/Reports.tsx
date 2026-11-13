import { useMemo, useState } from "react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import {
  BarChart3,
  Download,
  Calendar,
  TrendingUp,
  DollarSign,
  FileText,
  Users,
  LayoutDashboard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { QuickStats } from "@/components/dashboard/QuickStats";
import { BentoStatStrip } from "@/components/dashboard/BentoStatStrip";
import { CalendarEventView } from "@/components/CalendarEventView";
import { useData } from "@/contexts/DataContext";
import { useViewMode } from "@/contexts/ViewModeContext";
import { withinDateRange } from "@/lib/financialMetrics";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FilterPopover } from "@/components/FilterPopover";
import { IconTooltipButton } from "@/components/IconTooltipButton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", {
    currency: "BRL",
    maximumFractionDigits: 0,
    style: "currency",
  });

const formatDate = (date?: string | null) =>
  date
    ? new Date(date).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "Não gerado";

const currentMonthRange = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return {
    start: `${year}-${String(month).padStart(2, "0")}-01`,
    end: new Date(year, month, 0).toISOString().slice(0, 10),
  };
};

type ReportPeriod = "month" | "quarter" | "year" | "custom";
type ReportType = "overview" | "financial" | "tax" | "analytics";

const reportTypeOptions: { value: ReportType; label: string }[] = [
  { value: "overview", label: "Visão financeira" },
  { value: "financial", label: "DRE e fluxo de caixa" },
  { value: "tax", label: "Indicadores fiscais" },
  { value: "analytics", label: "Indicadores operacionais" },
];

const reportPeriodRange = (period: Exclude<ReportPeriod, "custom">) => {
  const now = new Date();
  const year = now.getFullYear();
  if (period === "year") {
    return { start: `${year}-01-01`, end: `${year}-12-31` };
  }
  if (period === "quarter") {
    const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
    return {
      start: `${year}-${String(quarterStartMonth + 1).padStart(2, "0")}-01`,
      end: new Date(year, quarterStartMonth + 3, 0).toISOString().slice(0, 10),
    };
  }
  return currentMonthRange();
};

const Reports = () => {
  const { viewMode } = useViewMode();
  const {
    clients,
    documents: allDocuments,
    invoices: allInvoices,
    payments: allPayments,
    tasks: allTasks,
    fiscalObligations: allFiscalObligations,
    generateMonthlyFiscalObligations,
    updateFiscalObligation,
  } = useData();
  const [view, setView] = useState<"dashboard" | "calendar">("dashboard");
  const [dateRange, setDateRange] = useState(currentMonthRange);
  const [periodPreset, setPeriodPreset] = useState<ReportPeriod>("month");
  const [reportType, setReportType] = useState<ReportType>("overview");
  const [clientFilter, setClientFilter] = useState("all");
  const handlePeriodChange = (period: ReportPeriod) => {
    setPeriodPreset(period);
    if (period !== "custom") setDateRange(reportPeriodRange(period));
  };
  const documents = useMemo(() => allDocuments.filter((doc) =>
    (clientFilter === "all" || doc.clientId === clientFilter) && withinDateRange(doc.createdAt, dateRange),
  ), [allDocuments, clientFilter, dateRange]);
  const invoices = useMemo(() => allInvoices.filter((invoice) =>
    (clientFilter === "all" || invoice.company_id === clientFilter) && withinDateRange(invoice.issued_at ?? invoice.created_at, dateRange),
  ), [allInvoices, clientFilter, dateRange]);
  const payments = useMemo(() => allPayments.filter((payment) =>
    (clientFilter === "all" || payment.company_id === clientFilter) && withinDateRange(payment.paid_at ?? payment.created_at, dateRange),
  ), [allPayments, clientFilter, dateRange]);
  const tasks = useMemo(() => allTasks.filter((task) =>
    (clientFilter === "all" || task.clientId === clientFilter) && withinDateRange(task.completedAt ?? task.createdAt, dateRange),
  ), [allTasks, clientFilter, dateRange]);
  const fiscalObligations = useMemo(() => allFiscalObligations.filter((obligation) =>
    (clientFilter === "all" || obligation.company_id === clientFilter) && withinDateRange(obligation.due_date, dateRange),
  ), [allFiscalObligations, clientFilter, dateRange]);

  const paidRevenue = useMemo(
    () =>
      invoices
        .filter((invoice) => invoice.status === "paid")
        .reduce((sum, invoice) => sum + Number(invoice.amount ?? 0), 0),
    [invoices],
  );
  const openRevenue = useMemo(
    () =>
      invoices
        .filter((invoice) => ["pending", "overdue"].includes(invoice.status ?? ""))
        .reduce((sum, invoice) => sum + Number(invoice.amount ?? 0), 0),
    [invoices],
  );
  const expenses = useMemo(
    () =>
      payments
        .filter(
          (payment) =>
            payment.status === "completed" && (payment.direction === "expense" || payment.direction === "saida"),
        )
        .reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0),
    [payments],
  );
  const grossRevenue = paidRevenue + openRevenue;
  const overdueInvoices = invoices.filter(
    (invoice) => invoice.status === "overdue",
  );
  const delinquencyRate = invoices.length
    ? Math.round((overdueInvoices.length / invoices.length) * 1000) / 10
    : 0;
  const activeClients = clients.filter((client) =>
    client.status === "active" && (clientFilter === "all" || client.id === clientFilter),
  );
  const completedTasks = tasks.filter((task) => task.status === "completed");
  const overdueTasks = tasks.filter((task) => task.status === "overdue");
  const overdueObligations = fiscalObligations.filter(
    (obligation) =>
          !["completed", "cancelled"].includes(obligation.status) &&
      new Date(`${obligation.due_date}T00:00:00`) < new Date(),
  );
  const processedDocuments = documents.filter(
    (doc) => doc.status === "processed" || doc.classifiedAutomatically,
  );
  const todayLabel = formatDate(new Date().toISOString());
  const reports = useMemo(
    () => [
      {
        id: "dre",
        name: "DRE Operacional",
        period: "Atual",
        type: "Financeiro",
        generated: todayLabel,
      },
      {
        id: "cashflow",
        name: "Fluxo de Caixa",
        period: "Atual",
        type: "Fluxo de Caixa",
        generated: todayLabel,
      },
      {
        id: "aging",
        name: "Contas a Receber - Aging",
        period: "Atual",
        type: "Contas a Receber",
        generated: todayLabel,
      },
      {
        id: "tax",
        name: "Resumo Fiscal",
        period: "Atual",
        type: "Fiscal",
        generated: todayLabel,
      },
      {
        id: "documents",
        name: "Documentos por Cliente",
        period: "Atual",
        type: "Operacional",
        generated: todayLabel,
      },
    ],
    [todayLabel],
  );
  const calendarEvents = useMemo(() => {
    const eventDay = (date: string) => Number(date.slice(8, 10));
    const isInRange = (date: string | null | undefined) =>
      withinDateRange(date, dateRange);

    return [
      ...invoices
        .filter((invoice) => isInRange(invoice.due_date))
        .map((invoice) => ({
          day: eventDay(invoice.due_date as string),
          title: `Fatura ${invoice.number ?? invoice.id.slice(0, 8)}`,
          subtitle: clients.find((client) => client.id === invoice.company_id)?.name ?? "Sem cliente",
          amount: formatCurrency(Number(invoice.amount ?? 0)),
          status: invoice.status === "paid" ? "Recebida" : invoice.status === "overdue" ? "Vencida" : "A receber",
        })),
      ...payments
        .filter((payment) => isInRange(payment.due_date ?? payment.paid_at ?? payment.created_at))
        .map((payment) => {
          const date = (payment.due_date ?? payment.paid_at ?? payment.created_at) as string;
          return {
            day: eventDay(date),
            title: payment.description ?? "Pagamento",
            subtitle: clients.find((client) => client.id === payment.company_id)?.name ?? "Sem cliente",
            amount: formatCurrency(Number(payment.amount ?? 0)),
            status: payment.status === "completed" ? "Concluido" : payment.status ?? "Pendente",
          };
        }),
      ...tasks
        .filter((task) => isInRange(task.dueDate))
        .map((task) => ({
          day: eventDay(task.dueDate),
          title: task.title,
          subtitle: task.clientName ?? "Sem cliente",
          status: task.status === "completed" ? "Concluida" : task.status === "overdue" ? "Atrasada" : "Tarefa",
        })),
      ...documents
        .filter((document) => isInRange(document.createdAt))
        .map((document) => ({
          day: eventDay(document.createdAt),
          title: document.name,
          subtitle: document.clientName ?? "Sem cliente",
          status: document.status === "processed" ? "Processado" : "Documento",
        })),
      ...fiscalObligations
        .filter((obligation) => isInRange(obligation.due_date))
        .map((obligation) => ({
          day: eventDay(obligation.due_date),
          title: obligation.name,
          subtitle: clients.find((client) => client.id === obligation.company_id)?.name ?? "Sem cliente",
          status: obligation.status === "completed" ? "Entregue" : "Obrigacao fiscal",
        })),
    ];
  }, [clients, dateRange, documents, fiscalObligations, invoices, payments, tasks]);
  const kpiData = [
    {
      label: "Receita Total",
      value: formatCurrency(grossRevenue),
      change: `${invoices.length} faturas`,
      icon: DollarSign,
      positive: true,
    },
    {
      label: "Clientes Ativos",
      value: String(activeClients.length),
      change: `${activeClients.length} ativos no escopo`,
      icon: Users,
      positive: true,
    },
    {
      label: "Tarefas Concluídas",
      value: String(completedTasks.length),
      change: `${overdueTasks.length} atrasadas`,
      icon: FileText,
      positive: overdueTasks.length === 0,
    },
    {
      label: "Inadimplência",
      value: `${delinquencyRate}%`,
      change: `${overdueInvoices.length} faturas vencidas`,
      icon: TrendingUp,
      positive: overdueInvoices.length === 0,
    },
    {
      label: "Obrigações Vencidas",
      value: String(overdueObligations.length),
      change: `${fiscalObligations.length} no total`,
      icon: TrendingUp,
      positive: overdueObligations.length === 0,
    },
  ];
  const taxObligations = fiscalObligations.map((obligation) => ({
    id: obligation.id,
    name: obligation.name,
    deadline: formatDate(obligation.due_date),
    status: obligation.status,
    client:
      clients.find((client) => client.id === obligation.company_id)?.name ??
      "Sem cliente",
  }));
  const topClients = Object.entries(
    invoices.reduce<Record<string, number>>((acc, invoice) => {
      if (!invoice.company_id) return acc;
      acc[invoice.company_id] =
        (acc[invoice.company_id] ?? 0) + Number(invoice.amount ?? 0);
      return acc;
    }, {}),
  )
    .map(([companyId, value]) => ({
      name:
        clients.find((client) => client.id === companyId)?.name ?? "Cliente",
      value,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const handleExportCsv = (reportName = "relatorio-lotus") => {
    const rows = [
      ["Indicador", "Valor"],
      ["Receita total", grossRevenue],
      ["Receita recebida", paidRevenue],
      ["Receita em aberto", openRevenue],
      ["Despesas", expenses],
      ["Clientes ativos", activeClients.length],
      ["Documentos", documents.length],
      ["Documentos processados", processedDocuments.length],
      ["Tarefas concluídas", completedTasks.length],
      ["Tarefas atrasadas", overdueTasks.length],
      ["Faturas vencidas", overdueInvoices.length],
      ["Obrigações vencidas", overdueObligations.length],
    ];
    const csv = rows.map((row) => row.join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${reportName}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const reportControls = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <div className="space-y-1.5">
        <Label htmlFor="report-type" className="sr-only">Tipo de relatório</Label>
        <Select value={reportType} onValueChange={(value: ReportType) => setReportType(value)}>
          <SelectTrigger id="report-type" className="h-10 w-[220px] rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {reportTypeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <FilterPopover
        title="Filtros do relatório"
        description="Escolha período e cliente sem abrir uma barra extensa de filtros."
        activeCount={[periodPreset !== "month", clientFilter !== "all"].filter(Boolean).length}
        onClear={() => {
          handlePeriodChange("month");
          setClientFilter("all");
        }}
      >
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Período</p>
          <Select value={periodPreset} onValueChange={(value) => handlePeriodChange(value as ReportPeriod)}>
            <SelectTrigger className="w-full rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Mês atual</SelectItem>
              <SelectItem value="quarter">Trimestre atual</SelectItem>
              <SelectItem value="year">Ano atual</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {periodPreset === "custom" && (
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1 text-xs font-medium text-muted-foreground" htmlFor="report-start">
              Início
              <Input
                id="report-start"
                type="date"
                value={dateRange.start}
                max={dateRange.end}
                onChange={(event) => event.target.value && setDateRange({ ...dateRange, start: event.target.value })}
              />
            </label>
            <label className="space-y-1 text-xs font-medium text-muted-foreground" htmlFor="report-end">
              Fim
              <Input
                id="report-end"
                type="date"
                value={dateRange.end}
                min={dateRange.start}
                onChange={(event) => event.target.value && setDateRange({ ...dateRange, end: event.target.value })}
              />
            </label>
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="report-client">Cliente</Label>
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger id="report-client" className="w-full rounded-xl">
              <SelectValue placeholder="Todos os clientes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os clientes</SelectItem>
              {clients.filter((client) => client.status === "active").map((client) => (
                <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </FilterPopover>
      <div className="flex rounded-full border border-border bg-card p-1">
        <IconTooltipButton
          icon={LayoutDashboard}
          label="Dashboard"
          variant={view === "dashboard" ? "default" : "ghost"}
          className="rounded-full"
          aria-pressed={view === "dashboard"}
          onClick={() => setView("dashboard")}
        />
        <IconTooltipButton
          icon={Calendar}
          label="Calendário"
          variant={view === "calendar" ? "default" : "ghost"}
          className="rounded-full"
          aria-pressed={view === "calendar"}
          onClick={() => setView("calendar")}
        />
      </div>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap gap-4 items-center justify-between animate-fade-in">
          <div>
            <h1 className="text-[28px] font-normal tracking-[-0.035em]">
              Relatórios
            </h1>
            <p className="text-muted-foreground">
              Relatórios financeiros e análises
            </p>
          </div>
          <Button
            className="rounded-xl gap-2"
            onClick={() => handleExportCsv()}
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
        </div>

        {view === "calendar" && (
          <CalendarEventView
            title="Calendário operacional"
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            events={calendarEvents}
            headerActions={reportControls}
          />
        )}

        {view === "dashboard" && (
          <section className="page-section space-y-4 animate-fade-in">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-medium">Visão do relatório</h2>
                <p className="mt-1 text-sm text-muted-foreground">Escolha o tipo, período e filtros no mesmo espaço dos dados.</p>
              </div>
              {reportControls}
            </div>
            <BentoStatStrip
              className="animate-fade-in md:grid-cols-2 xl:grid-cols-3"
              items={kpiData.map((kpi) => ({
                label: kpi.label,
                value: kpi.value,
                hint: kpi.change,
                icon: kpi.icon,
                compact: true,
              }))}
            />

            <Tabs value={reportType} onValueChange={(value) => setReportType(value as ReportType)} className="animate-fade-in">

              <TabsContent value="overview" className="space-y-6 mt-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <RevenueChart className="lg:col-span-2" dateRange={dateRange} payments={payments} />
                  <QuickStats dateRange={dateRange} payments={payments} />
                </div>
              </TabsContent>

              <TabsContent value="financial" className="space-y-6 mt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>DRE - Demonstração de Resultado</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {[
                          {
                            label: "Receita Bruta",
                            value: formatCurrency(grossRevenue),
                          },
                          {
                            label: "Receita Recebida",
                            value: formatCurrency(paidRevenue),
                          },
                          {
                            label: "Receita em Aberto",
                            value: formatCurrency(openRevenue),
                          },
                          {
                            label: "(-) Despesas",
                            value: `-${formatCurrency(expenses)}`,
                          },
                          {
                            label: "Resultado Operacional",
                            value: formatCurrency(paidRevenue - expenses),
                          },
                        ].map((row) => (
                          <div
                            key={row.label}
                            className="flex justify-between py-2 border-b border-border last:border-0"
                          >
                            <span className="text-sm">{row.label}</span>
                            <span className="text-sm font-medium">
                              {row.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle>Fluxo de Caixa</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {[
                          {
                            label: "Entradas Previstas",
                            value: formatCurrency(grossRevenue),
                          },
                          {
                            label: "Entradas Recebidas",
                            value: formatCurrency(paidRevenue),
                          },
                          {
                            label: "Saídas Registradas",
                            value: `-${formatCurrency(expenses)}`,
                          },
                          {
                            label: "Saldo Operacional",
                            value: formatCurrency(paidRevenue - expenses),
                          },
                        ].map((row) => (
                          <div
                            key={row.label}
                            className="flex justify-between py-2 border-b border-border last:border-0"
                          >
                            <span className="text-sm">{row.label}</span>
                            <span className="text-sm font-medium">
                              {row.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="tax" className="space-y-6 mt-6">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle>Obrigações Fiscais</CardTitle>
                      {viewMode !== "client" && (
                        <Button
                          variant="outline"
                          className="rounded-xl"
                          onClick={() =>
                            void generateMonthlyFiscalObligations()
                          }
                        >
                          Gerar mês atual
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {taxObligations.length === 0 && (
                        <p className="py-8 text-center text-sm text-muted-foreground">
                          Nenhuma obrigação fiscal gerada ainda.
                        </p>
                      )}
                      {taxObligations.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-3 rounded-xl hover:bg-accent/50 transition-colors"
                        >
                          <div>
                            <p className="font-medium text-sm">{item.name}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {item.client} · {item.deadline}
                            </p>
                          </div>
                          <Badge
                            variant={
                              item.status === "completed"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {item.status === "completed"
                              ? "Entregue"
                              : item.status === "in_progress"
                                ? "Em andamento"
                                : item.status === "overdue"
                                  ? "Atrasada"
                                  : "Pendente"}
                          </Badge>
                          {viewMode !== "client" && (
                            <div className="flex gap-1">
                              {item.status === "pending" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="rounded-lg"
                                  onClick={() =>
                                    void updateFiscalObligation(item.id, {
                                      status: "in_progress",
                                    })
                                  }
                                >
                                  Iniciar
                                </Button>
                              )}
                              {item.status !== "completed" && (
                                <Button
                                  size="sm"
                                  className="rounded-lg"
                                  onClick={() =>
                                    void updateFiscalObligation(item.id, {
                                      status: "completed",
                                    })
                                  }
                                >
                                  Entregar
                                </Button>
                              )}
                              {item.status === "completed" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="rounded-lg"
                                  onClick={() =>
                                    void updateFiscalObligation(item.id, {
                                      status: "pending",
                                    })
                                  }
                                >
                                  Reabrir
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="analytics" className="space-y-6 mt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Distribuição por Regime Tributário</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {[
                          {
                            regime: "Simples Nacional",
                            count: clients.filter(
                              (client) =>
                                client.taxRegime === "simples_nacional",
                            ).length,
                          },
                          {
                            regime: "Lucro Presumido",
                            count: clients.filter(
                              (client) =>
                                client.taxRegime === "lucro_presumido",
                            ).length,
                          },
                          {
                            regime: "Lucro Real",
                            count: clients.filter(
                              (client) => client.taxRegime === "lucro_real",
                            ).length,
                          },
                          {
                            regime: "MEI",
                            count: clients.filter(
                              (client) => client.taxRegime === "mei",
                            ).length,
                          },
                        ].map((item) => (
                          <div key={item.regime}>
                            <div className="flex justify-between text-sm mb-1">
                              <span>{item.regime}</span>
                              <span className="text-muted-foreground">
                                {item.count} clientes (
                                {clients.length
                                  ? Math.round(
                                      (item.count / clients.length) * 100,
                                    )
                                  : 0}
                                %)
                              </span>
                            </div>
                            <div className="h-2 bg-muted rounded-full">
                              <div
                                className="h-full bg-gilver rounded-full"
                                style={{
                                  width: `${clients.length ? Math.round((item.count / clients.length) * 100) : 0}%`,
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle>Top Clientes por Receita</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {(topClients.length
                          ? topClients
                          : [{ name: "Sem faturas registradas", value: 0 }]
                        ).map((client, i) => (
                          <div
                            key={client.name}
                            className="flex items-center gap-3 p-2 rounded-xl hover:bg-accent/50 transition-colors"
                          >
                            <span className="text-sm font-medium text-muted-foreground w-6">
                              #{i + 1}
                            </span>
                            <span className="flex-1 text-sm">
                              {client.name}
                            </span>
                            <span className="text-sm font-semibold">
                              {formatCurrency(client.value)}
                            </span>
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
              <h3 className="text-lg font-semibold mb-4">
                Relatórios Disponíveis
              </h3>
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
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-lg shrink-0"
                      aria-label={`Exportar ${report.name}`}
                      title={`Exportar ${report.name}`}
                      onClick={() =>
                        handleExportCsv(
                          report.name.toLowerCase().replace(/\s+/g, "-"),
                        )
                      }
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Reports;
