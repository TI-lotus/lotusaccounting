import { useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { ArrowDown, ArrowUp, DollarSign } from "lucide-react";
import { IconTooltipButton } from "@/components/IconTooltipButton";
import { cn } from "@/lib/utils";
import { useData } from "@/contexts/DataContext";
import { monthlyCashflow, type DateRange } from "@/lib/financialMetrics";
import type { Database } from "@/integrations/supabase/types";

type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];

type Mode = "revenue" | "expenses" | "profit";

const modeIcons = {
  revenue: ArrowUp,
  expenses: ArrowDown,
  profit: DollarSign,
} satisfies Record<Mode, typeof ArrowUp>;

interface RevenueChartProps {
  className?: string;
  dateRange?: DateRange;
  payments?: PaymentRow[];
}

const formatBRL = (value: number) => `R$ ${(value / 1000).toLocaleString("pt-BR")}k`;
const GREEN = "hsl(142, 70%, 45%)";
const RED = "hsl(0, 72%, 51%)";
const YELLOW = "hsl(30, 41%, 60%)"; // brand gold #d2b58a

export const RevenueChart = ({ className, dateRange, payments: providedPayments }: RevenueChartProps) => {
  const { payments: contextPayments } = useData();
  const payments = providedPayments ?? contextPayments;
  const [mode, setMode] = useState<Mode>("revenue");

  const chartData = useMemo(() => {
    return monthlyCashflow(payments, dateRange).map((d) => ({
      month: d.month,
      value: mode === "revenue" ? d.revenue : mode === "expenses" ? d.expenses : d.revenue - d.expenses,
    }));
  }, [mode, payments, dateRange]);

  const average = useMemo(() => {
    const sum = chartData.reduce((s, d) => s + d.value, 0);
    return chartData.length ? Math.round(sum / chartData.length) : 0;
  }, [chartData]);

  const currentValue = chartData.at(-1)?.value ?? 0;

  // Color logic
  let strokeColor = YELLOW;
  if (mode === "revenue") strokeColor = currentValue >= average ? GREEN : RED;
  else if (mode === "expenses") strokeColor = currentValue <= average ? GREEN : RED;

  const gradientId = `gradient-${mode}`;

  const modeLabels: Record<Mode, string> = {
    revenue: "Receita",
    expenses: "Despesas",
    profit: "Lucro",
  };

  return (
    <div className={cn("glass rounded-2xl p-6 animate-fade-in", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h3 className="text-lg font-semibold">Visão Geral de Receita</h3>
          <p className="text-sm text-muted-foreground">
            {modeLabels[mode]} mensal · média {formatBRL(average)}
          </p>
        </div>
        <div className="flex rounded-full border border-border/70 bg-card p-1">
          {(Object.keys(modeLabels) as Mode[]).map((m) => (
            <IconTooltipButton
              key={m}
              icon={modeIcons[m]}
              label={modeLabels[m]}
              variant={mode === m ? "default" : "ghost"}
              className="rounded-full"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
            />
          ))}
        </div>
      </div>
      <div className="h-[300px]">
        {chartData.length === 0 ? <p className="flex h-full items-center justify-center text-sm text-muted-foreground">Sem movimentações no período</p> :
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={strokeColor} stopOpacity={0.35} />
                <stop offset="95%" stopColor={strokeColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} tickFormatter={formatBRL} />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "12px",
              }}
              formatter={(value: number) => [`R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, modeLabels[mode]]}
            />
            <ReferenceLine
              y={average}
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="4 4"
              label={{ value: `Média ${formatBRL(average)}`, position: "insideTopRight", fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            />
            <Area type="monotone" dataKey="value" stroke={strokeColor} strokeWidth={2.5} fill={`url(#${gradientId})`} name={modeLabels[mode]} />
          </AreaChart>
        </ResponsiveContainer>}
      </div>
    </div>
  );
};
