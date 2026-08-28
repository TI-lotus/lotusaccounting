import { useMemo, useState } from "react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { useNavigate } from "react-router-dom";
import { KPICard } from "@/components/dashboard/KPICard";
import { PendingRisksPanel } from "@/components/dashboard/PendingRisksPanel";
import { useViewMode } from "@/contexts/ViewModeContext";
import { useData } from "@/contexts/DataContext";
import { useUserProfile } from "@/contexts/UserProfileContext";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  DollarSign,
  TrendingUp,
  Users,
  FileText,
  CheckSquare,
  Clock,
  AlertCircle,
  Sparkles,
  ArrowRight,
  Plus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import insightsBg from "@/assets/lotus-insights.png";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const liaImprovements = [
  {
    id: "i1",
    title: "Automatizar lembretes de DAS",
    desc: "Reduz 30% do retrabalho mensal com envio automático 5 dias antes do vencimento.",
  },
  {
    id: "i2",
    title: "Reconciliar Pix com faturas",
    desc: "Conectar Pix Itaú para conciliar automaticamente 12 entradas pendentes.",
  },
  {
    id: "i3",
    title: "Categorizar despesas recorrentes",
    desc: "A Lia identificou 8 despesas que podem ser auto-categorizadas.",
  },
  {
    id: "i4",
    title: "Revisar margens dos clientes",
    desc: "3 clientes estão com honorários abaixo da média de mercado para o porte.",
  },
  {
    id: "i5",
    title: "Ativar alerta de inadimplência",
    desc: "Notifica antes que o cliente passe de 15 dias em atraso.",
  },
];

type MetricPeriod = "today" | "week" | "month" | "total";

type MetricPoint = {
  label: string;
  value: number;
};

type AmountEvent = {
  date: Date;
  amount: number;
};

type MetricInsight = {
  id: string;
  title: string;
  value: string;
  description: string;
  icon: typeof DollarSign;
  points: Record<MetricPeriod, MetricPoint[]>;
};

const metricPeriods: { value: MetricPeriod; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mês" },
  { value: "total", label: "Total" },
];

const parseDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const isWithinDashboardPeriod = (date: Date | null, period: MetricPeriod) => {
  if (!date) return false;
  const now = new Date();
  const start = startOfDay(now);

  if (period === "today") return isSameDay(date, now);
  if (period === "week") {
    const weekStart = new Date(start);
    weekStart.setDate(start.getDate() - 6);
    return date >= weekStart;
  }
  if (period === "month") {
    const monthStart = new Date(start);
    monthStart.setDate(start.getDate() - 29);
    return date >= monthStart;
  }
  return true;
};

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const buildTodayTrend = (dates: Date[], cumulative = false): MetricPoint[] => {
  const now = new Date();
  const hours = [8, 10, 12, 14, 16, 18];
  return hours.map((hour) => {
    const count = dates.filter((date) => {
      const sameDay = isSameDay(date, now);
      return (
        sameDay &&
        (cumulative ? date.getHours() <= hour : date.getHours() === hour)
      );
    }).length;
    return { label: `${String(hour).padStart(2, "0")}h`, value: count };
  });
};

const buildDayRangeTrend = (
  dates: Date[],
  days: number,
  cumulative = false,
): MetricPoint[] => {
  const today = startOfDay(new Date());
  return Array.from({ length: days }, (_, index) => {
    const day = new Date(today);
    day.setDate(today.getDate() - (days - index - 1));
    const nextDay = new Date(day);
    nextDay.setDate(day.getDate() + 1);
    const count = dates.filter((date) =>
      cumulative ? date < nextDay : date >= day && date < nextDay,
    ).length;
    return {
      label: day.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      }),
      value: count,
    };
  });
};

const buildMonthlyTrend = (
  dates: Date[],
  cumulative = false,
): MetricPoint[] => {
  const now = new Date();
  return Array.from({ length: 6 }, (_, index) => {
    const month = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    const nextMonth = new Date(month.getFullYear(), month.getMonth() + 1, 1);
    const count = dates.filter((date) =>
      cumulative ? date < nextMonth : date >= month && date < nextMonth,
    ).length;
    return {
      label: month.toLocaleDateString("pt-BR", { month: "short" }),
      value: count,
    };
  });
};

