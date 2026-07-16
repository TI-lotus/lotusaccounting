import { AlertTriangle, Clock3, Receipt, ScrollText, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useData } from "@/contexts/DataContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface RiskItem {
  id: string;
  title: string;
  description: string;
  meta: string;
  severity: "high" | "medium" | "low";
  icon: typeof AlertTriangle;
  onClick?: () => void;
}

const severityStyles: Record<RiskItem["severity"], string> = {
  high: "border-red-200 dark:border-red-900/60 bg-red-50/70 dark:bg-red-950/30",
  medium: "border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30",
  low: "border-blue-200 dark:border-blue-900/60 bg-blue-50/70 dark:bg-blue-950/30",
};

const severityIconStyles: Record<RiskItem["severity"], string> = {
  high: "text-red-600 dark:text-red-400",
  medium: "text-amber-600 dark:text-amber-400",
  low: "text-blue-600 dark:text-blue-400",
};

const severityLabels: Record<RiskItem["severity"], string> = {
  high: "Alto",
  medium: "Médio",
  low: "Baixo",
};

const daysUntil = (iso: string) => {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.round(diff / (1000 * 60 * 60 * 24));
};

const fiscalObligations = [
  { id: "obg-das", title: "DAS - Simples Nacional", dueDate: "2026-01-20", clients: 34 },
  { id: "obg-darf", title: "DARF IRPJ trimestral", dueDate: "2026-01-31", clients: 12 },
  { id: "obg-defis", title: "DEFIS anual", dueDate: "2026-03-31", clients: 41 },
];

export const PendingRisksPanel = () => {
  const { tasks } = useData();
  const navigate = useNavigate();

  const overdueTasks = tasks
    .filter((t) => t.status === "overdue" || (t.status !== "completed" && daysUntil(t.dueDate) < 0))
    .slice(0, 3);

  const upcomingTasks = tasks
    .filter((t) => t.status !== "completed" && daysUntil(t.dueDate) >= 0 && daysUntil(t.dueDate) <= 7)
    .slice(0, 3);

  const items: RiskItem[] = [
    ...overdueTasks.map<RiskItem>((t) => ({
      id: `task-${t.id}`,
      title: t.title,
      description: t.clientName ?? "Sem cliente associado",
      meta: `Atrasada ${Math.abs(daysUntil(t.dueDate))}d`,
      severity: "high",
      icon: AlertTriangle,
      onClick: () => navigate("/tasks"),
    })),
    ...upcomingTasks.map<RiskItem>((t) => ({
      id: `task-up-${t.id}`,
      title: t.title,
      description: t.clientName ?? "Sem cliente associado",
      meta: `Vence em ${daysUntil(t.dueDate)}d`,
      severity: (daysUntil(t.dueDate) <= 2 ? "medium" : "low") as RiskItem["severity"],
      icon: Clock3,
      onClick: () => navigate("/tasks"),
    })),
    {
      id: "inv-1",
      title: "12 faturas vencendo nos próximos 7 dias",
      description: "R$ 24.380,00 em aberto",
      meta: "Financeiro",
      severity: "medium" as const,
      icon: Receipt,
      onClick: () => navigate("/payments"),
    },
    ...fiscalObligations.slice(0, 2).map<RiskItem>((o) => ({
      id: o.id,
      title: o.title,
      description: `${o.clients} clientes impactados`,
      meta: `Vence em ${daysUntil(o.dueDate)}d`,
      severity: (daysUntil(o.dueDate) < 7 ? "high" : daysUntil(o.dueDate) < 30 ? "medium" : "low") as RiskItem["severity"],
      icon: ScrollText,
      onClick: () => navigate("/agenda"),
    })),
  ].slice(0, 6);

  const highCount = items.filter((i) => i.severity === "high").length;

  return (
    <div className="glass rounded-2xl p-6 animate-fade-in">
      <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold">Pendências e riscos</h3>
          <p className="text-sm text-muted-foreground">
            Ações prioritárias antes dos indicadores financeiros
          </p>
        </div>
        <div className="flex items-center gap-2">
          {highCount > 0 && (
            <Badge variant="destructive" className="rounded-full">
              {highCount} crítica{highCount > 1 ? "s" : ""}
            </Badge>
          )}
          <Button variant="ghost" size="sm" className="rounded-xl gap-1" onClick={() => navigate("/tasks")}>
            Ver todas <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-sm text-muted-foreground py-6 text-center">
          Nenhuma pendência crítica no momento.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={item.onClick}
                className={cn(
                  "text-left rounded-xl border p-3 transition-colors hover:opacity-90",
                  severityStyles[item.severity]
                )}
              >
                <div className="flex items-start gap-2">
                  <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", severityIconStyles[item.severity])} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{item.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">{item.meta}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {severityLabels[item.severity]}
                      </Badge>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
