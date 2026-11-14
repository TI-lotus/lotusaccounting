import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const FIRST_YEAR = 2010;
const LAST_YEAR = new Date().getFullYear() + 5;
const monthOptions = Array.from({ length: 12 }, (_, month) => ({
  value: month,
  label: format(new Date(2020, month, 1), "MMMM", { locale: ptBR }),
}));
const yearOptions = Array.from({ length: LAST_YEAR - FIRST_YEAR + 1 }, (_, index) => FIRST_YEAR + index);

interface CalendarMonthSelectorProps {
  value: Date;
  onChange: (value: Date) => void;
}

export const CalendarMonthSelector = ({ value, onChange }: CalendarMonthSelectorProps) => {
  const [open, setOpen] = useState(false);

  const changeMonth = (month: number) => {
    onChange(new Date(value.getFullYear(), month, 1));
  };

  const changeYear = (year: number) => {
    onChange(new Date(year, value.getMonth(), 1));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="h-10 gap-2 rounded-xl px-3 text-base font-medium capitalize hover:bg-accent"
          aria-label="Alterar mês e ano"
        >
          <span>{format(value, "MMMM yyyy", { locale: ptBR })}</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[300px] rounded-2xl border-border/70 bg-popover/95 p-3 shadow-xl backdrop-blur-xl">
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-border/70 pb-3">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Selecionar período</p>
            <span className="text-sm font-medium tabular-nums">{value.getFullYear()}</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {monthOptions.map((month) => (
              <button
                key={month.value}
                type="button"
                className={cn(
                  "rounded-xl px-2 py-2 text-left text-xs capitalize transition-colors hover:bg-accent",
                  value.getMonth() === month.value && "bg-primary text-primary-foreground hover:bg-primary",
                )}
                onClick={() => changeMonth(month.value)}
              >
                {month.label}
              </button>
            ))}
          </div>
          <div className="border-t border-border/70 pt-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Ano</p>
            <div className="custom-scroll grid max-h-36 grid-cols-4 gap-1.5 overflow-y-auto pr-1">
              {yearOptions.map((year) => (
                <button
                  key={year}
                  type="button"
                  className={cn(
                    "rounded-xl px-2 py-2 text-center text-xs tabular-nums transition-colors hover:bg-accent",
                    value.getFullYear() === year && "bg-primary text-primary-foreground hover:bg-primary",
                  )}
                  onClick={() => changeYear(year)}
                >
                  {year}
                </button>
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
