import { useState } from "react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  FileText, HeadphonesIcon, BarChart3, Mail, Bell, Calculator, FileSearch, Users, CreditCard,
  Calendar, AlertTriangle, TrendingUp, MessageSquare, FileCheck, Clock, Zap, Play, CheckCircle, XCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Agent {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  category: "invoices" | "support" | "reports" | "finance" | "automation";
  enabled: boolean;
  status: "active" | "idle" | "learning";
  actionsToday: number;
}

interface Execution {
  id: string;
  agentName: string;
  action: string;
  status: "success" | "error" | "running";
  timestamp: string;
  duration: string;
  details: string;
}

const initialAgents: Agent[] = [
  { id: "invoice-generator", name: "Gerador de Faturas", description: "Cria faturas automaticamente baseado em contratos e serviços recorrentes", icon: FileText, category: "invoices", enabled: true, status: "active", actionsToday: 23 },
  { id: "invoice-reminder", name: "Lembrete de Vencimento", description: "Envia lembretes automáticos para clientes com faturas próximas do vencimento", icon: Bell, category: "invoices", enabled: true, status: "active", actionsToday: 45 },
  { id: "invoice-reconciliation", name: "Conciliação de Pagamentos", description: "Reconcilia pagamentos recebidos com faturas emitidas automaticamente", icon: FileCheck, category: "invoices", enabled: false, status: "idle", actionsToday: 0 },
  { id: "support-chat", name: "Atendimento Inteligente", description: "Responde dúvidas frequentes dos clientes via chat automaticamente", icon: MessageSquare, category: "support", enabled: true, status: "active", actionsToday: 156 },
  { id: "support-tickets", name: "Triagem de Tickets", description: "Classifica e prioriza tickets de suporte automaticamente", icon: HeadphonesIcon, category: "support", enabled: true, status: "active", actionsToday: 34 },
  { id: "support-escalation", name: "Escalação Automática", description: "Escala tickets críticos para especialistas quando necessário", icon: AlertTriangle, category: "support", enabled: false, status: "idle", actionsToday: 0 },
  { id: "report-daily", name: "Relatório Diário", description: "Gera e envia relatórios diários de performance financeira", icon: BarChart3, category: "reports", enabled: true, status: "active", actionsToday: 1 },
  { id: "report-insights", name: "Insights de Negócio", description: "Analisa dados e identifica tendências e oportunidades", icon: TrendingUp, category: "reports", enabled: true, status: "learning", actionsToday: 12 },
  { id: "report-compliance", name: "Verificação de Compliance", description: "Verifica conformidade com regulamentações fiscais automaticamente", icon: FileSearch, category: "reports", enabled: false, status: "idle", actionsToday: 0 },
  { id: "finance-forecast", name: "Previsão de Fluxo de Caixa", description: "Projeta fluxo de caixa baseado em histórico e contratos", icon: Calculator, category: "finance", enabled: true, status: "active", actionsToday: 8 },
  { id: "finance-payment", name: "Processamento de Pagamentos", description: "Processa e valida pagamentos recebidos automaticamente", icon: CreditCard, category: "finance", enabled: true, status: "active", actionsToday: 67 },
  { id: "finance-overdue", name: "Gestão de Inadimplência", description: "Identifica e gerencia contas inadimplentes com ações automáticas", icon: Clock, category: "finance", enabled: false, status: "idle", actionsToday: 0 },
  { id: "auto-email", name: "Email Marketing", description: "Envia campanhas de email personalizadas para clientes", icon: Mail, category: "automation", enabled: false, status: "idle", actionsToday: 0 },
  { id: "auto-scheduling", name: "Agendamento Inteligente", description: "Agenda reuniões e compromissos automaticamente", icon: Calendar, category: "automation", enabled: true, status: "active", actionsToday: 5 },
  { id: "auto-onboarding", name: "Onboarding de Clientes", description: "Automatiza o processo de cadastro e boas-vindas de novos clientes", icon: Users, category: "automation", enabled: true, status: "learning", actionsToday: 3 },
  { id: "auto-workflow", name: "Automação de Workflows", description: "Executa fluxos de trabalho complexos baseados em gatilhos", icon: Zap, category: "automation", enabled: true, status: "active", actionsToday: 89 },
];

const mockExecutions: Execution[] = [
  { id: "e1", agentName: "Atendimento Inteligente", action: "Respondeu dúvida sobre DAS", status: "success", timestamp: "Hoje, 14:32", duration: "2s", details: "Cliente: Acme Corporation" },
  { id: "e2", agentName: "Automação de Workflows", action: "Classificou documento NF-e", status: "success", timestamp: "Hoje, 14:28", duration: "1.5s", details: "Arquivo: nfe_acme_mar2026.pdf" },
  { id: "e3", agentName: "Lembrete de Vencimento", action: "Enviou lembrete por email", status: "success", timestamp: "Hoje, 14:15", duration: "3s", details: "3 clientes notificados" },
  { id: "e4", agentName: "Processamento de Pagamentos", action: "Conciliação bancária", status: "running", timestamp: "Hoje, 14:10", duration: "em execução", details: "12 transações pendentes" },
  { id: "e5", agentName: "Relatório Diário", action: "Gerou relatório financeiro", status: "success", timestamp: "Hoje, 08:00", duration: "15s", details: "Período: 31 Mar 2026" },
  { id: "e6", agentName: "Insights de Negócio", action: "Análise de tendência", status: "error", timestamp: "Hoje, 07:45", duration: "8s", details: "Erro: dados insuficientes para Q2" },
  { id: "e7", agentName: "Gerador de Faturas", action: "Criou 5 faturas recorrentes", status: "success", timestamp: "Hoje, 07:00", duration: "4s", details: "Total: R$ 34.500" },
  { id: "e8", agentName: "Onboarding de Clientes", action: "Envio de boas-vindas", status: "success", timestamp: "Ontem, 16:00", duration: "2s", details: "Cliente: Nova Empresa Ltda" },
];

