import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { KPITrend } from "@/components/dashboard/KPICard";
import { getBentoGridClass } from "@/components/dashboard/bentoGrid";

export interface BentoStat {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  trend?: number[];
  compact?: boolean;
}

interface BentoStatStripProps {
  items: BentoStat[];
  className?: string;
}

/** Faixa de dados compacta para substituir grades repetitivas de KPIs. */
export const BentoStatStrip = ({ items, className }: BentoStatStripProps) => (
  <dl
    className={cn(
      "grid overflow-hidden rounded-2xl border border-border/70 bg-border/70 sm:grid-cols-2 xl:grid-cols-3",
      className,
      getBentoGridClass(items.length),
    )}
  >
    {items.map((item) => {
      const Icon = item.icon;
      const showTrend = !item.compact && (Boolean(item.trend?.length) || typeof item.value === "number");
      return (
        <div key={item.label} className={cn("min-w-0 bg-card p-4 sm:p-5", item.compact ? "min-h-20" : "min-h-28")}>
          <div className="flex items-start justify-between gap-3">
            <dt className="truncate text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {item.label}
            </dt>
            {Icon && (
              <span className="shrink-0 text-gilver" title={item.label}>
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
            )}
          </div>
          <div className="mt-2 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <dd className={cn("font-semibold tracking-tight text-foreground", item.compact ? "text-lg" : "text-xl")}>
                {item.value}
              </dd>
              {item.hint && (
                <dd className="mt-1 text-xs leading-5 text-muted-foreground">
                  {item.hint}
                </dd>
              )}
            </div>
            {showTrend && <KPITrend values={item.trend} className="h-9 w-24 shrink-0" />}
          </div>
        </div>
      );
    })}
  </dl>
);
