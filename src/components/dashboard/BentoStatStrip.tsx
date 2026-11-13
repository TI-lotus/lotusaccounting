import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BentoStat {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
}

interface BentoStatStripProps {
  items: BentoStat[];
  className?: string;
}

/** Faixa de dados compacta para substituir grades repetitivas de KPIs. */
export const BentoStatStrip = ({ items, className }: BentoStatStripProps) => (
  <dl
    className={cn(
      "grid overflow-hidden rounded-2xl border border-border/70 bg-border/70 sm:grid-cols-2 xl:grid-cols-4",
      className,
    )}
  >
    {items.map((item) => {
      const Icon = item.icon;
      return (
        <div key={item.label} className="min-h-28 min-w-0 bg-card p-4 sm:p-5">
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
          <dd className="mt-2 text-xl font-semibold tracking-tight text-foreground">
            {item.value}
          </dd>
          {item.hint && (
            <dd className="mt-1 text-xs leading-5 text-muted-foreground">
              {item.hint}
            </dd>
          )}
        </div>
      );
    })}
  </dl>
);
