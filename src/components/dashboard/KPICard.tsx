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
        "kpi-card animate-fade-in w-full text-left",
        onClick &&
          "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        !onClick && "cursor-default",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary">
          <Icon className="h-5 w-5 text-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm text-muted-foreground">{title}</p>
            {change !== undefined && (
              <span className="shrink-0 text-xs font-medium text-muted-foreground">
                {isPositive ? "+" : ""}{change}%
              </span>
            )}
          </div>
          <p className="text-2xl font-semibold tracking-tight text-foreground">{value}</p>
          {changeLabel && (
            <p className="text-xs text-muted-foreground mt-2">{changeLabel}</p>
          )}
        </div>
        <KPITrend
          values={trend}
          tone={change !== undefined && change < 0 ? "negative" : isPositive ? "positive" : "neutral"}
        />
      </div>
    </button>
  );
};
