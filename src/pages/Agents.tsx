import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { DashboardLayout } from "@/layouts/DashboardLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { BentoStatStrip } from "@/components/dashboard/BentoStatStrip";
import { IconTooltipButton } from "@/components/IconTooltipButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  HeadphonesIcon,
  BarChart3,
  Mail,
  Bell,
  Calculator,
  FileSearch,
  Users,
  CreditCard,
  Calendar,
  AlertTriangle,
  TrendingUp,
  MessageSquare,
  FileCheck,
  Clock,
  Zap,
  Play,
  CheckCircle,
  XCircle,
  Pencil,
  Filter,
  RotateCcw,
  Plus,
  Trash2,
  LayoutGrid,
  List,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useData } from "@/contexts/DataContext";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Agent {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  category: "invoices" | "support" | "reports" | "finance" | "automation";
  enabled: boolean;
  status: "active" | "idle" | "learning";
  actionsToday: number;
  schedule?: string;
  maxRetries?: number;
}

interface Execution {
  id: string;
  agentName: string;
  agentId: string;
  action: string;
  status: "success" | "error" | "running";
  timestamp: string;
  duration: string;
  details: string;
  category: string;
}

type ActivityLogRow = Database["public"]["Tables"]["activity_logs"]["Row"];

interface ApprovalItem {
  id: string;
  agent: string;
  action: string;
  requested: string;
  risk: "alto" | "médio";
}

const initialAgents: Agent[] = [
  {
    id: "invoice-generator",
    name: "Gerador de Faturas",
    description:
      "Cria faturas automaticamente baseado em contratos e serviços recorrentes",
    icon: FileText,
    category: "invoices",
    enabled: true,
    status: "active",
    actionsToday: 23,
    schedule: "Diário",
    maxRetries: 3,
  },
  {
    id: "invoice-reminder",
    name: "Lembrete de Vencimento",
    description:
      "Envia lembretes automáticos para clientes com faturas próximas do vencimento",
    icon: Bell,
    category: "invoices",
    enabled: true,
    status: "active",
    actionsToday: 45,
    schedule: "Diário",
    maxRetries: 2,
  },
  {
    id: "invoice-reconciliation",
    name: "Conciliação de Pagamentos",
    description:
      "Reconcilia pagamentos recebidos com faturas emitidas automaticamente",
    icon: FileCheck,
    category: "invoices",
    enabled: false,
    status: "idle",
    actionsToday: 0,
    schedule: "A cada 6h",
    maxRetries: 5,
  },
  {
    id: "support-chat",
    name: "Atendimento Inteligente",
    description:
      "Responde dúvidas frequentes dos clientes via chat automaticamente",
    icon: MessageSquare,
    category: "support",
    enabled: true,
    status: "active",
    actionsToday: 156,
    schedule: "Contínuo",
    maxRetries: 1,
  },
  {
    id: "support-tickets",
    name: "Triagem de Tickets",
    description: "Classifica e prioriza tickets de suporte automaticamente",
    icon: HeadphonesIcon,
    category: "support",
    enabled: true,
    status: "active",
    actionsToday: 34,
    schedule: "Contínuo",
    maxRetries: 2,
  },
  {
    id: "support-escalation",
    name: "Escalação Automática",
    description: "Escala tickets críticos para especialistas quando necessário",
    icon: AlertTriangle,
    category: "support",
    enabled: false,
    status: "idle",
    actionsToday: 0,
    schedule: "Contínuo",
    maxRetries: 1,
  },
  {
    id: "report-daily",
    name: "Relatório Diário",
    description: "Gera e envia relatórios diários de performance financeira",
    icon: BarChart3,
    category: "reports",
    enabled: true,
    status: "active",
    actionsToday: 1,
    schedule: "Diário 08:00",
    maxRetries: 3,
  },
  {
    id: "report-insights",
    name: "Insights de Negócio",
    description: "Analisa dados e identifica tendências e oportunidades",
    icon: TrendingUp,
    category: "reports",
    enabled: true,
    status: "learning",
    actionsToday: 12,
    schedule: "A cada 2h",
    maxRetries: 2,
  },
  {
    id: "report-compliance",
    name: "Verificação de Compliance",
    description:
      "Verifica conformidade com regulamentações fiscais automaticamente",
    icon: FileSearch,
    category: "reports",
    enabled: false,
    status: "idle",
    actionsToday: 0,
    schedule: "Semanal",
    maxRetries: 3,
  },
  {
    id: "finance-forecast",
    name: "Previsão de Fluxo de Caixa",
    description: "Projeta fluxo de caixa baseado em histórico e contratos",
    icon: Calculator,
    category: "finance",
    enabled: true,
    status: "active",
    actionsToday: 8,
    schedule: "Diário",
    maxRetries: 3,
  },
  {
    id: "finance-payment",
    name: "Processamento de Pagamentos",
    description: "Processa e valida pagamentos recebidos automaticamente",
    icon: CreditCard,
    category: "finance",
    enabled: true,
    status: "active",
    actionsToday: 67,
    schedule: "Contínuo",
    maxRetries: 5,
  },
  {
    id: "finance-overdue",
    name: "Gestão de Inadimplência",
    description:
      "Identifica e gerencia contas inadimplentes com ações automáticas",
    icon: Clock,
    category: "finance",
    enabled: false,
    status: "idle",
    actionsToday: 0,
    schedule: "Diário",
    maxRetries: 3,
  },
  {
    id: "auto-email",
    name: "Email Marketing",
    description: "Envia campanhas de email personalizadas para clientes",
    icon: Mail,
    category: "automation",
    enabled: false,
    status: "idle",
    actionsToday: 0,
    schedule: "Sob demanda",
    maxRetries: 2,
  },
  {
    id: "auto-scheduling",
    name: "Agendamento Inteligente",
    description: "Agenda reuniões e compromissos automaticamente",
    icon: Calendar,
    category: "automation",
    enabled: true,
    status: "active",
    actionsToday: 5,
    schedule: "Contínuo",
    maxRetries: 2,
  },
  {
    id: "auto-onboarding",
    name: "Onboarding de Clientes",
    description:
      "Automatiza o processo de cadastro e boas-vindas de novos clientes",
    icon: Users,
    category: "automation",
    enabled: true,
    status: "learning",
    actionsToday: 3,
    schedule: "Sob demanda",
    maxRetries: 3,
  },
  {
    id: "auto-workflow",
    name: "Automação de Workflows",
    description: "Executa fluxos de trabalho complexos baseados em gatilhos",
    icon: Zap,
    category: "automation",
    enabled: true,
    status: "active",
    actionsToday: 89,
    schedule: "Contínuo",
    maxRetries: 5,
  },
];

