import { useState, useMemo } from "react";
import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";

export interface CalendarEventItem {
  day: number;
  title: string;
  time?: string;
  subtitle?: string;
  amount?: string;
  status?: string;
}

interface CalendarEventViewProps {
  title: string;
  events: CalendarEventItem[];
  dateRange: { start: string; end: string };
  onDateRangeChange: (range: { start: string; end: string }) => void;
}

const weekDays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export const CalendarRangeControls = ({ dateRange, onDateRangeChange }: Pick<CalendarEventViewProps, "dateRange" | "onDateRangeChange">) => {
  const [range, setRange] = useState<DateRange | undefined>({ from: new Date(dateRange.start), to: new Date(dateRange.end) });

  const label = range?.from
    ? `${format(range.from, "dd/MM", { locale: ptBR })} até ${format(range.to ?? range.from, "dd/MM", { locale: ptBR })}`
    : "Selecionar período";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="rounded-2xl gap-2">
          <CalendarClock className="h-4 w-4" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 rounded-2xl" align="end">
        <Calendar mode="range" selected={range} onSelect={(next) => {
          setRange(next);
          if (next?.from) onDateRangeChange({ start: format(next.from, "yyyy-MM-dd"), end: format(next.to ?? next.from, "yyyy-MM-dd") });
        }} numberOfMonths={2} defaultMonth={range?.from} />
      </PopoverContent>
    </Popover>
  );
};

export const CalendarEventView = ({ title, events, dateRange, onDateRangeChange }: CalendarEventViewProps) => {
  const sanitizedEvents = useMemo(
    () => events.filter((event) => ((event.day - 1) % 7) !== 6),
    [events],
  );
  const firstDayWithEvents = sanitizedEvents[0]?.day ?? 1;
  const [selectedDay, setSelectedDay] = useState<number>(firstDayWithEvents);
  const selectedEvents = sanitizedEvents.filter((event) => event.day === selectedDay);

  return (
    <div className="glass rounded-2xl p-6 animate-fade-in">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">{title}</h3>
        <CalendarRangeControls dateRange={dateRange} onDateRangeChange={onDateRangeChange} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,480px)_minmax(0,1fr)]">
        {/* Calendar grid - compact squares */}
        <div className="grid grid-cols-7 gap-1.5 text-center text-xs">
          {weekDays.map((day) => <div key={day} className="py-1.5 font-medium text-muted-foreground">{day}</div>)}
          {Array.from({ length: 35 }, (_, index) => {
            const day = index + 1;
            const isSunday = index % 7 === 6;
            const dayEvents = isSunday ? [] : sanitizedEvents.filter((event) => event.day === day);
            const isSelected = day === selectedDay;
            return (
              <button
                type="button"
                key={day}
                onClick={() => setSelectedDay(day)}
                className={cn(
                  "aspect-square min-h-0 rounded-md border border-border p-1 flex flex-col items-start justify-start transition-colors",
                  isSunday && "bg-muted/30 text-muted-foreground/60",
                  dayEvents.length && !isSelected && "bg-accent/30 ring-1 ring-primary/40 hover:bg-accent/50",
                  isSelected && "bg-primary/10 ring-2 ring-primary",
                )}
              >
                <span className="text-[11px] font-semibold leading-none">{day <= 31 ? day : ""}</span>
                {dayEvents.length > 0 && (
                  <span className="mt-auto self-center h-1.5 w-1.5 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>

        {/* Side panel with selected day's events */}
        <aside className="rounded-xl border border-border p-4">
          <div className="mb-3 flex items-baseline justify-between">
            <h4 className="text-base font-semibold">Dia {selectedDay}</h4>
            <span className="text-xs text-muted-foreground">{selectedEvents.length} {selectedEvents.length === 1 ? "evento" : "eventos"}</span>
          </div>
          <div className="space-y-2 text-sm">
            {selectedEvents.length === 0 && (
              <p className="text-xs text-muted-foreground">Sem eventos para este dia.</p>
            )}
            {selectedEvents.map((event) => (
              <div key={`${event.title}-${event.time}`} className="rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{event.title}</p>
                    {event.subtitle && <p className="text-xs text-muted-foreground">{event.subtitle}</p>}
                    {event.time && <p className="text-xs text-muted-foreground">{event.time}</p>}
                  </div>
                  <div className="text-right text-xs shrink-0">
                    {event.amount && <p className="font-semibold">{event.amount}</p>}
                    {event.status && <p className="text-muted-foreground">{event.status}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
};
