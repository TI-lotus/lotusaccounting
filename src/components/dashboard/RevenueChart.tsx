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
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const data = [
  { month: "Jan", revenue: 42000, expenses: 28000 },
  { month: "Fev", revenue: 38000, expenses: 25000 },
  { month: "Mar", revenue: 55000, expenses: 32000 },
  { month: "Abr", revenue: 48000, expenses: 30000 },
  { month: "Mai", revenue: 62000, expenses: 35000 },
  { month: "Jun", revenue: 58000, expenses: 33000 },
  { month: "Jul", revenue: 72000, expenses: 38000 },
  { month: "Ago", revenue: 68000, expenses: 36000 },
  { month: "Set", revenue: 78000, expenses: 40000 },
  { month: "Out", revenue: 85000, expenses: 42000 },
  { month: "Nov", revenue: 92000, expenses: 45000 },
  { month: "Dez", revenue: 98000, expenses: 48000 },
];

type Mode = "revenue" | "expenses" | "profit";

interface RevenueChartProps {
  className?: string;
}

const formatBRL = (value: number) => `R$ ${(value / 1000).toLocaleString("pt-BR")}k`;
const GREEN = "hsl(142, 70%, 45%)";
const RED = "hsl(0, 72%, 51%)";
const YELLOW = "hsl(45, 90%, 55%)";

export const RevenueChart = ({ className }: RevenueChartProps) => {
  const [mode, setMode] = useState<Mode>("revenue");

  const chartData = useMemo(() => {
    return data.map((d) => ({
      month: d.month,
      value: mode === "revenue" ? d.revenue : mode === "expenses" ? d.expenses : d.revenue - d.expenses,
    }));
  }, [mode]);

  const average = useMemo(() => {
    const sum = chartData.reduce((s, d) => s + d.value, 0);
    return Math.round(sum / chartData.length);
  }, [chartData]);

  const currentValue = chartData[chartData.length - 1].value;

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
        <div className="flex rounded-xl border border-border bg-card p-1">
          {(Object.keys(modeLabels) as Mode[]).map((m) => (
            <Button
              key={m}
              variant={mode === m ? "default" : "ghost"}
              size="sm"
              className="rounded-lg"
              onClick={() => setMode(m)}
            >
              {modeLabels[m]}
            </Button>
          ))}
        </div>
      </div>
      <div className="h-[300px]">
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
        </ResponsiveContainer>
      </div>
    </div>
  );
};
