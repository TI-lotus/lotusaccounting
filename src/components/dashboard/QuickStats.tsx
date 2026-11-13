import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { cn } from "@/lib/utils";
import { useData } from "@/contexts/DataContext";
import { expenseDistribution, type DateRange } from "@/lib/financialMetrics";
import type { Database } from "@/integrations/supabase/types";

type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];

const colors = ["#d2b58a", "#849c8a", "#888888", "#b77575", "#8195a6"];

interface QuickStatsProps {
  className?: string;
  dateRange?: DateRange;
  payments?: PaymentRow[];
}

export const QuickStats = ({ className, dateRange, payments: providedPayments }: QuickStatsProps) => {
  const { payments: contextPayments } = useData();
  const payments = providedPayments ?? contextPayments;
  const expenseData = expenseDistribution(payments, dateRange).map((item, index) => ({ ...item, color: colors[index % colors.length] }));
  const total = expenseData.reduce((sum, item) => sum + item.value, 0);
  return (
    <div className={cn("glass rounded-2xl p-6 animate-fade-in", className)}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold">Distribuição de Despesas</h3>
        <p className="text-sm text-muted-foreground">Despesas liquidadas</p>
      </div>
      <div className="h-[200px] relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={expenseData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={4}
              dataKey="value"
            >
              {expenseData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
              }}
              formatter={(value: number) => [value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), ""]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <p className="text-lg font-bold">{total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mt-4">
        {expenseData.map((item) => (
          <div key={item.name} className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-xs text-muted-foreground truncate">{item.name}</span>
            <span className="text-xs font-medium ml-auto">{total ? Math.round(item.value / total * 100) : 0}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};
