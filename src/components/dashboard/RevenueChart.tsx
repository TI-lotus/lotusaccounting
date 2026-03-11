import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
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

interface RevenueChartProps {
  className?: string;
}

const formatBRL = (value: number) => {
  return `R$ ${(value / 1000).toLocaleString("pt-BR")}k`;
};

export const RevenueChart = ({ className }: RevenueChartProps) => {
  return (
    <div className={cn("glass rounded-2xl p-6 animate-fade-in", className)}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold">Visão Geral de Receita</h3>
          <p className="text-sm text-muted-foreground">Receita mensal vs despesas</p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-primary" />
            <span className="text-muted-foreground">Receita</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-chart-3" />
            <span className="text-muted-foreground">Despesas</span>
          </div>
        </div>
      </div>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(28, 38%, 84%)" stopOpacity={0.4} />
                <stop offset="95%" stopColor="hsl(28, 38%, 84%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(28, 30%, 55%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(28, 30%, 55%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
              tickFormatter={formatBRL}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "12px",
                boxShadow: "0 4px 20px -4px hsl(var(--shadow-color) / 0.1)",
              }}
              formatter={(value: number) => [`R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, ""]}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="hsl(28, 38%, 70%)"
              strokeWidth={2}
              fill="url(#revenueGradient)"
              name="Receita"
            />
            <Area
              type="monotone"
              dataKey="expenses"
              stroke="hsl(28, 25%, 55%)"
              strokeWidth={2}
              fill="url(#expenseGradient)"
              name="Despesas"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