const buildTodayAmountTrend = (events: AmountEvent[]): MetricPoint[] => {
  const now = new Date();
  const hours = [8, 10, 12, 14, 16, 18];
  return hours.map((hour) => ({
    label: `${String(hour).padStart(2, "0")}h`,
    value: events
      .filter(
        (event) => isSameDay(event.date, now) && event.date.getHours() <= hour,
      )
      .reduce((sum, event) => sum + event.amount, 0),
  }));
};

const buildDayRangeAmountTrend = (
  events: AmountEvent[],
  days: number,
): MetricPoint[] => {
  const today = startOfDay(new Date());
  return Array.from({ length: days }, (_, index) => {
    const day = new Date(today);
    day.setDate(today.getDate() - (days - index - 1));
    const nextDay = new Date(day);
    nextDay.setDate(day.getDate() + 1);
    return {
      label: day.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      }),
      value: events
        .filter((event) => event.date >= day && event.date < nextDay)
        .reduce((sum, event) => sum + event.amount, 0),
    };
  });
};

const buildMonthlyAmountTrend = (events: AmountEvent[]): MetricPoint[] => {
  const now = new Date();
  return Array.from({ length: 6 }, (_, index) => {
    const month = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    const nextMonth = new Date(month.getFullYear(), month.getMonth() + 1, 1);
    return {
      label: month.toLocaleDateString("pt-BR", { month: "short" }),
      value: events
        .filter((event) => event.date >= month && event.date < nextMonth)
        .reduce((sum, event) => sum + event.amount, 0),
    };
  });
};

const buildTrendSet = (
  dates: Date[],
  cumulative = false,
): Record<MetricPeriod, MetricPoint[]> => ({
  today: buildTodayTrend(dates, cumulative),
  week: buildDayRangeTrend(dates, 7, cumulative),
  month: buildDayRangeTrend(dates, 30, cumulative),
  total: buildMonthlyTrend(dates, cumulative),
});

const buildAmountTrendSet = (
  events: AmountEvent[],
): Record<MetricPeriod, MetricPoint[]> => ({
  today: buildTodayAmountTrend(events),
  week: buildDayRangeAmountTrend(events, 7),
  month: buildDayRangeAmountTrend(events, 30),
  total: buildMonthlyAmountTrend(events),
});

