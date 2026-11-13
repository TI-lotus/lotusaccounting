import { useMemo, useState } from "react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import {
  Calendar as CalendarIcon,
  FileText,
  Receipt,
  CheckSquare,
  ScrollText,
  ExternalLink,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useData } from "@/contexts/DataContext";
import { cn } from "@/lib/utils";
import { format, isSameDay, startOfDay, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspacePermission } from "@/hooks/useWorkspacePermission";
import { FilterPopover } from "@/components/FilterPopover";
import { largeCalendarClassNames } from "@/components/calendarStyles";

type AgendaKind = "task" | "payment" | "document" | "obligation";

interface AgendaItem {
  id: string;
  sourceId: string;
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
};

const filterOptions: { key: AgendaKind | "all"; label: string }[] = [
  { key: "all", label: "Tudo" },
  { key: "task", label: "Tarefas" },
  { key: "payment", label: "Pagamentos" },
  { key: "document", label: "Documentos" },
  { key: "obligation", label: "Obrigações" },
];

const Agenda = () => {
  const navigate = useNavigate();
  const { tasks, documents, payments, invoices, clients, fiscalObligations, updateTaskStatus, deleteTask } =
    useData();
  const { user, profile } = useAuth();
  const canDeleteTasks = useWorkspacePermission({
    tenantId: profile?.tenant_id ?? null,
    userId: user?.id,
    accountType: profile?.account_type,
    resource: "tasks",
    action: "delete",
  });
  const [selectedDate, setSelectedDate] = useState<Date>(
    startOfDay(new Date()),
  );
  const [visibleMonth, setVisibleMonth] = useState<Date>(startOfMonth(new Date()));
  const [activeFilter, setActiveFilter] = useState<AgendaKind | "all">("all");
  const [selectedItem, setSelectedItem] = useState<AgendaItem | null>(null);

  const items = useMemo<AgendaItem[]>(() => {
    const clientNameById = new Map(
      clients.map((client) => [client.id, client.name]),
    );
    const taskItems: AgendaItem[] = tasks
      .filter((t) => !!t.dueDate)
      .map((t) => ({
        id: `task-${t.id}`,
        sourceId: t.id,
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
        sourceId: d.id,
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
        sourceId: payment.id,
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
        sourceId: invoice.id,
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
        sourceId: obligation.id,
        kind: "obligation",
        title: obligation.name,
        subtitle: obligation.company_id
          ? (clientNameById.get(obligation.company_id) ?? "Cliente")
          : "Sem cliente",
        date: new Date(`${obligation.due_date}T00:00:00`),
        meta: obligation.status === "completed" ? "Entregue" : "Fiscal",
      }),
    );

    return [
      ...taskItems,
      ...docItems,
      ...paymentItems,
      ...invoiceItems,
      ...obligationItems,
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

  const openModule = (item: AgendaItem) => {
    if (item.kind === "task") navigate("/tasks");
    if (item.kind === "document") navigate("/documents");
    if (item.kind === "payment") navigate("/payments");
    if (item.kind === "obligation") navigate("/agenda");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="animate-fade-in">
          <h1 className="text-[28px] font-normal tracking-[-0.035em]">Agenda</h1>
          <p className="text-muted-foreground">
            Visão unificada de tarefas, pagamentos, documentos e obrigações.
          </p>
        </div>

        <section className="space-y-4 animate-fade-in">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-medium">Eventos e obrigações</h2>
              <p className="mt-1 text-sm text-muted-foreground">Filtre a agenda sem separar o controle da área que ele atualiza.</p>
            </div>
          <FilterPopover
            activeCount={activeFilter === "all" ? 0 : 1}
            onClear={() => setActiveFilter("all")}
          >
            <div className="grid grid-cols-2 gap-2">
              {filterOptions.map((opt) => (
                <Button
                  key={opt.key}
                  type="button"
                  variant={activeFilter === opt.key ? "default" : "outline"}
                  size="sm"
                  className="justify-start"
                  onClick={() => setActiveFilter(opt.key)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </FilterPopover>
          </div>

        <div className="grid items-stretch grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="flex h-full min-h-[600px] flex-col rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
              <Calendar
                mode="single"
                month={visibleMonth}
                onMonthChange={setVisibleMonth}
                selected={selectedDate}
                onSelect={(d) => {
                  if (!d) return;
                  setSelectedDate(startOfDay(d));
                  setVisibleMonth(startOfMonth(d));
                }}
                locale={ptBR}
                modifiers={{
                  hasEvents: (date) => daySet.has(format(date, "yyyy-MM-dd")),
                }}
                modifiersClassNames={{
                  hasEvents:
                    "border-gilver/70 bg-gilver/10 font-semibold",
                }}
                className="w-full max-w-none p-0"
                classNames={largeCalendarClassNames}
                captionLayout="dropdown"
                fromYear={2010}
                toYear={new Date().getFullYear() + 5}
              />
          </div>

          <div className="flex h-full min-h-[600px] flex-col rounded-2xl border border-border/70 bg-card p-5 sm:p-6">
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
                <div className="flex min-h-64 flex-1 flex-col items-center justify-center text-center text-muted-foreground">
                  <CalendarIcon className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Nenhum evento para esta data</p>
                </div>
              ) : (
                <div className="custom-scroll min-h-0 flex-1 space-y-0 overflow-y-auto pr-1">
                  {dayItems.map((item) => {
                    const cfg = kindConfig[item.kind];
                    const Icon = cfg.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setSelectedItem(item)}
                        className="group flex w-full items-start gap-3 border-b border-border/70 px-2 py-3 text-left transition-colors last:border-b-0 hover:bg-accent/30"
                      >
                        <div className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", cfg.badge)}>
                          <Icon className="h-4 w-4" aria-hidden="true" />
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
                      </button>
                    );
                  })}
                </div>
              )}
          </div>
        </div>
        </section>

        <Dialog open={Boolean(selectedItem)} onOpenChange={(open) => !open && setSelectedItem(null)}>
          <DialogContent className="sm:max-w-[520px]">
            {selectedItem && (() => {
              const cfg = kindConfig[selectedItem.kind];
              const Icon = cfg.icon;
              return (
                <>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <span className={cn("rounded-lg p-2", cfg.badge)}><Icon className="h-4 w-4" /></span>
                      {selectedItem.title}
                    </DialogTitle>
                    <DialogDescription>{cfg.label} · {format(selectedItem.date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-3 py-2 text-sm">
                    <div><p className="text-xs text-muted-foreground">Cliente</p><p className="font-medium">{selectedItem.subtitle || "Sem cliente"}</p></div>
                    <div><p className="text-xs text-muted-foreground">Detalhe</p><p className="font-medium">{selectedItem.meta || "—"}</p></div>
                  </div>
                  <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
                    {selectedItem.kind === "task" && canDeleteTasks && (
                      <Button variant="destructive" className="rounded-xl" onClick={() => {
                        void deleteTask(selectedItem.sourceId).then((removed) => {
                          if (removed) setSelectedItem(null);
                        });
                      }}>
                        <Trash2 className="mr-2 h-4 w-4" />Remover
                      </Button>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" className="rounded-xl" onClick={() => openModule(selectedItem)}>
                        <ExternalLink className="mr-2 h-4 w-4" />Abrir módulo
                      </Button>
                      {selectedItem.kind === "task" && (
                        <Button className="rounded-xl" onClick={() => { void updateTaskStatus(selectedItem.sourceId, "completed"); setSelectedItem(null); }}>
                          Concluir
                        </Button>
                      )}
                    </div>
                  </DialogFooter>
                </>
              );
            })()}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Agenda;
