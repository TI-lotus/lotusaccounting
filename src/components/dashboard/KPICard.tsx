import { cn } from "@/lib/utils";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string;
  change?: number;
  changeLabel?: string;
  icon: LucideIcon;
  className?: string;
}

export const KPICard = ({
  title,
  value,
  change,
  changeLabel = "vs last month",
  icon: Icon,
  className,
}: KPICardProps) => {
  const isPositive = change && change > 0;
  const isNegative = change && change < 0;

  return (
    <div className={cn("kpi-card animate-fade-in", className)}>
      <div className="flex items-start justify-between mb-4">
        <div className="p-2.5 rounded-xl bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        {change !== undefined && (
          <div
            className={cn(
              "flex items-center gap-1 text-sm font-medium px-2 py-1 rounded-lg",
              isPositive && "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/50",
              isNegative && "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950/50",
              !isPositive && !isNegative && "text-muted-foreground bg-muted"
            )}
          >
            {isPositive && <TrendingUp className="h-3.5 w-3.5" />}
            {isNegative && <TrendingDown className="h-3.5 w-3.5" />}
            <span>{isPositive ? "+" : ""}{change}%</span>
          </div>
        )}
      </div>
      <p className="text-muted-foreground text-sm mb-1">{title}</p>
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
      {change !== undefined && (
        <p className="text-xs text-muted-foreground mt-2">{changeLabel}</p>
      )}
    </div>
  );
};
