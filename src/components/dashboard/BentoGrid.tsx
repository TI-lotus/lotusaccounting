import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { getBentoGridClass } from "@/components/dashboard/bentoGrid";

interface BentoGridProps {
  count: number;
  children: ReactNode;
  className?: string;
}

/**
 * Grid bento que se adapta à quantidade real de itens.
 * Quatro itens ficam em uma composição 2x2, evitando uma célula vazia
 * ou um último bloco isolado na linha seguinte.
 */
export const BentoGrid = ({ count, children, className }: BentoGridProps) => (
  <div
    className={cn(
      "grid gap-px overflow-hidden rounded-2xl border border-border/70 bg-border/70",
      getBentoGridClass(count),
      className,
    )}
  >
    {children}
  </div>
);
