import { useState } from "react";
import { CalendarClock, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

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
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ ...dateRange, time: "09:00" });

  const applyRange = () => {
    onDateRangeChange({ start: draft.start, end: draft.end });
    setOpen(false);
  };

  return (
    <>
      <Button variant="outline" className="rounded-2xl gap-2" onClick={() => setOpen(true)}>
        <CalendarClock className="h-4 w-4" />
        {dateRange.start} até {dateRange.end}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl">
          <DialogHeader>
            <DialogTitle>Selecionar período</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="calendar-start">De</Label>
              <Input id="calendar-start" type="date" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} className="rounded-xl" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="calendar-end">Até</Label>
              <Input id="calendar-end" type="date" value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} className="rounded-xl" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="calendar-time">Horário</Label>
              <Input id="calendar-time" type="time" value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} className="rounded-xl" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button className="rounded-xl" onClick={applyRange}>Aplicar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export const CalendarEventView = ({ title, events, dateRange, onDateRangeChange }: CalendarEventViewProps) => {
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventItem | null>(null);
  const sanitizedEvents = events.filter((event) => ((event.day - 1) % 7) !== 6);

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
              onClick={() => dayEvents[0] && setSelectedEvent(dayEvents[0])}
              className={cn(
                "min-h-20 rounded-xl border border-border p-2 text-left transition-colors",
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
      <Dialog open={!!selectedEvent} onOpenChange={(open) => !open && setSelectedEvent(null)}>
        <DialogContent className="sm:max-w-[420px] rounded-2xl">
          <DialogHeader>
            <DialogTitle>{selectedEvent?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm">
            <p className="text-muted-foreground">Dia {selectedEvent?.day}</p>
            <div className="grid gap-2">
              <Label htmlFor="event-time">Horário</Label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="event-time" type="time" defaultValue={selectedEvent?.time ?? "09:00"} className="rounded-xl pl-10" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button className="rounded-xl" onClick={() => setSelectedEvent(null)}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};