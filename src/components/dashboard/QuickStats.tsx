import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { cn } from "@/lib/utils";

const expenseData = [
  { name: "Payroll", value: 45, color: "hsl(28, 38%, 84%)" },
  { name: "Operations", value: 25, color: "hsl(28, 30%, 70%)" },
  { name: "Marketing", value: 15, color: "hsl(28, 25%, 55%)" },
  { name: "Other", value: 15, color: "hsl(0, 0%, 40%)" },
];

interface QuickStatsProps {
  className?: string;
}

export const QuickStats = ({ className }: QuickStatsProps) => {
  return (
    <div className={cn("glass rounded-2xl p-6 animate-fade-in", className)}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold">Expense Breakdown</h3>
        <p className="text-sm text-muted-foreground">Current month distribution</p>
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
              formatter={(value: number) => [`${value}%`, ""]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <p className="text-2xl font-bold">$48K</p>
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
            <span className="text-xs font-medium ml-auto">{item.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};