const brl = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const MetricTrendDialog = ({
  metric,
  open,
  onOpenChange,
}: {
  metric: MetricInsight | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const [period, setPeriod] = useState<MetricPeriod>("week");
  const chartData = metric?.points[period] ?? [];
  const hasData = chartData.some((point) => point.value > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[680px] rounded-2xl">
        <DialogHeader>
          <DialogTitle>{metric?.title ?? "Métrica"}</DialogTitle>
          <DialogDescription>{metric?.description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-3xl font-semibold tracking-tight">
            {metric?.value}
          </p>
          <div className="flex rounded-2xl bg-muted p-1">
            {metricPeriods.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setPeriod(item.value)}
                className={cn(
                  "rounded-xl px-3 py-1.5 text-xs font-medium transition-colors",
                  period === item.value
                    ? "bg-background text-foreground"
                    : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="h-72 rounded-2xl border border-border bg-card p-4">
          {hasData ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 12, left: -12, bottom: 0 }}
              >
                <defs>
                  <linearGradient
                    id="metricTrendFill"
                    x1="0"
                    x2="0"
                    y1="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="hsl(var(--primary))"
                      stopOpacity={0.34}
                    />
                    <stop
                      offset="95%"
                      stopColor="hsl(var(--primary))"
                      stopOpacity={0.02}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12 }}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 14,
                    border: "1px solid hsl(var(--border))",
                    background: "hsl(var(--popover))",
                    color: "hsl(var(--popover-foreground))",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#metricTrendFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="grid h-full place-items-center text-center">
              <div>
                <p className="text-sm font-medium">
                  Ainda não há dados neste período
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Assim que houver registros reais, a tendência aparece aqui.
                </p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const LiaInsights = () => {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const toggle = (id: string) => setSelected((s) => ({ ...s, [id]: !s[id] }));
  const applyImprovements = () => {
    const count = Object.values(selected).filter(Boolean).length;
    toast.success(
      count > 0
        ? `${count} melhoria(s) aplicada(s) pela Lia`
        : "Nenhuma melhoria selecionada",
    );
    setOpen(false);
  };

  return (
    <>
      <div
        className="relative rounded-2xl p-5 text-white animate-fade-in overflow-hidden"
        style={{
          backgroundImage: `url(${insightsBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-black/35" />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3 min-w-0">
            <div className="rounded-xl bg-white/20 p-2 shrink-0 backdrop-blur-sm">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold">Insights da Lia</h3>
              <p className="text-sm opacity-95 mt-1">
                Receita 12% acima da média trimestral. 23 faturas vencendo nos
                próximos 7 dias. A Lia sugere automatizar lembretes para reduzir
                inadimplência em até 40%.
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            className="rounded-xl shrink-0 gap-2"
            onClick={() => setOpen(true)}
          >
            Saiba mais <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-gilver" />
              Melhorias sugeridas pela Lia
            </DialogTitle>
            <DialogDescription>
              Selecione as melhorias que deseja aplicar agora.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 max-h-[400px] overflow-y-auto custom-scroll">
            {liaImprovements.map((imp) => (
              <label
                key={imp.id}
                className="flex items-start gap-3 rounded-xl border border-border p-3 hover:bg-accent/40 cursor-pointer"
              >
                <Checkbox
                  checked={!!selected[imp.id]}
                  onCheckedChange={() => toggle(imp.id)}
                  className="mt-0.5"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{imp.title}</p>
                  <p className="text-xs text-muted-foreground">{imp.desc}</p>
                </div>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button className="rounded-xl" onClick={applyImprovements}>
              Aplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

const ClientDashboard = () => {
  const profile = useUserProfile();
  const { tasks, documents, invoices, payments, updateTaskStatus } = useData();
  const [selectedMetric, setSelectedMetric] = useState<MetricInsight | null>(
    null,
  );
  const openTasks = tasks.filter((task) => task.status !== "completed");
  const completedTasks = tasks.filter((task) => task.status === "completed");
  const pendingDocuments = documents.filter(
    (doc) => doc.status === "pending" || doc.status === "unread",
  );
  const pendingFinancial = useMemo(
    () => [
      ...invoices.filter(
        (invoice) =>
          invoice.status === "pending" || invoice.status === "overdue",
      ),
      ...payments.filter((payment) => payment.status === "pending"),
    ],
    [invoices, payments],
  );
  const clientMetrics = useMemo<MetricInsight[]>(() => {
    const openTaskDates = openTasks
      .map((task) => parseDate(task.dueDate))
      .filter(Boolean) as Date[];
    const completedTaskDates = completedTasks
      .map((task) => parseDate(task.completedAt ?? task.createdAt))
      .filter(Boolean) as Date[];
    const documentDates = documents
      .map((doc) => parseDate(doc.createdAt))
      .filter(Boolean) as Date[];
    const pendingFinancialDates = pendingFinancial
      .map((item) =>
        "due_date" in item
          ? parseDate(item.due_date ?? item.created_at)
          : parseDate(item.created_at),
      )
      .filter(Boolean) as Date[];

    return [
      {
        id: "client-open-tasks",
        title: "Tarefas Abertas",
        value: String(openTasks.length),
        description:
          "Tendência das tarefas que seguem pendentes ou em andamento.",
        icon: CheckSquare,
        points: buildTrendSet(openTaskDates),
      },
      {
        id: "client-completed-tasks",
        title: "Tarefas Concluídas",
        value: String(completedTasks.length),
        description: "Tarefas concluídas por período.",
        icon: Clock,
        points: buildTrendSet(completedTaskDates),
      },
      {
        id: "client-documents",
        title: "Documentos Recentes",
        value: String(documents.length),
        description: "Entrada de documentos na conta ao longo do tempo.",
        icon: FileText,
        points: buildTrendSet(documentDates),
      },
      {
        id: "client-pending-payments",
        title: "Pagamentos Pendentes",
        value: String(pendingFinancial.length),
        description: "Faturas e pagamentos pendentes vinculados à conta.",
        icon: AlertCircle,
        points: buildTrendSet(pendingFinancialDates),
      },
    ];
  }, [completedTasks, documents, openTasks, pendingFinancial]);

  return (
    <div className="space-y-6">
      <div className="animate-fade-in">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Bem-vindo de volta, {profile.firstName}. Aqui está o resumo da sua
          empresa.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {clientMetrics.map((metric) => (
          <KPICard
            key={metric.id}
            title={metric.title}
            value={metric.value}
            changeLabel={
              metric.id === "client-open-tasks"
                ? "Pendentes no seu painel"
                : metric.id === "client-completed-tasks"
                  ? "Histórico da conta"
                  : metric.id === "client-documents"
                    ? "Documentos cadastrados"
                    : "Documentos a revisar"
            }
            icon={metric.icon}
            onClick={() => setSelectedMetric(metric)}
          />
        ))}
      </div>

      {/* Recent Documents */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass rounded-2xl p-6 animate-fade-in">
          <h3 className="text-lg font-semibold mb-4">Documentos Recentes</h3>
          <div className="space-y-3">
            {documents.slice(0, 5).map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-accent/50 transition-colors"
              >
                <div className="p-2 rounded-lg bg-accent">
                  <FileText className="h-4 w-4 text-accent-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{doc.name}</p>
                  <p className="text-xs text-muted-foreground">{doc.date}</p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {doc.documentType}
                </Badge>
              </div>
            ))}
            {documents.length === 0 && (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Nenhum documento cadastrado ainda.
              </p>
            )}
          </div>
        </div>

        {/* Tasks */}
        <div className="glass rounded-2xl p-6 animate-fade-in">
          <h3 className="text-lg font-semibold mb-4">Tarefas da conta</h3>
          <div className="space-y-3">
            {tasks.slice(0, 5).map((task) => (
              <div
                key={task.id}
                className="flex items-start gap-3 p-3 rounded-xl border border-border hover:bg-accent/30 transition-colors"
              >
                <Checkbox
                  checked={task.status === "completed"}
                  onCheckedChange={(checked) =>
                    updateTaskStatus(task.id, checked ? "completed" : "pending")
                  }
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      task.status === "completed" &&
                        "line-through text-muted-foreground",
                    )}
                  >
                    {task.title}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {task.clientName} · vence em{" "}
                    {new Date(task.dueDate).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Payment Summary */}
      <div className="glass rounded-2xl p-6 animate-fade-in">
        <h3 className="text-lg font-semibold mb-4">Resumo de Pagamentos</h3>
        {pendingFinancial.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Nenhuma cobrança pendente para sua conta.
          </p>
        ) : (
          <div className="space-y-3">
            {pendingFinancial.slice(0, 5).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-xl border border-border p-3"
              >
                <div>
                  <p className="text-sm font-medium">
                    {"number" in item
                      ? item.number || `Fatura ${item.id.slice(0, 8)}`
                      : item.description || `Pagamento ${item.id.slice(0, 8)}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Vencimento:{" "}
                    {item.due_date
                      ? new Date(item.due_date).toLocaleDateString("pt-BR")
                      : "sem data"}
                  </p>
                </div>
                <span className="text-sm font-semibold">
                  {brl(Number(item.amount ?? 0))}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <MetricTrendDialog
        metric={selectedMetric}
        open={!!selectedMetric}
        onOpenChange={(open) => !open && setSelectedMetric(null)}
      />
    </div>
  );
};

const Index = () => {
  const navigate = useNavigate();
  const { viewMode } = useViewMode();
  const profile = useUserProfile();
  const { clients, tasks, documents, payments, invoices, updateTaskStatus } =
    useData();
  const [selectedMetric, setSelectedMetric] = useState<MetricInsight | null>(
    null,
  );
  const [dashboardPeriod, setDashboardPeriod] = useState<MetricPeriod>("month");
  const [dashboardClientId, setDashboardClientId] = useState("all");
  const filteredTasks = tasks.filter(
    (task) =>
      (dashboardClientId === "all" || task.clientId === dashboardClientId) &&
      isWithinDashboardPeriod(parseDate(task.dueDate), dashboardPeriod),
  );
  const filteredDocuments = documents.filter(
    (doc) =>
      (dashboardClientId === "all" || doc.clientId === dashboardClientId) &&
      isWithinDashboardPeriod(parseDate(doc.createdAt), dashboardPeriod),
  );
  const filteredPayments = payments.filter(
    (payment) =>
      (dashboardClientId === "all" ||
        payment.company_id === dashboardClientId) &&
      isWithinDashboardPeriod(
        parseDate(payment.paid_at ?? payment.created_at),
        dashboardPeriod,
      ),
  );
  const filteredInvoices = invoices.filter(
    (invoice) =>
      (dashboardClientId === "all" ||
        invoice.company_id === dashboardClientId) &&
      isWithinDashboardPeriod(
        parseDate(invoice.issued_at ?? invoice.created_at),
        dashboardPeriod,
      ),
  );
  const openTasks = filteredTasks.filter((task) => task.status !== "completed");
  const overdueTasks = filteredTasks.filter(
    (task) => task.status === "overdue",
  );
  const pendingDocuments = filteredDocuments.filter(
    (doc) => doc.status === "pending" || doc.status === "unread",
  );
  const completedIncomePayments = filteredPayments.filter(
    (payment) =>
      payment.status === "completed" &&
      (payment.direction === "entrada" || payment.direction === "income"),
  );
  const totalRevenue = completedIncomePayments.reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0,
  );
  const pendingFinancialCount =
    filteredPayments.filter((payment) => payment.status === "pending").length +
    filteredInvoices.filter(
      (invoice) => invoice.status === "pending" || invoice.status === "overdue",
    ).length;
  const officeMetrics = useMemo<MetricInsight[]>(() => {
    const activeClientDates = clients
      .filter(
        (client) =>
          client.status === "active" &&
          (dashboardClientId === "all" || client.id === dashboardClientId),
      )
      .map((client) => parseDate(client.createdAt))
      .filter(Boolean) as Date[];
    const openTaskDates = openTasks
      .map((task) => parseDate(task.dueDate))
      .filter(Boolean) as Date[];
    const pendingDocumentDates = pendingDocuments
      .map((doc) => parseDate(doc.createdAt))
      .filter(Boolean) as Date[];
    const revenueEvents = completedIncomePayments
      .map((payment) => {
        const date = parseDate(payment.paid_at ?? payment.created_at);
        if (!date) return null;
        return { date, amount: Number(payment.amount || 0) };
      })
      .filter(Boolean) as AmountEvent[];

    return [
      {
        id: "revenue",
        title: "Receita Total",
        value: brl(totalRevenue),
        description: "Receita confirmada por pagamentos concluídos de entrada.",
        icon: DollarSign,
        points: buildAmountTrendSet(revenueEvents),
      },
      {
        id: "open-tasks",
        title: "Tarefas Abertas",
        value: String(openTasks.length),
        description: "Tendência das tarefas abertas por vencimento.",
        icon: TrendingUp,
        points: buildTrendSet(openTaskDates),
      },
      {
        id: "active-clients",
        title: "Clientes Ativos",
        value: String(
          clients.filter(
            (client) =>
              client.status === "active" &&
              (dashboardClientId === "all" || client.id === dashboardClientId),
          ).length,
        ),
        description: "Crescimento acumulado da carteira ativa.",
        icon: Users,
        points: buildTrendSet(activeClientDates, true),
      },
      {
        id: "pending-documents",
        title: "Documentos Pendentes",
        value: String(pendingDocuments.length),
        description: "Entrada de documentos pendentes ou não lidos.",
        icon: FileText,
        points: buildTrendSet(pendingDocumentDates),
      },
    ];
  }, [
    clients,
    completedIncomePayments,
    dashboardClientId,
    openTasks,
    pendingDocuments,
    totalRevenue,
  ]);

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
            Bem-vindo de volta, {profile.firstName}. Aqui está seu panorama
            financeiro.
          </p>
        </div>

        <PendingRisksPanel />

        <div className="glass flex flex-wrap items-center gap-3 rounded-2xl p-3 animate-fade-in">
          <Select
            value={dashboardPeriod}
            onValueChange={(value: MetricPeriod) => setDashboardPeriod(value)}
          >
            <SelectTrigger className="h-10 w-full rounded-xl sm:w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {metricPeriods.map((period) => (
                <SelectItem key={period.value} value={period.value}>
                  {period.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={dashboardClientId}
            onValueChange={setDashboardClientId}
          >
            <SelectTrigger className="h-10 w-full rounded-xl sm:w-[260px]">
              <SelectValue placeholder="Todos os clientes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os clientes</SelectItem>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {clients.length === 0 && (
          <div className="glass rounded-2xl p-6 animate-fade-in">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  Comece cadastrando seu primeiro cliente
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Clientes são a base para tarefas, documentos, faturas e
                  conciliação no Lotus.
                </p>
              </div>
              <Button
                className="rounded-xl gap-2 md:shrink-0"
                onClick={() => navigate("/clients")}
              >
                <Plus className="h-4 w-4" />
                Cadastrar cliente
              </Button>
            </div>
          </div>
        )}

        <LiaInsights />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {officeMetrics.map((metric) => (
            <KPICard
              key={metric.id}
              title={metric.title}
              value={metric.value}
              changeLabel={
                metric.id === "revenue"
                  ? `${pendingFinancialCount} pendência(s) financeira(s)`
                  : metric.id === "open-tasks"
                    ? `${overdueTasks.length} atrasada(s)`
                    : metric.id === "active-clients"
                      ? `${clients.length} cadastrados`
                      : `${filteredDocuments.length} documentos`
              }
              icon={metric.icon}
              onClick={() => setSelectedMetric(metric)}
            />
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass rounded-2xl p-6 animate-fade-in">
            <h3 className="text-lg font-semibold mb-4">Resumo financeiro</h3>
            {filteredPayments.length === 0 && filteredInvoices.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  Lance pagamentos e faturas para acompanhar receitas, despesas
                  e conciliação neste painel.
                </p>
                <div className="mt-4 flex justify-center gap-2">
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => navigate("/invoices")}
                  >
                    Criar fatura
                  </Button>
                  <Button
                    className="rounded-xl"
                    onClick={() => navigate("/payments")}
                  >
                    Registrar pagamento
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-muted p-4">
                  <p className="text-xs text-muted-foreground">Recebido</p>
                  <p className="mt-1 text-lg font-semibold">
                    {brl(totalRevenue)}
                  </p>
                </div>
                <div className="rounded-xl bg-muted p-4">
                  <p className="text-xs text-muted-foreground">Faturas</p>
                  <p className="mt-1 text-lg font-semibold">
                    {filteredInvoices.length}
                  </p>
                </div>
                <div className="rounded-xl bg-muted p-4">
                  <p className="text-xs text-muted-foreground">Pagamentos</p>
                  <p className="mt-1 text-lg font-semibold">
                    {filteredPayments.length}
                  </p>
                </div>
              </div>
            )}
          </div>
          <div className="glass rounded-2xl p-6 animate-fade-in">
            <h3 className="text-lg font-semibold mb-4">Tarefas da conta</h3>
            <div className="space-y-3">
              {filteredTasks.length === 0 && (
                <div className="py-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    Nenhuma tarefa encontrada para este filtro.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-4 rounded-xl"
                    onClick={() => navigate("/tasks")}
                  >
                    Criar tarefa
                  </Button>
                </div>
              )}
              {filteredTasks.slice(0, 6).map((task) => (
                <div
                  key={task.id}
                  className="flex items-start gap-3 p-3 rounded-xl border border-border hover:bg-accent/30 transition-colors"
                >
                  <Checkbox
                    checked={task.status === "completed"}
                    onCheckedChange={(checked) =>
                      updateTaskStatus(
                        task.id,
                        checked ? "completed" : "pending",
                      )
                    }
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-sm font-medium",
                        task.status === "completed" &&
                          "line-through text-muted-foreground",
                      )}
                    >
                      {task.title}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {task.clientName} · vence em{" "}
                      {new Date(task.dueDate).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">
                    {task.category}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
        <MetricTrendDialog
          metric={selectedMetric}
          open={!!selectedMetric}
          onOpenChange={(open) => !open && setSelectedMetric(null)}
        />
      </div>
    </DashboardLayout>
  );
};

export default Index;
