import { ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface FilterPopoverProps {
  children: ReactNode;
  activeCount?: number;
  onClear?: () => void;
  title?: string;
  description?: string;
  className?: string;
  contentClassName?: string;
}

export const FilterPopover = ({
  children,
  activeCount = 0,
  onClear,
  title = "Filtrar resultados",
  description,
  className,
  contentClassName,
}: FilterPopoverProps) => (
  <Popover>
    <Tooltip>
      <TooltipTrigger asChild>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={cn("relative h-9 w-9 rounded-full", className)}
            aria-label="Abrir filtros"
            title="Filtros"
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            {activeCount > 0 && (
              <span className="absolute -right-1 -top-1 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-[9px] font-semibold leading-none text-background">
                {activeCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={8} className="judex-floating sidebar-tooltip">Filtros</TooltipContent>
    </Tooltip>
    <PopoverContent
      align="end"
      className={cn("w-[min(380px,calc(100vw-2rem))] rounded-2xl p-4", contentClassName)}
    >
      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium text-foreground">{title}</p>
          {description && <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>}
        </div>
        <div className="space-y-3">{children}</div>
        {onClear && (
          <div className="flex justify-end border-t border-border/60 pt-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 rounded-lg text-xs"
              onClick={onClear}
              disabled={activeCount === 0}
            >
              Limpar filtros
            </Button>
          </div>
        )}
      </div>
    </PopoverContent>
  </Popover>
);
