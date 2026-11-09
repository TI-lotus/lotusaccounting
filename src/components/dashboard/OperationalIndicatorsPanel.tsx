import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  FileWarning,
  ShieldAlert,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useData } from "@/contexts/DataContext";
import { computeOperationalMetrics } from "@/lib/operationalMetrics";
import { cn } from "@/lib/utils";

const statusLabels: Record<string, string> = {
  not_started: "Nao iniciada",
  waiting_documents: "Aguardando docs",
  in_progress: "Em execucao",
  in_review: "Em revisao",
  delivered: "Entregue",
  closed: "Fechada",
  blocked: "Bloqueada",
};

const statCards = [
  {
    key: "clientsOnTrack",
    label: "Clientes em dia",
    icon: CheckCircle2,
    tone: "text-emerald-600 bg-emerald-500/10",
  },
  {
    key: "clientsWithClientPending",
    label: "Pendencia do cliente",
    icon: FileWarning,
    tone: "text-amber-600 bg-amber-500/10",
  },
  {
    key: "lateCompetencies",
    label: "Competencias em risco",
    icon: ShieldAlert,
    tone: "text-red-600 bg-red-500/10",
  },
  {
    key: "pendingReviews",
    label: "Em revisao",
    icon: Clock,
    tone: "text-violet-600 bg-violet-500/10",
  },
] as const;

export const OperationalIndicatorsPanel = () => {
  const navigate = useNavigate();
  const {
    clients,
    clientPeriods,
    clientPeriodSteps,
    tasks,
    documentRequests,
    taskReviews,
    fiscalObligations,
  } = useData();

  const metrics = useMemo(
    () =>
      computeOperationalMetrics({
        clients,
        clientPeriods,
        clientPeriodSteps,
        tasks,
        documentRequests,
        taskReviews,
        fiscalObligations,
      }),
    [
      clients,
      clientPeriods,
      clientPeriodSteps,
      documentRequests,
      fiscalObligations,
      taskReviews,
      tasks,
    ],
  );

  const currentPeriodLabel = `${String(metrics.periodMonth).padStart(2, "0")}/${metrics.periodYear}`;
  const closedOrDelivered =
    metrics.periodStatusCounts.closed + metrics.periodStatusCounts.delivered;
  const periodCompletion = metrics.activeClients
    ? Math.round((closedOrDelivered / metrics.activeClients) * 100)
    : 0;
  const maxBottleneck = Math.max(1, ...metrics.bottlenecksByStep.map((item) => item.count));

  return (
    <section className="glass rounded-2xl p-6 animate-fade-in">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Indicadores operacionais</h3>
          <p className="text-sm text-muted-foreground">
            Risco, produtividade e gargalos da competencia {currentPeriodLabel}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="rounded-xl" onClick={() => navigate("/periods")}>
            Ciclo mensal
          </Button>
          <Button variant="outline" size="sm" className="rounded-xl" onClick={() => navigate("/work-queue")}>
            Minha fila
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          const value = metrics[card.key];
          return (
            <div key={card.key} className="rounded-xl border border-border bg-background/60 p-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className={cn("rounded-lg p-2", card.tone)}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-2xl font-semibold">{value}</p>
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-xl border border-border bg-background/60 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Competencias por status</p>
              <p className="text-xs text-muted-foreground">
                {closedOrDelivered}/{metrics.activeClients} clientes fechados ou entregues.
              </p>
            </div>
            <Badge variant="outline" className="text-[10px]">
              {periodCompletion}%
            </Badge>
          </div>
          <Progress value={periodCompletion} className="mb-4 h-2" />
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.entries(metrics.periodStatusCounts).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
                <span className="text-xs text-muted-foreground">{statusLabels[status] ?? status}</span>
                <span className="text-sm font-medium">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-background/60 p-4">
          <div className="mb-3 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Gargalos por etapa</p>
              <p className="text-xs text-muted-foreground">
                Etapas abertas na competencia atual.
              </p>
            </div>
          </div>
          {metrics.bottlenecksByStep.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum gargalo operacional no ciclo atual.
            </p>
          ) : (
            <div className="space-y-3">
              {metrics.bottlenecksByStep.map((item) => (
                <div key={item.stepKey}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{item.title}</span>
                    <span className="font-medium">{item.count}</span>
                  </div>
                  <Progress value={(item.count / maxBottleneck) * 100} className="h-2" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-border bg-background/60 p-4">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <div>
              <p className="text-sm font-medium">Clientes em risco</p>
              <p className="text-xs text-muted-foreground">
                Prioridade por documentos, tarefas, obrigacoes e competencia.
              </p>
            </div>
          </div>
          {metrics.riskClients.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum cliente em risco no momento.
            </p>
          ) : (
            <div className="space-y-2">
              {metrics.riskClients.map((client) => (
                <button
                  key={client.clientId}
                  className="w-full rounded-lg border border-border p-3 text-left transition-colors hover:bg-accent/35"
                  onClick={() => navigate(`/clients/${client.clientId}`)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{client.clientName}</p>
                    <Badge variant={client.score >= 70 ? "destructive" : "secondary"} className="text-[10px]">
                      {client.score} pts
                    </Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {client.reasons.join(" · ")}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-background/60 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Atrasos por colaborador</p>
              <p className="text-xs text-muted-foreground">
                Tarefas vencidas abertas por responsavel.
              </p>
            </div>
          </div>
          {metrics.overdueTasksByAssignee.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhuma tarefa atrasada por colaborador.
            </p>
          ) : (
            <div className="space-y-2">
              {metrics.overdueTasksByAssignee.slice(0, 6).map((assignee) => (
                <div key={assignee.assigneeId} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
                  <span className="truncate text-sm">{assignee.assigneeName}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {assignee.count} atrasada{assignee.count > 1 ? "s" : ""}
                  </Badge>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            Tempo medio de fechamento:{" "}
            <span className="font-medium text-foreground">
              {metrics.averageClosureDays === null ? "sem historico" : `${metrics.averageClosureDays} dias`}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
