import { useMemo, useState } from "react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import {
  Calendar as CalendarIcon,
  FileText,
  Receipt,
  CheckSquare,
  ScrollText,
  BarChart3,
  Filter,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { useData } from "@/contexts/DataContext";
import { cn } from "@/lib/utils";
import { format, isSameDay, startOfDay, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";

type AgendaKind = "task" | "payment" | "document" | "obligation" | "report";

interface AgendaItem {
  id: string;
  kind: AgendaKind;
  title: string;
  subtitle?: string;
  date: Date;
  meta?: string;
}

const kindConfig: Record<
  AgendaKind,
  { label: string; icon: typeof CalendarIcon; color: string; badge: string }
> = {
  task: {
    label: "Tarefa",
    icon: CheckSquare,
    color: "text-blue-600 dark:text-blue-400",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  },
  payment: {
    label: "Pagamento",
    icon: Receipt,
    color: "text-emerald-600 dark:text-emerald-400",
    badge:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  },
  document: {
    label: "Documento",
    icon: FileText,
    color: "text-purple-600 dark:text-purple-400",
    badge:
      "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  },
  obligation: {
    label: "Obrigação",
    icon: ScrollText,
    color: "text-amber-600 dark:text-amber-400",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  },
  report: {
    label: "Relatório",
    icon: BarChart3,
    color: "text-slate-600 dark:text-slate-400",
    badge: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
};

const filterOptions: { key: AgendaKind | "all"; label: string }[] = [
  { key: "all", label: "Tudo" },
  { key: "task", label: "Tarefas" },
  { key: "payment", label: "Pagamentos" },
  { key: "document", label: "Documentos" },
  { key: "obligation", label: "Obrigações" },
  { key: "report", label: "Relatórios" },
];

const Agenda = () => {
  const { tasks, documents, payments, invoices, clients, fiscalObligations } =
    useData();
  const [selectedDate, setSelectedDate] = useState<Date>(
    startOfDay(new Date()),
  );
  const [activeFilter, setActiveFilter] = useState<AgendaKind | "all">("all");

  const items = useMemo<AgendaItem[]>(() => {
    const clientNameById = new Map(
      clients.map((client) => [client.id, client.name]),
    );
    const taskItems: AgendaItem[] = tasks
      .filter((t) => !!t.dueDate)
      .map((t) => ({
        id: `task-${t.id}`,
        kind: "task",
        title: t.title,
        subtitle: t.clientName ?? "Sem cliente",
        date: new Date(t.dueDate),
        meta: t.category,
      }));
    const docItems: AgendaItem[] = documents
      .filter((d) => !!d.createdAt)
      .slice(0, 20)
      .map((d) => ({
        id: `doc-${d.id}`,
        kind: "document",
        title: d.name,
        subtitle: d.clientName ?? "Sem cliente",
        date: new Date(d.createdAt),
        meta: d.documentType,
      }));
    const paymentItems: AgendaItem[] = payments
      .filter((payment) => !!payment.due_date)
      .map((payment) => ({
        id: `payment-${payment.id}`,
        kind: "payment",
        title: payment.description ?? "Pagamento",
        subtitle: payment.company_id
          ? (clientNameById.get(payment.company_id) ?? "Cliente")
          : "Sem cliente",
        date: new Date(payment.due_date as string),
        meta:
          payment.direction === "expense"
            ? "A pagar"
            : payment.status === "paid"
              ? "Pago"
              : "A receber",
      }));
    const invoiceItems: AgendaItem[] = invoices
      .filter((invoice) => !!invoice.due_date)
      .map((invoice) => ({
        id: `invoice-${invoice.id}`,
        kind: "payment",
        title: `Fatura ${invoice.number ?? invoice.id.slice(0, 8)}`,
        subtitle: invoice.company_id
          ? (clientNameById.get(invoice.company_id) ?? "Cliente")
          : "Sem cliente",
        date: new Date(invoice.due_date as string),
        meta: invoice.status === "paid" ? "Recebida" : "A receber",
      }));
    const obligationItems: AgendaItem[] = fiscalObligations.map(
      (obligation) => ({
        id: `obligation-${obligation.id}`,
        kind: "obligation",
        title: obligation.name,
        subtitle: obligation.company_id
          ? (clientNameById.get(obligation.company_id) ?? "Cliente")
          : "Sem cliente",
        date: new Date(`${obligation.due_date}T00:00:00`),
        meta: obligation.status === "completed" ? "Entregue" : "Fiscal",
      }),
    );
    const reportItems: AgendaItem[] = [
      {
        id: "report-monthly-closing",
        kind: "report",
        title: "Fechamento mensal",
        subtitle: `${documents.length} documentos no período`,
        date: addDays(startOfDay(new Date()), 6),
        meta: "Recorrente",
      },
    ];

    return [
      ...taskItems,
      ...docItems,
      ...paymentItems,
      ...invoiceItems,
      ...obligationItems,
      ...reportItems,
    ];
  }, [clients, documents, fiscalObligations, invoices, payments, tasks]);

  const filtered = useMemo(
    () =>
      activeFilter === "all"
        ? items
        : items.filter((i) => i.kind === activeFilter),
    [items, activeFilter],
  );

  const daySet = useMemo(() => {
    const map = new Map<string, AgendaItem[]>();
    filtered.forEach((item) => {
      const key = format(item.date, "yyyy-MM-dd");
      const arr = map.get(key) ?? [];
      arr.push(item);
      map.set(key, arr);
    });
    return map;
  }, [filtered]);

  const dayItems = filtered
    .filter((i) => isSameDay(i.date, selectedDate))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const upcoming = filtered
    .filter((i) => i.date >= startOfDay(new Date()))
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 8);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="animate-fade-in">
          <h1 className="text-2xl font-semibold tracking-tight">Agenda</h1>
          <p className="text-muted-foreground">
            Visão unificada de tarefas, pagamentos, documentos, obrigações e
            relatórios.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 animate-fade-in">
          <Filter className="h-4 w-4 text-muted-foreground" />
          {filterOptions.map((opt) => (
            <Button
              key={opt.key}
              variant={activeFilter === opt.key ? "default" : "outline"}
              size="sm"
              className="rounded-xl"
              onClick={() => setActiveFilter(opt.key)}
            >
              {opt.label}
            </Button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
          <Card className="animate-fade-in">
            <CardContent className="p-4">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => d && setSelectedDate(startOfDay(d))}
                locale={ptBR}
                modifiers={{
                  hasEvents: (date) => daySet.has(format(date, "yyyy-MM-dd")),
                }}
                modifiersClassNames={{
                  hasEvents:
                    "font-semibold underline decoration-primary decoration-2 underline-offset-4",
                }}
                className="rounded-md"
              />
              <div className="mt-4 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Próximos eventos
                </p>
                {upcoming.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">
                    Sem eventos
                  </p>
                ) : (
                  upcoming.map((item) => {
                    const cfg = kindConfig[item.kind];
                    const Icon = cfg.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setSelectedDate(startOfDay(item.date))}
                        className="w-full text-left flex items-start gap-2 p-2 rounded-lg hover:bg-accent/50 transition-colors"
                      >
                        <Icon
                          className={cn("h-4 w-4 mt-0.5 shrink-0", cfg.color)}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium truncate">
                            {item.title}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {format(item.date, "dd 'de' MMM", { locale: ptBR })}
                          </p>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="animate-fade-in">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold capitalize">
                    {format(selectedDate, "EEEE, dd 'de' MMMM", {
                      locale: ptBR,
                    })}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {dayItems.length}{" "}
                    {dayItems.length === 1 ? "evento" : "eventos"} nesta data
                  </p>
                </div>
              </div>
              {dayItems.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground">
                  <CalendarIcon className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Nenhum evento para esta data</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {dayItems.map((item) => {
                    const cfg = kindConfig[item.kind];
                    const Icon = cfg.icon;
                    return (
                      <div
                        key={item.id}
                        className="flex items-start gap-3 p-3 rounded-xl border border-border hover:bg-accent/40 transition-colors"
                      >
                        <div className={cn("p-2 rounded-lg", cfg.badge)}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">
                            {item.title}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {item.subtitle}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <Badge variant="outline" className="text-[10px]">
                            {cfg.label}
                          </Badge>
                          {item.meta && (
                            <span className="text-[10px] text-muted-foreground">
                              {item.meta}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Agenda;
