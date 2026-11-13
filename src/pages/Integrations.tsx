import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import {
  AlertTriangle,
  Check,
  Clock,
  ExternalLink,
  PauseCircle,
  Plug,
  Settings,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, ErrorState, LoadingState } from "@/components/PageStates";
import { cn } from "@/lib/utils";
import { BentoStatStrip } from "@/components/dashboard/BentoStatStrip";
import { useData } from "@/contexts/DataContext";
import {
  integrationCatalog,
  integrationCategoryOrder,
} from "@/lib/integrationCatalog";
import { getConnectionHealthLabel } from "@/services/integrations/integrationConnections";
import {
  loadIntegrationOpsSnapshot,
  type IntegrationOpsSnapshot,
} from "@/services/integrations/integrationOps";

const statusStyles: Record<string, string> = {
  connected:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  connecting:
    "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  error: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  expired: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  disabled: "bg-muted text-muted-foreground",
  disconnected: "bg-muted text-muted-foreground",
};

const StatusIcon = ({ status }: { status: string }) => {
  if (status === "connected") return <Check className="h-3 w-3 mr-1" />;
  if (status === "error" || status === "expired") {
    return <AlertTriangle className="h-3 w-3 mr-1" />;
  }
  if (status === "disabled") return <PauseCircle className="h-3 w-3 mr-1" />;
  if (status === "connecting" || status === "pending") {
    return <Clock className="h-3 w-3 mr-1" />;
  }
  return null;
};

