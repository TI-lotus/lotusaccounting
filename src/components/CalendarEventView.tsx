import { useState } from "react";
import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";

export interface CalendarEventItem {
  day: number;
  title: string;
  time?: string;
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
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const sanitizedEvents = events.filter((event) => ((event.day - 1) % 7) !== 6);
  const selectedEvents = selectedDay ? sanitizedEvents.filter((event) => event.day === selectedDay) : [];

  return (
    <div className="glass rounded-2xl p-6 animate-fade-in">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">{title}</h3>
        <CalendarRangeControls dateRange={dateRange} onDateRangeChange={onDateRangeChange} />
      </div>
      <div className="grid grid-cols-7 gap-2 text-center text-sm">
        {weekDays.map((day) => <div key={day} className="py-2 font-medium text-muted-foreground">{day}</div>)}
        {Array.from({ length: 35 }, (_, index) => {
          const day = index + 1;
          const isSunday = index % 7 === 6;
          const dayEvents = isSunday ? [] : sanitizedEvents.filter((event) => event.day === day);
          return (
            <button
              type="button"
              key={day}
              disabled={!dayEvents.length}
              onClick={() => dayEvents.length && setSelectedDay(day)}
              className={cn(
                "aspect-square min-h-0 rounded-xl border border-border p-2 text-left transition-colors",
                isSunday && "bg-muted/30 text-muted-foreground/60",
                dayEvents.length && "bg-accent/30 ring-1 ring-primary hover:bg-accent/50",
              )}
            >
              <span className="text-xs font-medium">{day <= 31 ? day : ""}</span>
              {dayEvents.slice(0, 1).map((event) => (
                <p key={event.title} className="mt-2 truncate text-xs text-muted-foreground">{event.title}</p>
              ))}
            </button>
          );
        })}
      </div>
      <Dialog open={!!selectedDay} onOpenChange={(open) => !open && setSelectedDay(null)}>
        <DialogContent className="sm:max-w-[420px] rounded-2xl">
          <DialogHeader>
            <DialogTitle>Dia {selectedDay}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2 text-sm">
            {selectedEvents.map((event) => (
              <div key={`${event.title}-${event.time}`} className="rounded-xl border border-border p-3">
                <p className="font-medium">{event.title}</p>
                {event.time && <p className="text-xs text-muted-foreground">{event.time}</p>}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};