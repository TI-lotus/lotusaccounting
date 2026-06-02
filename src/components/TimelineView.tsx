import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CalendarEventItem } from "./CalendarEventView";

interface TimelineViewProps {
  title: string;
  events: CalendarEventItem[];
}

type TimelineMode = "day" | "week" | "month";

const weekDayLabels = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const HOURS = Array.from({ length: 13 }, (_, i) => i + 7); // 07h to 19h

const parseHour = (time?: string): number => {
  if (!time) return 9;
  const m = time.match(/(\d{1,2})/);
  return m ? Math.min(19, Math.max(7, parseInt(m[1], 10))) : 9;
};

export const TimelineView = ({ title, events }: TimelineViewProps) => {
  const [mode, setMode] = useState<TimelineMode>("week");
  const [selectedDay, setSelectedDay] = useState<number>(events[0]?.day ?? 1);

  const byDay = useMemo(() => {
    const map = new Map<number, CalendarEventItem[]>();
    for (const e of events) {
      const arr = map.get(e.day) ?? [];
      arr.push(e);
      map.set(e.day, arr);
    }
    return map;
  }, [events]);

  const renderDayColumn = (day: number) => {
    const items = byDay.get(day) ?? [];
    return (
      <div className="relative flex-1 min-w-0 border-l border-border first:border-l-0">
        <div className="sticky top-0 z-10 bg-card px-2 py-1.5 text-xs font-medium text-center border-b border-border">
          Dia {day}
        </div>
        <div className="relative" style={{ height: `${HOURS.length * 48}px` }}>
          {HOURS.map((_, i) => (
            <div key={i} className="absolute left-0 right-0 border-t border-dashed border-border/50" style={{ top: `${i * 48}px` }} />
          ))}
          {items.map((event, idx) => {
            const hour = parseHour(event.time);
            const top = (hour - 7) * 48;
            return (
              <div
                key={`${event.title}-${idx}`}
                className="absolute left-1 right-1 rounded-md border-l-4 bg-[hsl(var(--gilver)/0.12)] border-[hsl(var(--gilver))] p-1.5 text-[11px] overflow-hidden"
                style={{ top: `${top + 2}px`, height: "44px" }}
                title={event.title}
              >
                <p className="font-medium truncate">{event.title}</p>
                <p className="text-muted-foreground truncate">{event.time ?? `${hour}:00`}{event.amount ? ` · ${event.amount}` : ""}</p>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="glass rounded-2xl p-6 animate-fade-in">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">{title}</h3>
        <div className="flex rounded-xl border border-border bg-card p-1">
          {(["day", "week", "month"] as TimelineMode[]).map((m) => (
            <Button
              key={m}
              variant={mode === m ? "default" : "ghost"}
              size="sm"
              className="rounded-lg"
              onClick={() => setMode(m)}
            >
              {m === "day" ? "Dia" : m === "week" ? "Semana" : "Mês"}
            </Button>
          ))}
        </div>
      </div>

      {/* Day selector for "day" mode */}
      {mode === "day" && (
        <div className="mb-3 flex gap-1 overflow-x-auto custom-scroll pb-1">
          {Array.from({ length: 30 }, (_, i) => i + 1).map((d) => (
            <button
              key={d}
              onClick={() => setSelectedDay(d)}
              className={cn(
                "shrink-0 h-9 w-9 rounded-md text-xs font-medium border",
                selectedDay === d ? "bg-[hsl(var(--gilver))] text-primary-foreground border-[hsl(var(--gilver))]" : "border-border hover:bg-accent/40",
              )}
            >
              {d}
            </button>
          ))}
        </div>
      )}

      <div className="flex">
        {/* Hours column */}
        <div className="w-14 shrink-0 pt-[34px]">
          {HOURS.map((h) => (
            <div key={h} className="h-12 text-[11px] text-muted-foreground pr-2 text-right">{h}:00</div>
          ))}
        </div>

        {/* Columns */}
        {mode === "day" && (
          <div className="flex flex-1 min-w-0">
            {renderDayColumn(selectedDay)}
          </div>
        )}

        {mode === "week" && (
          <div className="flex flex-1 min-w-0">
            {Array.from({ length: 7 }, (_, i) => ({ d: i + 1, label: weekDayLabels[i] })).map(({ d, label }) => (
              <div key={d} className="flex-1 min-w-0">
                <div className="px-2 py-1 text-[10px] uppercase text-center text-muted-foreground">{label}</div>
                {renderDayColumn(d)}
              </div>
            ))}
          </div>
        )}

        {mode === "month" && (
          <div className="flex-1 min-w-0 overflow-x-auto custom-scroll">
            <div className="flex" style={{ minWidth: `${30 * 120}px` }}>
              {Array.from({ length: 30 }, (_, i) => i + 1).map((d) => (
                <div key={d} className="w-[120px] shrink-0">
                  {renderDayColumn(d)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
