import { useEffect, useMemo, useRef, useState } from "react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { useNavigate } from "react-router-dom";
import { KPICard } from "@/components/dashboard/KPICard";
import { PendingRisksPanel } from "@/components/dashboard/PendingRisksPanel";
import { OperationalIndicatorsPanel } from "@/components/dashboard/OperationalIndicatorsPanel";
import { useViewMode } from "@/contexts/ViewModeContext";
import { useData } from "@/contexts/DataContext";
import { useUserProfile } from "@/contexts/UserProfileContext";
import { useAuth } from "@/contexts/AuthContext";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  CalendarClock,
  Upload,
  SlidersHorizontal,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
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

type MessageRow = Database["public"]["Tables"]["messages"]["Row"];
type ConversationRow = Database["public"]["Tables"]["conversations"]["Row"];
type RecentMessage = MessageRow & {
  senderName: string;
  conversationName: string;
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

const currentOperationalPeriod = () => {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
};

const periodStatusLabels: Record<string, string> = {
  not_started: "Não iniciada",
  waiting_documents: "Aguardando documentos",
  in_progress: "Em execução",
  in_review: "Em revisão",
  delivered: "Entregue",
  closed: "Fechada",
  blocked: "Bloqueada",
};

const periodStatusStyles: Record<string, string> = {
  not_started: "bg-muted text-muted-foreground",
  waiting_documents: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  in_review: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  delivered: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  closed: "bg-gilver text-[hsl(0,0%,9%)]",
  blocked: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

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
  const modalChartData = chartData.length
    ? chartData
    : [
        { label: "—", value: 0 },
        { label: "—", value: 0 },
        { label: "—", value: 0 },
      ];
  const firstValue = modalChartData[0]?.value ?? 0;
  const lastValue = modalChartData[modalChartData.length - 1]?.value ?? 0;
  const trendDirection =
    lastValue > firstValue
      ? "positive"
      : lastValue < firstValue
        ? "negative"
        : "neutral";
  const trendStroke =
    trendDirection === "positive"
      ? "hsl(142 71% 42%)"
      : trendDirection === "negative"
        ? "hsl(0 72% 55%)"
        : "hsl(var(--primary))";
  const MetricIcon = metric?.icon ?? TrendingUp;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="kpi-trend-dialog">
        <DialogHeader className="dialog-header">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <MetricIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle>{metric?.title ?? "Métrica"}</DialogTitle>
              <DialogDescription className="mt-1">
                {metric?.description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="dialog-body kpi-trend-dialog-body">
          <div className="kpi-trend-summary">
            <div>
              <p className="kpi-trend-eyebrow">Valor atual</p>
              <p className="kpi-trend-value">{metric?.value ?? "—"}</p>
            </div>
            <div className="kpi-trend-period">
              <p className="kpi-trend-eyebrow">Período da evolução</p>
              <Select value={period} onValueChange={(value: MetricPeriod) => setPeriod(value)}>
                <SelectTrigger className="h-10 w-full rounded-xl sm:w-[170px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {metricPeriods.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="kpi-trend-chart-card">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={modalChartData}
                  margin={{ top: 10, right: 12, left: -12, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id={`metric-trend-fill-${metric?.id ?? "metric"}-${period}`}
                      x1="0"
                      x2="0"
                      y1="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor={trendStroke}
                        stopOpacity={hasData ? 0.3 : 0.12}
                      />
                      <stop
                        offset="95%"
                        stopColor={trendStroke}
                        stopOpacity={0.01}
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
                    stroke={trendStroke}
                    strokeWidth={2.4}
                    strokeOpacity={hasData ? 1 : 0.45}
                    fill={`url(#metric-trend-fill-${metric?.id ?? "metric"}-${period})`}
                    dot={{ r: 3, fill: trendStroke, strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: trendStroke, stroke: "hsl(var(--card))", strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {!hasData && (
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Ainda não há registros reais neste período.
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="dialog-footer">
          <button
            type="button"
            className="h-10 rounded-xl border border-border bg-card px-4 text-sm font-medium transition-colors hover:bg-accent"
            onClick={() => onOpenChange(false)}
          >
            Fechar
          </button>
        </DialogFooter>
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
  const navigate = useNavigate();
  const profile = useUserProfile();
  const { profile: authProfile, user } = useAuth();
  const {
    clients,
    tasks,
    documents,
    documentRequests,
    invoices,
    payments,
    fiscalObligations,
    clientPeriods,
    clientPeriodSteps,
    updateTaskStatus,
    processFileUpload,
  } = useData();
  const [selectedMetric, setSelectedMetric] = useState<MetricInsight | null>(
    null,
  );
  const [recentMessages, setRecentMessages] = useState<RecentMessage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadRequestId, setUploadRequestId] = useState<string | undefined>();
  const activePeriod = currentOperationalPeriod();
  const companyId = authProfile?.company_id ?? clients[0]?.id ?? null;
  const currentPeriod = useMemo(
    () =>
      clientPeriods.find(
        (period) =>
          (!companyId || period.companyId === companyId) &&
          period.periodMonth === activePeriod.month &&
          period.periodYear === activePeriod.year,
      ) ?? null,
    [activePeriod.month, activePeriod.year, clientPeriods, companyId],
  );
  const currentPeriodSteps = useMemo(
    () =>
      currentPeriod
        ? clientPeriodSteps
            .filter((step) => step.clientPeriodId === currentPeriod.id)
            .sort((a, b) => a.position - b.position)
        : [],
    [clientPeriodSteps, currentPeriod],
  );
  const openTasks = tasks.filter((task) => task.status !== "completed");
  const completedTasks = tasks.filter((task) => task.status === "completed");
  const pendingDocuments = documents.filter(
    (doc) => doc.status === "pending" || doc.status === "unread",
  );
  const openDocumentRequests = documentRequests.filter((request) =>
    ["requested", "rejected"].includes(request.status),
  );
  const waitingApprovalRequests = documentRequests.filter(
    (request) => request.status === "uploaded",
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
  const upcomingItems = useMemo(() => {
    const rows = [
      ...openDocumentRequests
        .filter((request) => request.dueDate)
        .map((request) => ({
          id: `doc-${request.id}`,
          label: request.status === "rejected" ? `Reenviar: ${request.title}` : `Enviar: ${request.title}`,
          date: request.dueDate as string,
          href: "/documents",
          kind: "Documento",
        })),
      ...invoices
        .filter((invoice) => ["pending", "overdue"].includes(invoice.status ?? "") && invoice.due_date)
        .map((invoice) => ({
          id: `invoice-${invoice.id}`,
          label: invoice.number || `Fatura ${invoice.id.slice(0, 8)}`,
          date: invoice.due_date as string,
          href: "/invoices",
          kind: "Fatura",
        })),
      ...fiscalObligations
        .filter((obligation) => obligation.status !== "completed" && obligation.due_date)
        .map((obligation) => ({
          id: `obligation-${obligation.id}`,
          label: obligation.name,
          date: obligation.due_date as string,
          href: "/agenda",
          kind: "Vencimento",
        })),
    ];
    return rows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(0, 6);
  }, [fiscalObligations, invoices, openDocumentRequests]);
  const actionItems = useMemo(() => {
    const rows = [
      ...openDocumentRequests.map((request) => ({
        id: `doc-${request.id}`,
        title: request.status === "rejected" ? `Reenviar ${request.title}` : request.title,
        description: request.rejectionReason || request.description || "Documento pendente para o escritório.",
        action: request.status === "rejected" ? "Reenviar documento" : "Enviar documento",
        href: "/documents",
        tone: request.status === "rejected" ? "danger" : "warning",
      })),
      ...pendingFinancial.slice(0, 3).map((item) => ({
        id: `financial-${item.id}`,
        title: "number" in item ? item.number || `Fatura ${item.id.slice(0, 8)}` : item.description || `Pagamento ${item.id.slice(0, 8)}`,
        description: `Valor: ${brl(Number(item.amount ?? 0))}`,
        action: "Ver fatura",
        href: "number" in item ? "/invoices" : "/payments",
        tone: "warning",
      })),
    ];
    return rows.slice(0, 5);
  }, [openDocumentRequests, pendingFinancial]);

  const uploadForRequest = (requestId: string) => {
    setUploadRequestId(requestId);
    fileInputRef.current?.click();
  };

  const handleRequestFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    const requestId = uploadRequestId;
    if (!files?.length || !requestId) return;
    for (let index = 0; index < files.length; index += 1) {
      await processFileUpload(files[index], requestId);
    }
    toast.success(files.length > 1 ? "Arquivos enviados para análise" : "Arquivo enviado para análise");
    setUploadRequestId(undefined);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  useEffect(() => {
    let cancelled = false;
    const loadRecentMessages = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(3);
      const rows = (data ?? []) as MessageRow[];
      const senderIds = Array.from(new Set(rows.map((message) => message.sender_id).filter(Boolean))) as string[];
      const conversationIds = Array.from(new Set(rows.map((message) => message.conversation_id).filter(Boolean))) as string[];
      const [profilesRes, conversationsRes] = await Promise.all([
        senderIds.length
          ? supabase.from("profiles").select("user_id, full_name").in("user_id", senderIds)
          : Promise.resolve({ data: [] }),
        conversationIds.length
          ? supabase.from("conversations").select("*").in("id", conversationIds)
          : Promise.resolve({ data: [] }),
      ]);
      if (cancelled) return;
      const senderById = new Map(
        ((profilesRes.data ?? []) as { user_id: string; full_name: string | null }[])
          .map((sender) => [sender.user_id, sender.full_name || "Equipe Lotus"]),
      );
      const conversationById = new Map(
        ((conversationsRes.data ?? []) as ConversationRow[]).map((conversation) => [conversation.id, conversation]),
      );
      setRecentMessages(rows.map((message) => {
        const conversation = message.conversation_id ? conversationById.get(message.conversation_id) : null;
        const client = message.company_id ? clients.find((item) => item.id === message.company_id) : null;
        const senderName = message.sender_id === user?.id ? "Você" : senderById.get(message.sender_id ?? "") || "Equipe Lotus";
        return {
          ...message,
          senderName,
          conversationName: conversation?.title || client?.name || "Conversa com o escritório",
        };
      }));
    };
    void loadRecentMessages();
    return () => {
      cancelled = true;
    };
  }, [clients, user?.id]);
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
        parseDate(item.due_date ?? item.created_at),
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
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => void handleRequestFileUpload(event)}
      />
      <div className="animate-fade-in">
        <h1 className="text-2xl font-semibold tracking-tight">Minha empresa</h1>
        <p className="text-muted-foreground">
          Bem-vindo de volta, {profile.firstName}. Aqui está o resumo da sua
          empresa.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
        <div className="glass rounded-2xl p-6 animate-fade-in">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Competência atual</p>
              <h2 className="mt-1 text-xl font-semibold">
                {activePeriod.month.toString().padStart(2, "0")}/{activePeriod.year}
              </h2>
            </div>
            <Badge className={cn("text-xs", periodStatusStyles[currentPeriod?.status ?? "not_started"])}>
              {periodStatusLabels[currentPeriod?.status ?? "not_started"]}
            </Badge>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progresso do mês</span>
              <span className="font-medium">{currentPeriod?.progressPercent ?? 0}%</span>
            </div>
            <Progress value={currentPeriod?.progressPercent ?? 0} className="h-2" />
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {currentPeriodSteps.slice(0, 6).map((step) => (
                <div key={step.id} className="rounded-xl border border-border p-3">
                  <p className="truncate text-sm font-medium">{step.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {step.status === "completed" || step.status === "waived"
                      ? "Concluído"
                      : step.status === "blocked"
                        ? "Pendente"
                        : "Em acompanhamento"}
                  </p>
                </div>
              ))}
              {currentPeriodSteps.length === 0 && (
                <div className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
                  O escritório ainda não iniciou a competência deste mês.
                </div>
              )}
            </div>
          </div>
          <Button className="mt-5 rounded-xl gap-2" onClick={() => navigate("/periods")}>
            Acompanhar mês
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="glass rounded-2xl p-6 animate-fade-in">
          <h3 className="text-lg font-semibold">Ações necessárias</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Pendências que precisam da sua atenção.
          </p>
          <div className="mt-4 space-y-3">
            {actionItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.href)}
                className={cn(
                  "w-full rounded-xl border p-3 text-left transition-colors hover:bg-accent/35",
                  item.tone === "danger" ? "border-red-200 dark:border-red-900" : "border-border",
                )}
              >
                <p className="text-sm font-medium">{item.title}</p>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
                  {item.action}
                  <ArrowRight className="h-3 w-3" />
                </span>
              </button>
            ))}
            {actionItems.length === 0 && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
                Nenhuma ação necessária.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {clientMetrics.map((metric) => (
          <KPICard
            key={metric.id}
            title={metric.title}
            value={metric.value}
            trend={metric.points.week.map((point) => point.value)}
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
          <h3 className="text-lg font-semibold mb-4">Pendências de documentos</h3>
          <div className="space-y-3">
            {openDocumentRequests.slice(0, 5).map((request) => (
              <div key={request.id} className="rounded-xl border border-border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{request.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {request.dueDate ? `Vence em ${new Date(`${request.dueDate}T00:00:00`).toLocaleDateString("pt-BR")}` : "Sem prazo definido"}
                    </p>
                  </div>
                  <Badge variant={request.status === "rejected" ? "destructive" : "outline"} className="shrink-0 text-[10px]">
                    {request.status === "rejected" ? "Recusado" : "Pendente"}
                  </Badge>
                </div>
                {request.rejectionReason && <p className="mt-2 text-xs text-red-600">{request.rejectionReason}</p>}
                <Button size="sm" className="mt-3 h-8 rounded-lg gap-2" onClick={() => uploadForRequest(request.id)}>
                  <Upload className="h-3.5 w-3.5" />
                  {request.status === "rejected" ? "Reenviar documento" : "Enviar documento"}
                </Button>
              </div>
            ))}
            {openDocumentRequests.length === 0 && (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Nenhum documento pendente para envio.
              </p>
            )}
            {waitingApprovalRequests.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {waitingApprovalRequests.length} documento(s) aguardando aprovação do escritório.
              </p>
            )}
          </div>
        </div>

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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass rounded-2xl p-6 animate-fade-in">
          <h3 className="text-lg font-semibold mb-4">Próximos vencimentos</h3>
          <div className="space-y-3">
            {upcomingItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(`${item.date}T00:00:00`).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0 text-[10px]">{item.kind}</Badge>
              </div>
            ))}
            {upcomingItems.length === 0 && (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Nenhum vencimento próximo.
              </p>
            )}
          </div>
        </div>

        <div className="glass rounded-2xl p-6 animate-fade-in">
          <h3 className="text-lg font-semibold mb-4">Mensagens recentes</h3>
          <div className="space-y-3">
            {recentMessages.map((message) => (
              <button
                key={message.id}
                type="button"
                onClick={() => navigate(message.conversation_id ? `/messages?conversation=${message.conversation_id}` : "/messages")}
                className="w-full rounded-xl border border-border p-3 text-left transition-colors hover:bg-accent/35"
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium">{message.senderName}</p>
                  <Badge variant="outline" className="shrink-0 text-[10px]">Mensagem</Badge>
                </div>
                <p className="truncate text-xs text-muted-foreground">{message.conversationName}</p>
                <p className="mt-2 line-clamp-2 text-sm">{message.message || "Mensagem sem texto"}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(message.created_at).toLocaleString("pt-BR")}
                </p>
              </button>
            ))}
            {recentMessages.length === 0 && (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Nenhuma mensagem recente.
              </p>
            )}
          </div>
        </div>

        <div className="glass rounded-2xl p-6 animate-fade-in">
          <h3 className="text-lg font-semibold mb-4">Histórico de competências</h3>
          <div className="space-y-3">
            {clientPeriods.slice(0, 5).map((period) => (
              <div key={period.id} className="rounded-xl border border-border p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">
                    {String(period.periodMonth).padStart(2, "0")}/{period.periodYear}
                  </p>
                  <Badge className={cn("text-[10px]", periodStatusStyles[period.status])}>
                    {periodStatusLabels[period.status] ?? period.status}
                  </Badge>
                </div>
                <Progress value={period.progressPercent} className="mt-3 h-2" />
              </div>
            ))}
            {clientPeriods.length === 0 && (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Ainda não há competências registradas.
              </p>
            )}
          </div>
        </div>
      </div>

      {openTasks.length > 0 && (
        <div className="glass rounded-2xl p-6 animate-fade-in">
          <h3 className="text-lg font-semibold mb-4">Tarefas da conta</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {openTasks.slice(0, 4).map((task) => (
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
                  <p className="text-sm font-medium">{task.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    Vence em {new Date(task.dueDate).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
  const {
    clients,
    tasks,
    documents,
    payments,
    invoices,
    clientPeriods,
    clientPeriodSteps,
    updateTaskStatus,
  } = useData();
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
  const activePeriod = useMemo(() => currentOperationalPeriod(), []);
  const currentPeriods = useMemo(
    () =>
      clientPeriods.filter(
        (period) =>
          period.periodMonth === activePeriod.month &&
          period.periodYear === activePeriod.year &&
          (dashboardClientId === "all" || period.companyId === dashboardClientId),
      ),
    [activePeriod.month, activePeriod.year, clientPeriods, dashboardClientId],
  );
  const currentPeriodClientIds = new Set(currentPeriods.map((period) => period.companyId));
  const activeClientsForPeriod = clients.filter(
    (client) =>
      client.status === "active" &&
      (dashboardClientId === "all" || client.id === dashboardClientId),
  );
  const missingCurrentPeriods = activeClientsForPeriod.filter(
    (client) => !currentPeriodClientIds.has(client.id),
  );
  const currentPeriodStats = {
    created: currentPeriods.length,
    waiting: currentPeriods.filter((period) => period.status === "waiting_documents").length,
    review: currentPeriods.filter((period) => period.status === "in_review").length,
    blocked: currentPeriods.filter((period) => period.status === "blocked").length,
    closed: currentPeriods.filter((period) => period.status === "closed").length,
    averageProgress: currentPeriods.length
      ? Math.round(currentPeriods.reduce((sum, period) => sum + period.progressPercent, 0) / currentPeriods.length)
      : 0,
  };
  const currentPeriodRisks = useMemo(() => {
    const clientById = new Map(clients.map((client) => [client.id, client]));
    return currentPeriods
      .map((period) => {
        const steps = clientPeriodSteps.filter((step) => step.clientPeriodId === period.id);
        const blockedSteps = steps.filter((step) => step.status === "blocked");
        const pendingSteps = steps.filter((step) => step.status === "pending").length;
        return {
          period,
          client: clientById.get(period.companyId),
          blockedSteps,
          pendingSteps,
          weight:
            (period.status === "blocked" ? 100 : 0) +
            (period.status === "waiting_documents" ? 50 : 0) +
            (period.status === "in_review" ? 25 : 0) +
            blockedSteps.length * 20 +
            pendingSteps,
        };
      })
      .filter((item) => item.client && (item.weight > 0 || item.period.progressPercent < 100))
      .sort((a, b) => b.weight - a.weight || a.period.progressPercent - b.period.progressPercent)
      .slice(0, 5);
  }, [clientPeriodSteps, clients, currentPeriods]);
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

        <OperationalIndicatorsPanel />

        <div className="glass flex items-center justify-between gap-3 rounded-2xl p-3 animate-fade-in">
          <div className="min-w-0">
            <p className="text-sm font-medium">Filtros do painel</p>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {metricPeriods.find((item) => item.value === dashboardPeriod)?.label} · {dashboardClientId === "all" ? "Todos os clientes" : clients.find((client) => client.id === dashboardClientId)?.name ?? "Cliente selecionado"}
            </p>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="shrink-0 rounded-xl gap-2">
                <SlidersHorizontal className="h-4 w-4" />
                Ajustar filtros
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[min(360px,calc(100vw-2rem))] rounded-2xl p-4">
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium">Filtros do painel</p>
                  <p className="mt-1 text-xs text-muted-foreground">Atualize o período e a carteira analisada.</p>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Período</p>
                  <Select
                    value={dashboardPeriod}
                    onValueChange={(value: MetricPeriod) => setDashboardPeriod(value)}
                  >
                    <SelectTrigger className="h-10 w-full rounded-xl">
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
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Cliente</p>
                  <Select
                    value={dashboardClientId}
                    onValueChange={setDashboardClientId}
                  >
                    <SelectTrigger className="h-10 w-full rounded-xl">
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
              </div>
            </PopoverContent>
          </Popover>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {officeMetrics.map((metric) => (
            <KPICard
              key={metric.id}
              title={metric.title}
              value={metric.value}
              trend={metric.points[dashboardPeriod].map((point) => point.value)}
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

        <div className="glass rounded-2xl p-6 animate-fade-in">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">Gargalos da competência atual</h3>
              <p className="text-sm text-muted-foreground">
                {String(activePeriod.month).padStart(2, "0")}/{activePeriod.year} · ciclo operacional por cliente
              </p>
            </div>
            <Button
              variant="outline"
              className="rounded-xl gap-2"
              onClick={() => navigate("/periods")}
            >
              <CalendarClock className="h-4 w-4" />
              Abrir ciclo mensal
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-xl bg-muted p-4">
              <p className="text-xs text-muted-foreground">Criadas</p>
              <p className="mt-1 text-2xl font-semibold">
                {currentPeriodStats.created}/{activeClientsForPeriod.length}
              </p>
            </div>
            <div className="rounded-xl bg-muted p-4">
              <p className="text-xs text-muted-foreground">Progresso médio</p>
              <p className="mt-1 text-2xl font-semibold">{currentPeriodStats.averageProgress}%</p>
            </div>
            <div className="rounded-xl bg-muted p-4">
              <p className="text-xs text-muted-foreground">Aguardando docs</p>
              <p className="mt-1 text-2xl font-semibold text-amber-600">{currentPeriodStats.waiting}</p>
            </div>
            <div className="rounded-xl bg-muted p-4">
              <p className="text-xs text-muted-foreground">Em revisão</p>
              <p className="mt-1 text-2xl font-semibold text-violet-600">{currentPeriodStats.review}</p>
            </div>
            <div className="rounded-xl bg-muted p-4">
              <p className="text-xs text-muted-foreground">Bloqueadas</p>
              <p className="mt-1 text-2xl font-semibold text-red-600">{currentPeriodStats.blocked}</p>
            </div>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-2">
              {currentPeriodRisks.length === 0 ? (
                <div className="rounded-xl border border-border p-4 text-center text-sm text-muted-foreground">
                  Nenhum gargalo operacional identificado para os filtros atuais.
                </div>
              ) : (
                currentPeriodRisks.map(({ period, client, blockedSteps, pendingSteps }) => (
                  <button
                    key={period.id}
                    type="button"
                    className="w-full rounded-xl border border-border p-3 text-left transition-colors hover:bg-accent/40"
                    onClick={() => navigate(`/clients/${period.companyId}`)}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{client?.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {blockedSteps.length ? `${blockedSteps.length} etapa(s) bloqueada(s)` : `${pendingSteps} etapa(s) pendente(s)`}
                        </p>
                      </div>
                      <Badge className={periodStatusStyles[period.status]}>
                        {periodStatusLabels[period.status] ?? period.status}
                      </Badge>
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <Progress value={period.progressPercent} className="h-2 flex-1" />
                      <span className="text-xs font-medium text-muted-foreground">{period.progressPercent}%</span>
                    </div>
                  </button>
                ))
              )}
            </div>
            <div className="rounded-xl border border-border p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Sem competência criada</p>
                  <p className="text-xs text-muted-foreground">Clientes ativos fora do ciclo atual.</p>
                </div>
                <Badge variant="outline">{missingCurrentPeriods.length}</Badge>
              </div>
              <div className="mt-3 space-y-2">
                {missingCurrentPeriods.slice(0, 5).map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    className="flex w-full items-center justify-between rounded-lg bg-muted px-3 py-2 text-left text-sm hover:bg-accent"
                    onClick={() => navigate("/periods")}
                  >
                    <span className="truncate">{client.name}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
                {missingCurrentPeriods.length === 0 && (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    Todos os clientes filtrados estão dentro do ciclo.
                  </p>
                )}
              </div>
            </div>
          </div>
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
