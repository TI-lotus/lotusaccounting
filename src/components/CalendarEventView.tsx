import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CalendarClock, CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, isSameDay, isSameMonth, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { largeCalendarClassNames } from "@/components/calendarStyles";

export interface CalendarEventItem {
  day: number;
  date?: Date | string;
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
  headerActions?: ReactNode;
}

const parseCalendarDate = (value: Date | string): Date | null => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return null;
  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const dateFromRange = (value: string) => parseCalendarDate(value) ?? new Date();

const eventStatusIcon = (status?: string) => {
  if (!status) return null;
  const completed = /conclu|pago|receb|entreg|process/i.test(status);
  return completed
    ? <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
    : <Circle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />;
};

export const CalendarRangeControls = ({ dateRange, onDateRangeChange }: Pick<CalendarEventViewProps, "dateRange" | "onDateRangeChange">) => {
  const [range, setRange] = useState<DateRange | undefined>({
    from: dateFromRange(dateRange.start),
    to: dateFromRange(dateRange.end),
  });

  useEffect(() => {
    setRange({ from: dateFromRange(dateRange.start), to: dateFromRange(dateRange.end) });
  }, [dateRange.end, dateRange.start]);

  const label = range?.from
    ? `${format(range.from, "dd/MM", { locale: ptBR })} até ${format(range.to ?? range.from, "dd/MM", { locale: ptBR })}`
    : "Selecionar período";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2 rounded-2xl">
          <CalendarClock className="h-4 w-4" aria-hidden="true" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto rounded-2xl p-0" align="end">
        <Calendar
          mode="range"
          selected={range}
          onSelect={(next) => {
            setRange(next);
            if (next?.from) {
              onDateRangeChange({
                start: format(next.from, "yyyy-MM-dd"),
                end: format(next.to ?? next.from, "yyyy-MM-dd"),
              });
            }
          }}
          numberOfMonths={2}
          defaultMonth={range?.from}
          captionLayout="dropdown"
          fromYear={2000}
          toYear={2100}
        />
      </PopoverContent>
    </Popover>
  );
};

export const CalendarEventView = ({ title, events, dateRange, onDateRangeChange, headerActions }: CalendarEventViewProps) => {
  const rangeStart = useMemo(() => dateFromRange(dateRange.start), [dateRange.start]);
  const normalizedEvents = useMemo(
    () => events.map((event) => ({
      ...event,
      calendarDate: event.date
        ? parseCalendarDate(event.date) ?? new Date(rangeStart.getFullYear(), rangeStart.getMonth(), event.day)
        : new Date(rangeStart.getFullYear(), rangeStart.getMonth(), event.day),
    })),
    [events, rangeStart],
  );
  const firstEventDate = normalizedEvents[0]?.calendarDate ?? rangeStart;
  const [selectedDate, setSelectedDate] = useState<Date>(firstEventDate);
  const [visibleMonth, setVisibleMonth] = useState<Date>(startOfMonth(firstEventDate));

  useEffect(() => {
    const hasSelectedDate = normalizedEvents.some((event) => isSameDay(event.calendarDate, selectedDate));
    if (!hasSelectedDate && normalizedEvents.length > 0) {
      const nextDate = normalizedEvents[0].calendarDate;
      setSelectedDate(nextDate);
      setVisibleMonth(startOfMonth(nextDate));
    }
  }, [normalizedEvents, selectedDate]);

  const eventDates = useMemo(
    () => new Set(normalizedEvents.map((event) => format(event.calendarDate, "yyyy-MM-dd"))),
    [normalizedEvents],
  );
  const selectedEvents = useMemo(
    () => normalizedEvents.filter((event) => isSameDay(event.calendarDate, selectedDate)),
    [normalizedEvents, selectedDate],
  );

  return (
    <section className="page-section animate-fade-in space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-medium">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">Selecione um dia para consultar tarefas e eventos.</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {headerActions}
          <CalendarRangeControls dateRange={dateRange} onDateRangeChange={onDateRangeChange} />
        </div>
      </div>

      <div className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
        <div className="flex h-full min-h-[600px] flex-col rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
          <Calendar
            mode="single"
            month={visibleMonth}
            onMonthChange={setVisibleMonth}
            selected={selectedDate}
            onSelect={(next) => {
              if (!next) return;
              setSelectedDate(next);
              setVisibleMonth(startOfMonth(next));
            }}
            locale={ptBR}
            modifiers={{
              hasEvents: (date) => eventDates.has(format(date, "yyyy-MM-dd")),
            }}
            modifiersClassNames={{
              hasEvents: "border-gilver/70 bg-gilver/10 font-semibold",
            }}
            className="w-full max-w-none p-0"
            classNames={largeCalendarClassNames}
            captionLayout="dropdown"
            fromYear={2000}
            toYear={2100}
          />
          <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/70 pt-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-gilver" />Com eventos</span>
            <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-primary" />Dia selecionado</span>
            <span className="ml-auto">{isSameMonth(selectedDate, visibleMonth) ? format(visibleMonth, "MMMM yyyy", { locale: ptBR }) : "Outro período"}</span>
          </div>
        </div>

        <aside className="flex h-full min-h-[600px] flex-col rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3 border-b border-border/70 pb-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Agenda do dia</p>
              <h3 className="mt-1 text-lg font-medium capitalize">{format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}</h3>
            </div>
            <span className="rounded-full bg-secondary px-2.5 py-1 text-xs tabular-nums text-muted-foreground">
              {selectedEvents.length} {selectedEvents.length === 1 ? "item" : "itens"}
            </span>
          </div>
          <div className="custom-scroll mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {selectedEvents.length === 0 ? (
              <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-border/70 px-4 text-center">
                <CalendarClock className="mb-3 h-8 w-8 text-muted-foreground/60" aria-hidden="true" />
                <p className="text-sm font-medium">Nenhum item neste dia</p>
                <p className="mt-1 text-xs text-muted-foreground">Escolha outra data no calendário.</p>
              </div>
            ) : (
              selectedEvents.map((event, index) => (
                <div key={`${event.title}-${event.time ?? ""}-${index}`} className="rounded-xl border border-border/70 bg-background/70 p-3 transition-colors hover:border-gilver/50 hover:bg-accent/30">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0">{eventStatusIcon(event.status)}</div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{event.title}</p>
                      {event.subtitle && <p className="mt-1 truncate text-xs text-muted-foreground">{event.subtitle}</p>}
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                        {event.time && <span>{event.time}</span>}
                        {event.status && <span>{event.status}</span>}
                      </div>
                    </div>
                    {event.amount && <span className="shrink-0 text-right text-xs font-medium tabular-nums">{event.amount}</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>
    </section>
  );
};
