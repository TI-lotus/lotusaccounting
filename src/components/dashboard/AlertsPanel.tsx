import { useMemo } from "react";
import { AlertCircle, ArrowRight, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useData } from "@/contexts/DataContext";
import { cn } from "@/lib/utils";

const alertStyles = {
  warning: {
    icon: AlertCircle,
    bg: "bg-amber-50 dark:bg-amber-950/30",
    iconColor: "text-amber-500",
    border: "border-amber-200 dark:border-amber-800",
  },
  info: {
    icon: Clock,
    bg: "bg-blue-50 dark:bg-blue-950/30",
    iconColor: "text-blue-500",
    border: "border-blue-200 dark:border-blue-800",
  },
};

type AlertItem = {
  id: string;
  type: keyof typeof alertStyles;
  title: string;
  description: string;
  time: string;
  href: string;
};

const daysUntil = (value?: string | null) => {
  if (!value) return null;
  return Math.ceil((new Date(value).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
};

const relativeDate = (value?: string | null) => {
  const days = daysUntil(value);
  if (days === null) return "Sem prazo";
  if (days < 0) return `Atrasado há ${Math.abs(days)}d`;
  if (days === 0) return "Vence hoje";
  if (days === 1) return "Vence amanhã";
  return `Vence em ${days}d`;
};

interface AlertsPanelProps {
  className?: string;
}

export const AlertsPanel = ({ className }: AlertsPanelProps) => {
  const navigate = useNavigate();
  const { tasks, invoices, documentRequests, fiscalObligations } = useData();
  const alerts = useMemo<AlertItem[]>(() => {
    const overdueInvoices = invoices
      .filter(
        (invoice) =>
          invoice.status === "overdue" ||
          (invoice.status !== "paid" && (daysUntil(invoice.due_date) ?? 0) < 0),
      )
      .slice(0, 2)
      .map((invoice) => ({
        id: `invoice-${invoice.id}`,
        type: "warning" as const,
        title: "Fatura vencida",
        description: invoice.number || invoice.id.slice(0, 8),
        time: relativeDate(invoice.due_date),
        href: "/invoices",
      }));
    const overdueTasks = tasks
      .filter(
        (task) =>
          task.status !== "completed" &&
          (task.status === "overdue" || (daysUntil(task.dueDate) ?? 0) < 0),
      )
      .slice(0, 2)
      .map((task) => ({
        id: `task-${task.id}`,
        type: "warning" as const,
        title: "Tarefa atrasada",
        description: task.title,
        time: relativeDate(task.dueDate),
        href: "/tasks",
      }));
    const pendingDocuments = documentRequests
      .filter((request) => ["requested", "rejected"].includes(request.status))
      .slice(0, 2)
      .map((request) => ({
        id: `document-${request.id}`,
        type: "info" as const,
        title: request.status === "rejected" ? "Documento recusado" : "Documento pendente",
        description: request.title,
        time: relativeDate(request.dueDate),
        href: "/documents",
      }));
    const overdueObligations = fiscalObligations
      .filter(
        (obligation) =>
          obligation.status !== "completed" &&
          (daysUntil(obligation.due_date) ?? 0) < 0,
      )
      .slice(0, 2)
      .map((obligation) => ({
        id: `obligation-${obligation.id}`,
        type: "warning" as const,
        title: "Obrigação atrasada",
        description: obligation.name,
        time: relativeDate(obligation.due_date),
        href: "/reports",
      }));

    return [...overdueInvoices, ...overdueTasks, ...pendingDocuments, ...overdueObligations].slice(0, 5);
  }, [documentRequests, fiscalObligations, invoices, tasks]);

  return (
    <div className={cn("glass rounded-2xl p-6 animate-fade-in", className)}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Alertas e notificações</h3>
          <p className="text-sm text-muted-foreground">Pendências reais do workspace</p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => navigate("/notifications")}
        >
          Ver notificações <ArrowRight className="h-3 w-3" />
        </button>
      </div>
      {alerts.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Nenhuma pendência exige atenção agora.
        </p>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert, index) => {
            const style = alertStyles[alert.type];
            const Icon = style.icon;
            return (
              <button
                key={alert.id}
                type="button"
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors hover:opacity-90",
                  style.bg,
                  style.border,
                )}
                style={{ animationDelay: `${index * 50}ms` }}
                onClick={() => navigate(alert.href)}
              >
                <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", style.iconColor)} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{alert.title}</span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {alert.description}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{alert.time}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