const categoryLabels: Record<Agent["category"], string> = {
  invoices: "Faturas",
  support: "Suporte",
  reports: "Relatórios",
  finance: "Finanças",
  automation: "Automação",
};

const activityAgentMap: Record<
  string,
  { agentId: string; agentName: string; category: Agent["category"] }
> = {
  invoice: {
    agentId: "invoice-generator",
    agentName: "Gerador de Faturas",
    category: "invoices",
  },
  payment: {
    agentId: "finance-payment",
    agentName: "Processamento de Pagamentos",
    category: "finance",
  },
  document: {
    agentId: "auto-workflow",
    agentName: "Automação de Workflows",
    category: "automation",
  },
  task: {
    agentId: "auto-scheduling",
    agentName: "Agendamento Inteligente",
    category: "automation",
  },
  fiscal_obligation: {
    agentId: "report-compliance",
    agentName: "Verificação de Compliance",
    category: "reports",
  },
  company: {
    agentId: "auto-onboarding",
    agentName: "Onboarding de Clientes",
    category: "automation",
  },
};

const metadataValue = (metadata: Json | null, key: string) => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const value = (metadata as Record<string, Json | undefined>)[key];
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  return null;
};

const actionLabel = (action?: string | null) => {
  if (action === "insert") return "Criou";
  if (action === "update") return "Atualizou";
  if (action === "delete") return "Removeu";
  return "Registrou";
};

const statusConfig: Record<
  Agent["status"],
  { label: string; className: string }
