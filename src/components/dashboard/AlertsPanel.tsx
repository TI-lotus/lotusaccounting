import { AlertCircle, CheckCircle2, Clock, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const alerts = [
  {
    id: 1,
    type: "warning",
    title: "Fatura Vencida",
    description: "Fatura #1220 da Acme Corp está 15 dias em atraso",
    time: "2h atrás",
  },
  {
    id: 2,
    type: "success",
    title: "Pagamento Recebido",
    description: "TechStart Inc pagou a fatura #1231",
    time: "4h atrás",
  },
  {
    id: 3,
    type: "info",
    title: "Sincronização Bancária Concluída",
    description: "Todas as transações foram sincronizadas com sucesso",
    time: "Ontem",
  },
  {
    id: 4,
    type: "error",
    title: "Transação Falhou",
    description: "Pagamento com cartão recusado - necessário retentar",
    time: "Ontem",
  },
];

const alertStyles = {
  warning: {
    icon: AlertCircle,
    bg: "bg-amber-50 dark:bg-amber-950/30",
    iconColor: "text-amber-500",
    border: "border-amber-200 dark:border-amber-800",
  },
  success: {
    icon: CheckCircle2,
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    iconColor: "text-emerald-500",
    border: "border-emerald-200 dark:border-emerald-800",
  },
  info: {
    icon: Clock,
    bg: "bg-blue-50 dark:bg-blue-950/30",
    iconColor: "text-blue-500",
    border: "border-blue-200 dark:border-blue-800",
  },
  error: {
    icon: XCircle,
    bg: "bg-red-50 dark:bg-red-950/30",
    iconColor: "text-red-500",
    border: "border-red-200 dark:border-red-800",
  },
};

interface AlertsPanelProps {
  className?: string;
}

export const AlertsPanel = ({ className }: AlertsPanelProps) => {
  return (
    <div className={cn("glass rounded-2xl p-6 animate-fade-in", className)}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">Alertas e Notificações</h3>
          <p className="text-sm text-muted-foreground">Atualizações recentes de atividade</p>
        </div>
        <span className="text-xs bg-destructive text-destructive-foreground px-2 py-1 rounded-full font-medium">
          {alerts.length} novos
        </span>
      </div>
      <div className="space-y-3">
        {alerts.map((alert, index) => {
          const style = alertStyles[alert.type as keyof typeof alertStyles];
          const Icon = style.icon;
          return (
            <div
              key={alert.id}
              className={cn(
                "flex items-start gap-3 p-3 rounded-xl border transition-colors",
                style.bg,
                style.border
              )}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <Icon className={cn("h-5 w-5 shrink-0 mt-0.5", style.iconColor)} />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{alert.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {alert.description}
                </p>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {alert.time}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
