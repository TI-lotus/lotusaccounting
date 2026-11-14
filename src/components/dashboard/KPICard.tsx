import { cn } from "@/lib/utils";
import { useId } from "react";
import {
  LucideIcon,
} from "lucide-react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  YAxis,
} from "recharts";

const placeholderTrend = [0, 0, 0, 0, 0, 0];

interface KPITrendProps {
  values?: number[];
  tone?: "positive" | "negative" | "neutral";
  className?: string;
}

/** Mini evolução compartilhada por todos os cards de KPI. */
export const KPITrend = ({
  values,
  tone = "neutral",
  className,
}: KPITrendProps) => {
  const hasRealData = Boolean(values?.length);
  const chartId = useId().replace(/:/g, "");
  const chartData = (hasRealData ? values : placeholderTrend).map(
    (value, index) => ({
      index,
      value,
    }),
  );
  const firstValue = chartData[0]?.value ?? 0;
  const lastValue = chartData[chartData.length - 1]?.value ?? 0;
  const isZero = chartData.every((point) => point.value === 0);
  const inferredTone =
    lastValue > firstValue
      ? "positive"
      : lastValue < firstValue
        ? "negative"
        : "neutral";
  const direction = isZero ? "neutral" : tone === "neutral" ? inferredTone : tone;
  const stroke =
    direction === "positive"
      ? "hsl(142 71% 42%)"
      : direction === "negative"
        ? "hsl(0 72% 55%)"
        : "hsl(var(--foreground))";

  return (
    <div
      className={cn("h-11 w-[42%] min-w-[96px]", className)}
      aria-label={hasRealData ? "Gráfico de tendência do indicador" : "Gráfico sem histórico"}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 3, right: 1, bottom: 2, left: 1 }}>
          <defs>
            <linearGradient id={`kpi-trend-fill-${chartId}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={hasRealData && !isZero ? 0.28 : 0.12} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <YAxis domain={["auto", "auto"]} hide />
          <Area
            type="monotone"
            dataKey="value"
            stroke={stroke}
            strokeWidth={2.2}
            strokeOpacity={hasRealData && !isZero ? 0.95 : 0.72}
            fill={`url(#kpi-trend-fill-${chartId})`}
            dot={false}
            activeDot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

interface KPICardProps {
  title: string;
  value: string;
  change?: number;
  changeLabel?: string;
  trend?: number[];
  icon: LucideIcon;
  className?: string;
  onClick?: () => void;
}

export const KPICard = ({
  title,
  value,
  change,
  changeLabel = "vs mês anterior",
  trend,
  icon: Icon,
  className,
  onClick,
}: KPICardProps) => {
  const isPositive = change && change > 0;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "group flex min-h-36 w-full flex-col justify-between rounded-2xl border border-border/70 bg-card p-5 text-left transition-[background-color,transform] duration-200 hover:bg-accent/45 animate-fade-in",
        onClick &&
          "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        !onClick && "cursor-default",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{title}</p>
          <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
          {changeLabel && <p className="mt-2 text-xs leading-5 text-muted-foreground">{changeLabel}</p>}
        </div>
        <span className="shrink-0 text-gilver transition-transform duration-200 group-hover:scale-110" title={title}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        {change !== undefined ? (
          <span className="text-xs font-medium text-muted-foreground">
            {isPositive ? "+" : ""}{change}%
          </span>
        ) : <span />}
        <KPITrend
          values={trend}
          tone={change !== undefined && change < 0 ? "negative" : isPositive ? "positive" : "neutral"}
          className="w-full max-w-[180px]"
        />
      </div>
    </button>
  );
};

interface BentoMetricProps {
  title: string;
  value: string;
  description?: string;
  trend?: number[];
  icon: LucideIcon;
  featured?: boolean;
  className?: string;
  onClick?: () => void;
}

/** Bloco de métrica para composições bento, evitando uma grade de cards repetidos. */
export const BentoMetric = ({
  title,
  value,
  description,
  trend,
  icon: Icon,
  featured = false,
  className,
  onClick,
}: BentoMetricProps) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "group flex min-h-36 w-full flex-col justify-between bg-card p-5 text-left transition-[background-color,transform] duration-200 hover:bg-accent/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
      featured && "min-h-52 p-6",
      className,
    )}
  >
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="truncate text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{title}</p>
        <p className={cn("mt-3 font-semibold tracking-tight text-foreground", featured ? "text-4xl" : "text-2xl")}>{value}</p>
        {description && <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{description}</p>}
      </div>
      <span className="shrink-0 text-gilver transition-transform duration-200 group-hover:scale-110" title={title}>
        <Icon className={cn(featured ? "h-6 w-6" : "h-5 w-5")} aria-hidden="true" />
      </span>
    </div>
    <KPITrend values={trend} className={cn("mt-4 w-full", featured ? "h-16" : "h-10")} />
  </button>
);