const Integrations = () => {
  const navigate = useNavigate();
  const { integrationConnections } = useData();
  const [ops, setOps] = useState<IntegrationOpsSnapshot | null>(null);
  const [opsLoading, setOpsLoading] = useState(true);
  const [opsError, setOpsError] = useState<string | null>(null);
  const connectionById = new Map(
    integrationConnections.map((connection) => [
      connection.integration_id,
      connection,
    ]),
  );
  const totals = useMemo(
    () => ({
      connected: integrationConnections.filter(
        (connection) => connection.status === "connected",
      ).length,
      pendingJobs: ops?.jobs.filter((job) =>
        ["pending", "processing", "failed"].includes(job.status),
      ).length ?? 0,
      unresolvedErrors:
        ops?.errors.filter((error) => !error.resolved).length ?? 0,
      activeRules:
        ops?.automationRules.filter((rule) => rule.enabled).length ?? 0,
    }),
    [integrationConnections, ops],
  );

  const loadOps = async () => {
    setOpsLoading(true);
    setOpsError(null);
    try {
      setOps(await loadIntegrationOpsSnapshot());
    } catch (error) {
      setOpsError(error instanceof Error ? error.message : "Erro desconhecido");
    } finally {
      setOpsLoading(false);
    }
  };

  useEffect(() => {
    void loadOps();
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="page-header animate-fade-in">
          <h1 className="text-2xl font-semibold tracking-tight">Integrações</h1>
          <p className="text-muted-foreground">
            Conecte serviços para otimizar seu fluxo contábil
          </p>
        </div>

        <BentoStatStrip
          className="animate-fade-in"
          items={[
            { label: "Conectadas", value: totals.connected, icon: Check },
            { label: "Jobs pendentes", value: totals.pendingJobs, icon: Clock },
            { label: "Erros abertos", value: totals.unresolvedErrors, icon: AlertTriangle },
            { label: "Automações ativas", value: totals.activeRules, icon: Settings },
          ]}
        />

        <Tabs defaultValue="catalog" className="space-y-6">
          <TabsList className="segmented-tabs">
            <TabsTrigger value="catalog">Catálogo</TabsTrigger>
            <TabsTrigger value="ops">Operação</TabsTrigger>
            <TabsTrigger value="audit">Auditoria</TabsTrigger>
          </TabsList>

          <TabsContent value="catalog" className="space-y-8">
        {integrationCategoryOrder.map((category) => {
          const items = integrationCatalog.filter(
            (i) => i.category === category,
          );
          if (!items.length) return null;
          return (
            <section key={category} className="page-section space-y-4 animate-fade-in">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h2 className="text-lg font-medium">{category}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">Serviços disponíveis para o workspace.</p>
                </div>
                <Badge variant="secondary">{items.length}</Badge>
              </div>
              <div
                className={cn(
                  "grid gap-px overflow-hidden rounded-2xl border border-border/70 bg-border/70",
                  items.length === 1
                    ? "mx-auto max-w-sm"
                    : items.length === 4
                      ? "mx-auto sm:grid-cols-2 xl:max-w-4xl"
                      : "sm:grid-cols-2 xl:grid-cols-3",
                )}
              >
                {items.map((integration) => {
                  const Icon = integration.icon;
                  const connection = connectionById.get(integration.id);
                  const status = connection?.status ?? "disconnected";
                  const connected = status === "connected";
                  return (
                    <div
                      key={integration.id}
                      className={cn(
                        "flex flex-col gap-4 bg-card p-5 transition-colors duration-200 hover:bg-accent/20",
                        connected && "bg-gilver/5",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div
                          className={cn(
                            "text-gilver",
                            !connected && "text-muted-foreground",
                          )}
                          title={integration.name}
                        >
                          <Icon className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
                        </div>
                        <Badge className={statusStyles[status] ?? statusStyles.disconnected}>
                          <StatusIcon status={status} />
                          {getConnectionHealthLabel(status)}
                        </Badge>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold">{integration.name}</h3>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {integration.description}
                        </p>
                        {connection && (
                          <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                            <p>
                              Conta:{" "}
                              {connection.provider_account_name ||
                                connection.account_label ||
                                "não informada"}
                            </p>
                            <p>
                              Último sync:{" "}
                              {connection.last_sync_at
                                ? new Date(
                                    connection.last_sync_at,
                                  ).toLocaleString("pt-BR")
                                : "pendente"}
                            </p>
                            {(connection.last_error_at ||
                              connection.status === "error") && (
                              <p className="text-red-600 dark:text-red-300">
                                Falha registrada:{" "}
                                {connection.last_error_at
                                  ? new Date(
                                      connection.last_error_at,
                                    ).toLocaleString("pt-BR")
                                  : "verifique a conexão"}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant={connected ? "outline" : "default"}
                          size="sm"
                          className="flex-1 rounded-xl gap-1.5"
                          onClick={() =>
                            navigate(`/integrations/${integration.id}`)
                          }
                        >
                          {connected ? (
                            <>
                              <ExternalLink className="h-3.5 w-3.5" />
                              Gerenciar
                            </>
                          ) : (
                            <>
                              <Plug className="h-3.5 w-3.5" />
                              Conectar
                            </>
                          )}
                        </Button>
                        {connected && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-xl"
                            onClick={() =>
                              navigate(`/integrations/${integration.id}`)
                            }
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
          </TabsContent>

          <TabsContent value="ops" className="space-y-4">
            <div className="flex justify-end">
              <Button variant="outline" className="rounded-xl" onClick={loadOps}>
                Atualizar
              </Button>
            </div>
            {opsLoading ? (
              <LoadingState rows={5} />
            ) : opsError ? (
              <ErrorState description={opsError} onRetry={loadOps} />
            ) : ops ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <OpsList
                  title="Fila de jobs"
                  rows={ops.jobs.map((job) => ({
                    id: job.id,
                    title: job.job_type,
                    meta: `${job.status} · tentativas ${job.attempt_count}/${job.max_attempts}`,
                    detail: job.last_error ?? job.scheduled_for,
                  }))}
                />
                <OpsList
                  title="Erros de integração"
                  rows={ops.errors.map((error) => ({
                    id: error.id,
                    title: `${error.provider} · ${error.operation}`,
                    meta: error.retryable ? "retentável" : "manual",
                    detail: error.error_message ?? "Sem detalhe",
                  }))}
                />
                <OpsList
                  title="Eventos recebidos"
                  rows={ops.events.map((event) => ({
                    id: event.id,
                    title: `${event.provider} · ${event.event_type}`,
                    meta: event.status,
                    detail: event.external_event_id ?? event.created_at,
                  }))}
                />
                <OpsList
                  title="Webhooks"
                  rows={ops.webhooks.map((webhook) => ({
                    id: webhook.id,
                    title: webhook.provider,
                    meta: `${webhook.status} · assinatura ${
                      webhook.signature_valid ? "válida" : "pendente"
                    }`,
                    detail: webhook.external_event_id ?? webhook.received_at,
                  }))}
                />
                <OpsList
                  title="Sincronizações"
                  rows={ops.syncRuns.map((sync) => ({
                    id: sync.id,
                    title: `${sync.provider} · ${sync.sync_type}`,
                    meta: `${sync.status} · ${sync.items_processed}/${sync.items_received}`,
                    detail: sync.error_message ?? sync.created_at,
                  }))}
                />
                <OpsList
                  title="Automações"
                  rows={ops.automationRules.map((rule) => ({
                    id: rule.id,
                    title: rule.name,
                    meta: `${rule.enabled ? "ativa" : "inativa"} · ${rule.trigger_event_type}`,
                    detail: rule.action_type,
                  }))}
                />
              </div>
            ) : null}
          </TabsContent>

          <TabsContent value="audit" className="space-y-4">
            {opsLoading ? (
              <LoadingState rows={4} />
            ) : opsError ? (
              <ErrorState description={opsError} onRetry={loadOps} />
            ) : (
              <OpsList
                title="Histórico técnico"
                rows={(ops?.activityLogs ?? []).map((log) => ({
                  id: log.id,
                  title: `${log.entity ?? "registro"} · ${log.action ?? "ação"}`,
                  meta: log.created_at
                    ? new Date(log.created_at).toLocaleString("pt-BR")
                    : "sem data",
                  detail: log.entity_id ?? "sem entidade",
                }))}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

const OpsList = ({
  title,
  rows,
}: {
  title: string;
  rows: { id: string; title: string; meta: string; detail: string }[];
}) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-base">{title}</CardTitle>
    </CardHeader>
    <CardContent>
      {rows.length === 0 ? (
        <EmptyState
          title="Nada por aqui"
          description="Quando houver atividade, ela aparecerá nesta lista."
        />
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div
              key={row.id}
              className="rounded-xl border border-border bg-background p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium">{row.title}</p>
                <Badge variant="secondary">{row.meta}</Badge>
              </div>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {row.detail}
              </p>
            </div>
          ))}
        </div>
      )}
    </CardContent>
  </Card>
);

export default Integrations;