const categoryLabels: Record<Agent["category"], string> = {
  invoices: "Faturas",
  support: "Suporte",
  reports: "Relatórios",
  finance: "Finanças",
  automation: "Automação",
};

const statusConfig: Record<Agent["status"], { label: string; className: string }> = {
  active: { label: "Ativo", className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  idle: { label: "Inativo", className: "bg-muted text-muted-foreground" },
  learning: { label: "Aprendendo", className: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
};

export default function Agents() {
  const [agents, setAgents] = useState<Agent[]>(initialAgents);

  const toggleAgent = (id: string) => {
    setAgents((prev) =>
      prev.map((agent) =>
        agent.id === id
          ? { ...agent, enabled: !agent.enabled, status: !agent.enabled ? "active" : "idle", actionsToday: !agent.enabled ? agent.actionsToday : 0 }
          : agent
      )
    );
  };

  const groupedAgents = agents.reduce((acc, agent) => {
    if (!acc[agent.category]) acc[agent.category] = [];
    acc[agent.category].push(agent);
    return acc;
  }, {} as Record<Agent["category"], Agent[]>);

  const totalActive = agents.filter((a) => a.enabled).length;
  const totalActions = agents.reduce((sum, a) => sum + a.actionsToday, 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Agentes de IA</h1>
            <p className="text-muted-foreground">Gerencie automações inteligentes para sua contabilidade</p>
          </div>
          <div className="flex gap-4">
            <Card className="px-4 py-2">
              <div className="text-sm text-muted-foreground">Agentes Ativos</div>
              <div className="text-2xl font-semibold">{totalActive}</div>
            </Card>
            <Card className="px-4 py-2">
              <div className="text-sm text-muted-foreground">Ações Hoje</div>
              <div className="text-2xl font-semibold">{totalActions}</div>
            </Card>
          </div>
        </div>

        <Tabs defaultValue="agents">
          <TabsList>
            <TabsTrigger value="agents" className="gap-2"><Zap className="h-4 w-4" />Agentes</TabsTrigger>
            <TabsTrigger value="executions" className="gap-2"><Play className="h-4 w-4" />Execuções</TabsTrigger>
          </TabsList>

          <TabsContent value="agents" className="space-y-6 mt-6">
            {(Object.keys(groupedAgents) as Agent["category"][]).map((category) => (
              <div key={category} className="space-y-4">
                <h2 className="text-lg font-medium">{categoryLabels[category]}</h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {groupedAgents[category].map((agent) => {
                    const Icon = agent.icon;
                    const status = statusConfig[agent.status];
                    return (
                      <Card
                        key={agent.id}
                        className={cn(
                          "transition-all duration-200",
                          agent.enabled ? "border-primary/20 bg-card" : "border-border bg-muted/30"
                        )}
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className={cn("p-2 rounded-lg", agent.enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                                <Icon className="h-5 w-5" />
                              </div>
                              <div className="space-y-1">
                                <CardTitle className="text-base">{agent.name}</CardTitle>
                                <Badge variant="secondary" className={status.className}>{status.label}</Badge>
                              </div>
                            </div>
                            <Switch checked={agent.enabled} onCheckedChange={() => toggleAgent(agent.id)} />
                          </div>
                        </CardHeader>
                        <CardContent>
                          <CardDescription className="text-sm">{agent.description}</CardDescription>
                          {agent.enabled && agent.actionsToday > 0 && (
                            <div className="mt-3 pt-3 border-t border-border">
                              <span className="text-xs text-muted-foreground">{agent.actionsToday} ações realizadas hoje</span>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="executions" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Execuções</CardTitle>
                <CardDescription>Acompanhe as ações executadas pelos agentes ativos</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {mockExecutions.map((exec) => (
                    <div key={exec.id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-accent/50 transition-colors border border-transparent hover:border-border">
                      <div className={cn(
                        "p-2 rounded-lg",
                        exec.status === "success" ? "bg-emerald-500/10 text-emerald-600" :
                        exec.status === "error" ? "bg-red-500/10 text-red-600" :
                        "bg-blue-500/10 text-blue-600"
                      )}>
                        {exec.status === "success" ? <CheckCircle className="h-4 w-4" /> :
                         exec.status === "error" ? <XCircle className="h-4 w-4" /> :
                         <Play className="h-4 w-4 animate-pulse" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{exec.action}</p>
                        <p className="text-xs text-muted-foreground">{exec.agentName} • {exec.details}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-muted-foreground">{exec.timestamp}</p>
                        <p className="text-xs text-muted-foreground">{exec.duration}</p>
                      </div>
                      <Badge variant={exec.status === "success" ? "default" : exec.status === "error" ? "destructive" : "secondary"}>
                        {exec.status === "success" ? "Sucesso" : exec.status === "error" ? "Erro" : "Executando"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