> = {
  active: {
    label: "Ativo",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  idle: { label: "Inativo", className: "bg-muted text-muted-foreground" },
  learning: {
    label: "Aprendendo",
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
};

export default function Agents() {
  const navigate = useNavigate();
  const { clients, documents, payments, invoices, tasks, fiscalObligations } =
    useData();
  const [agents, setAgents] = useState<Agent[]>(initialAgents);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    schedule: "",
    maxRetries: 3,
  });
  const [execFilter, setExecFilter] = useState<string>("all");
  const [execStatusFilter, setExecStatusFilter] = useState<string>("all");
  const [agentView, setAgentView] = useState<"grid" | "list">("grid");
  const [activityLogs, setActivityLogs] = useState<ActivityLogRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (!cancelled) setActivityLogs((data ?? []) as ActivityLogRow[]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleAgent = (id: string) => {
    setAgents((prev) =>
      prev.map((agent) =>
        agent.id === id
          ? {
              ...agent,
              enabled: !agent.enabled,
              status: !agent.enabled ? "active" : "idle",
              actionsToday: !agent.enabled ? agent.actionsToday : 0,
            }
          : agent,
      ),
    );
  };

  const openEdit = (agent: Agent) => {
    setEditingAgent(agent);
    setEditForm({
      name: agent.name,
      description: agent.description,
      schedule: agent.schedule || "",
      maxRetries: agent.maxRetries || 3,
    });
  };

  const saveEdit = () => {
    if (!editingAgent) return;
    setAgents((prev) =>
      prev.map((a) =>
        a.id === editingAgent.id
          ? {
              ...a,
              name: editForm.name,
              description: editForm.description,
              schedule: editForm.schedule,
              maxRetries: editForm.maxRetries,
            }
          : a,
      ),
    );
    setEditingAgent(null);
  };

  const groupedAgents = agents.reduce(
    (acc, agent) => {
      if (!acc[agent.category]) acc[agent.category] = [];
      acc[agent.category].push(agent);
      return acc;
    },
    {} as Record<Agent["category"], Agent[]>,
  );

  const totalActive = agents.filter((a) => a.enabled).length;
  const executions = useMemo<Execution[]>(
    () =>
      activityLogs.map((log) => {
        const config = activityAgentMap[log.entity ?? ""] ?? {
          agentId: "auto-workflow",
          agentName: "Automação de Workflows",
          category: "automation" as Agent["category"],
        };
        const label =
          metadataValue(log.metadata, "label") ?? log.entity ?? "registro";
        const changedFields = metadataValue(log.metadata, "changed_fields");
        const timestamp = log.created_at
          ? `${formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: ptBR })}`
          : "Sem data";
        return {
          id: log.id,
          agentId: config.agentId,
          agentName: config.agentName,
          action: `${actionLabel(log.action)} ${label}`,
          status: "success",
          timestamp,
          duration: "registrado",
          details: changedFields
            ? `Campos: ${changedFields}`
            : "Auditoria do sistema",
          category: config.category,
        };
      }),
    [activityLogs],
  );

  const today = new Date();
  const actionsByAgent = new Map<string, number>();
  executions.forEach((execution) => {
    const log = activityLogs.find((item) => item.id === execution.id);
    if (!log?.created_at) return;
    const created = new Date(log.created_at);
    if (
      created.getFullYear() === today.getFullYear() &&
      created.getMonth() === today.getMonth() &&
      created.getDate() === today.getDate()
    ) {
      actionsByAgent.set(
        execution.agentId,
        (actionsByAgent.get(execution.agentId) ?? 0) + 1,
      );
    }
  });

  const displayedAgents = agents.map((agent) => ({
    ...agent,
    actionsToday: actionsByAgent.get(agent.id) ?? 0,
  }));
  const totalActions = displayedAgents.reduce(
    (sum, a) => sum + a.actionsToday,
    0,
  );

  const filteredExecutions = executions.filter((e) => {
    const catMatch = execFilter === "all" || e.category === execFilter;
    const statusMatch =
      execStatusFilter === "all" || e.status === execStatusFilter;
    return catMatch && statusMatch;
  });

  const successCount = executions.filter((e) => e.status === "success").length;
  const errorCount = executions.filter((e) => e.status === "error").length;
  const runningCount = executions.filter((e) => e.status === "running").length;
  const approvalItems = useMemo<ApprovalItem[]>(() => {
    const clientNameById = new Map(
      clients.map((client) => [client.id, client.name]),
    );
    const overdueInvoices = invoices
      .filter((invoice) => invoice.status === "overdue")
      .slice(0, 3)
      .map((invoice) => ({
        id: `invoice-${invoice.id}`,
        agent: "Gestão de Inadimplência",
        action: `Definir ação para fatura ${invoice.number ?? invoice.id.slice(0, 8)} vencida`,
        requested: invoice.due_date
          ? `Vencida em ${new Date(`${invoice.due_date}T00:00:00`).toLocaleDateString("pt-BR")}`
          : "Sem vencimento",
        risk: "alto" as const,
      }));
    const unassignedDocuments = documents
      .filter(
        (document) =>
          !document.clientId || document.classificationConfidence < 0.7,
      )
      .slice(0, 3)
      .map((document) => ({
        id: `document-${document.id}`,
        agent: "Automação de Workflows",
        action: `Revisar classificação de ${document.name}`,
        requested: document.clientName ?? "Cliente não identificado",
        risk: document.clientId ? ("médio" as const) : ("alto" as const),
      }));
    const highTasks = tasks
      .filter((task) => task.priority === "high" && task.status !== "completed")
      .slice(0, 3)
      .map((task) => ({
        id: `task-${task.id}`,
        agent: "Agendamento Inteligente",
        action: `Validar prioridade da tarefa ${task.title}`,
        requested: task.clientName ?? "Sem cliente",
        risk: "médio" as const,
      }));
    const dueObligations = fiscalObligations
      .filter((obligation) => obligation.status !== "completed")
      .slice(0, 3)
      .map((obligation) => ({
        id: `obligation-${obligation.id}`,
        agent: "Verificação de Compliance",
        action: `Confirmar entrega de ${obligation.name}`,
        requested: obligation.company_id
          ? (clientNameById.get(obligation.company_id) ?? "Cliente")
          : "Sem cliente",
        risk:
          obligation.priority === "high"
            ? ("alto" as const)
            : ("médio" as const),
      }));
    const pendingPayments = payments
      .filter(
        (payment) =>
          payment.status === "pending" && Number(payment.amount) >= 50000,
      )
      .slice(0, 2)
      .map((payment) => ({
        id: `payment-${payment.id}`,
        agent: "Processamento de Pagamentos",
        action: `Aprovar conciliação de pagamento de R$ ${Number(payment.amount).toLocaleString("pt-BR")}`,
        requested: payment.company_id
          ? (clientNameById.get(payment.company_id) ?? "Cliente")
          : "Sem cliente",
        risk: "alto" as const,
      }));
    return [
      ...overdueInvoices,
      ...pendingPayments,
      ...unassignedDocuments,
      ...highTasks,
      ...dueObligations,
    ].slice(0, 8);
  }, [clients, documents, fiscalObligations, invoices, payments, tasks]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-[28px] font-normal tracking-[-0.035em]">Agentes de IA</h1>
            <p className="text-muted-foreground">
              Gerencie automações inteligentes para sua contabilidade
            </p>
          </div>
          <BentoStatStrip
            className="w-full max-w-md sm:grid-cols-2 xl:grid-cols-2"
            items={[
              { label: "Agentes ativos", value: totalActive, icon: Zap },
              { label: "Ações hoje", value: totalActions, icon: Play },
            ]}
          />
        </div>

        <Tabs defaultValue="agents">
          <TabsList>
            <TabsTrigger value="agents" className="gap-2">
              <Zap className="h-4 w-4" />
              Biblioteca
            </TabsTrigger>
            <TabsTrigger value="workflow" className="gap-2">
              <FileSearch className="h-4 w-4" />
              Workflow
            </TabsTrigger>
            <TabsTrigger value="executions" className="gap-2">
              <Play className="h-4 w-4" />
              Execuções
            </TabsTrigger>
            <TabsTrigger value="approvals" className="gap-2">
              <CheckCircle className="h-4 w-4" />
              Aprovações
            </TabsTrigger>
          </TabsList>

          <TabsContent value="agents" className="space-y-6 mt-6">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              A biblioteca de agentes é uma camada de configuração visual. Ativações e execuções reais dependem de providers e jobs conectados; alterações nesta tela ficam apenas nesta sessão.
            </div>
            <div className="flex justify-end">
              <div className="flex rounded-full border border-border bg-card p-1">
                <IconTooltipButton
                  icon={LayoutGrid}
                  label="Grade"
                  variant={agentView === "grid" ? "default" : "ghost"}
                  className="rounded-full"
                  aria-pressed={agentView === "grid"}
                  onClick={() => setAgentView("grid")}
                />
                <IconTooltipButton
                  icon={List}
                  label="Lista"
                  variant={agentView === "list" ? "default" : "ghost"}
                  className="rounded-full"
                  aria-pressed={agentView === "list"}
                  onClick={() => setAgentView("list")}
                />
              </div>
            </div>
            {(Object.keys(groupedAgents) as Agent["category"][]).map(
              (category) => (
                <div key={category} className="space-y-4">
                  <h2 className="text-lg font-medium">
                    {categoryLabels[category]}
                  </h2>
                  <div
                    className={cn(
                      "grid gap-4",
                      agentView === "grid"
                        ? "md:grid-cols-2 lg:grid-cols-3"
                        : "grid-cols-1",
                    )}
                  >
                    {groupedAgents[category].map((agent) => {
                      const agentWithActivity =
                        displayedAgents.find((item) => item.id === agent.id) ??
                        agent;
                      const Icon = agent.icon;
                      const status = statusConfig[agent.status];
                      return (
                        <Card
                          key={agent.id}
                          className={cn(
                            "transition-[background-color,border-color,box-shadow] duration-200",
                            agent.enabled
                              ? "border-primary/20 bg-card"
                              : "border-border bg-muted/30",
                          )}
                        >
                          <CardHeader
                            className={cn(
                              "pb-3",
                              agentView === "list" && "pb-4",
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <Icon className="h-5 w-5 text-gilver" aria-hidden="true" title={agent.name} />
                                <div className="space-y-1">
                                  <CardTitle className="text-base">
                                    {agent.name}
                                  </CardTitle>
                                  <div className="flex items-center gap-2">
                                    <Badge
                                      variant="secondary"
                                      className={status.className}
                                    >
                                      {status.label}
                                    </Badge>
                                    {agent.schedule && (
                                      <span className="text-[10px] text-muted-foreground">
                                        {agent.schedule}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  aria-label={`Editar ${agent.name}`}
                                  title={`Editar ${agent.name}`}
                                  onClick={() => openEdit(agent)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Switch
                                  checked={agent.enabled}
                                  onCheckedChange={() => toggleAgent(agent.id)}
                                />
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent
                            className={cn(agentView === "list" && "pt-0")}
                          >
                            <CardDescription className="text-sm">
                              {agent.description}
                            </CardDescription>
                            {agent.enabled &&
                              agentWithActivity.actionsToday > 0 && (
                                <div className="mt-3 pt-3 border-t border-border">
                                  <span className="text-xs text-muted-foreground">
                                    {agentWithActivity.actionsToday} ações
                                    realizadas hoje
                                  </span>
                                </div>
                              )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ),
            )}
          </TabsContent>

          <TabsContent value="workflow" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Construtor de workflows</CardTitle>
                <CardDescription>
                  O construtor visual tem uma área própria para evitar duplicação entre biblioteca e workflows.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center justify-between gap-4">
                <p className="max-w-2xl text-sm text-muted-foreground">
                  Consulte e edite o fluxo em um único local. Persistência, execução genérica e jobs ainda precisam da camada de automação definitiva.
                </p>
                <Button className="rounded-xl" onClick={() => navigate("/workflows")}>
                  Abrir construtor
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="executions" className="mt-6 space-y-4">
            <BentoStatStrip
              className="sm:grid-cols-3 xl:grid-cols-3"
              items={[
                { label: "Sucesso", value: successCount, icon: CheckCircle },
                { label: "Erros", value: errorCount, icon: XCircle },
                { label: "Executando", value: runningCount, icon: Play },
              ]}
            />

            {/* Filters */}
            <div className="filter-toolbar flex items-center gap-2 flex-wrap">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={execFilter} onValueChange={setExecFilter}>
                <SelectTrigger className="w-[140px] h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas categorias</SelectItem>
                  {Object.entries(categoryLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={execStatusFilter}
                onValueChange={setExecStatusFilter}
              >
                <SelectTrigger className="w-[130px] h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos status</SelectItem>
                  <SelectItem value="success">Sucesso</SelectItem>
                  <SelectItem value="error">Erro</SelectItem>
                  <SelectItem value="running">Executando</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Histórico de Execuções
                </CardTitle>
                <CardDescription>
                  Acompanhe as ações executadas pelos agentes ativos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {filteredExecutions.map((exec) => (
                    <div
                      key={exec.id}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-accent/50 transition-colors border border-transparent hover:border-border"
                    >
                      <div
                        className={cn(
                          "p-2 rounded-lg shrink-0",
                          exec.status === "success"
                            ? "bg-emerald-500/10 text-emerald-600"
                            : exec.status === "error"
                              ? "bg-red-500/10 text-red-600"
                              : "bg-blue-500/10 text-blue-600",
                        )}
                      >
                        {exec.status === "success" ? (
                          <CheckCircle className="h-4 w-4" />
                        ) : exec.status === "error" ? (
                          <XCircle className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4 animate-pulse" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{exec.action}</p>
                        <p className="text-xs text-muted-foreground">
                          {exec.agentName} • {exec.details}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {categoryLabels[exec.category as Agent["category"]] ||
                          exec.category}
                      </Badge>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-muted-foreground">
                          {exec.timestamp}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {exec.duration}
                        </p>
                      </div>
                      {exec.status === "error" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          aria-label="Tentar novamente"
                          title="Tentar novamente"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {filteredExecutions.length === 0 && (
                    <p className="text-center text-sm text-muted-foreground py-8">
                      Nenhuma execução encontrada
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="approvals" className="mt-6 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Ações aguardando aprovação humana
                </CardTitle>
                <CardDescription>
                  Ações críticas iniciadas por agentes que precisam da
                  confirmação de um responsável antes de executar.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {approvalItems.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-8">
                    Nenhuma aprovação pendente no momento.
                  </p>
                )}
                {approvalItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-3 rounded-xl border border-border"
                  >
                    <div
                      className={cn(
                        "p-2 rounded-lg shrink-0",
                        item.risk === "alto"
                          ? "bg-red-500/10 text-red-600"
                          : "bg-amber-500/10 text-amber-600",
                      )}
                    >
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{item.action}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.agent} • {item.requested}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="text-[10px] shrink-0 capitalize"
                    >
                      Risco {item.risk}
                    </Badge>
                    <Button variant="outline" size="sm" className="rounded-lg">
                      Rejeitar
                    </Button>
                    <Button size="sm" className="rounded-lg">
                      Aprovar
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Edit Agent Dialog */}
        <Dialog
          open={!!editingAgent}
          onOpenChange={(open) => !open && setEditingAgent(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Agente</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm({ ...editForm, description: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Agendamento</Label>
                  <Select
                    value={editForm.schedule}
                    onValueChange={(v) =>
                      setEditForm({ ...editForm, schedule: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Contínuo">Contínuo</SelectItem>
                      <SelectItem value="Diário">Diário</SelectItem>
                      <SelectItem value="Diário 08:00">Diário 08:00</SelectItem>
                      <SelectItem value="A cada 2h">A cada 2h</SelectItem>
                      <SelectItem value="A cada 6h">A cada 6h</SelectItem>
                      <SelectItem value="Semanal">Semanal</SelectItem>
                      <SelectItem value="Sob demanda">Sob demanda</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Máx. Tentativas</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={editForm.maxRetries}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        maxRetries: parseInt(e.target.value) || 1,
                      })
                    }
                  />
                </div>
              </div>
              <Button onClick={saveEdit} className="w-full">
                Salvar Alterações
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
