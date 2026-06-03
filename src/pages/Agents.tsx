import { useState } from "react";

import { DashboardLayout } from "@/layouts/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { 
  FileText, HeadphonesIcon, BarChart3, Mail, Bell, Calculator, FileSearch, Users, CreditCard,
  Calendar, AlertTriangle, TrendingUp, MessageSquare, FileCheck, Clock, Zap, Play, CheckCircle, XCircle,
  Pencil, Filter, RotateCcw, Plus, Trash2, LayoutGrid, List
} from "lucide-react";
import { cn } from "@/lib/utils";
import { WorkflowFlow } from "@/components/WorkflowFlow";

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

const initialAgents: Agent[] = [
  { id: "invoice-generator", name: "Gerador de Faturas", description: "Cria faturas automaticamente baseado em contratos e serviços recorrentes", icon: FileText, category: "invoices", enabled: true, status: "active", actionsToday: 23, schedule: "Diário", maxRetries: 3 },
  { id: "invoice-reminder", name: "Lembrete de Vencimento", description: "Envia lembretes automáticos para clientes com faturas próximas do vencimento", icon: Bell, category: "invoices", enabled: true, status: "active", actionsToday: 45, schedule: "Diário", maxRetries: 2 },
  { id: "invoice-reconciliation", name: "Conciliação de Pagamentos", description: "Reconcilia pagamentos recebidos com faturas emitidas automaticamente", icon: FileCheck, category: "invoices", enabled: false, status: "idle", actionsToday: 0, schedule: "A cada 6h", maxRetries: 5 },
  { id: "support-chat", name: "Atendimento Inteligente", description: "Responde dúvidas frequentes dos clientes via chat automaticamente", icon: MessageSquare, category: "support", enabled: true, status: "active", actionsToday: 156, schedule: "Contínuo", maxRetries: 1 },
  { id: "support-tickets", name: "Triagem de Tickets", description: "Classifica e prioriza tickets de suporte automaticamente", icon: HeadphonesIcon, category: "support", enabled: true, status: "active", actionsToday: 34, schedule: "Contínuo", maxRetries: 2 },
  { id: "support-escalation", name: "Escalação Automática", description: "Escala tickets críticos para especialistas quando necessário", icon: AlertTriangle, category: "support", enabled: false, status: "idle", actionsToday: 0, schedule: "Contínuo", maxRetries: 1 },
  { id: "report-daily", name: "Relatório Diário", description: "Gera e envia relatórios diários de performance financeira", icon: BarChart3, category: "reports", enabled: true, status: "active", actionsToday: 1, schedule: "Diário 08:00", maxRetries: 3 },
  { id: "report-insights", name: "Insights de Negócio", description: "Analisa dados e identifica tendências e oportunidades", icon: TrendingUp, category: "reports", enabled: true, status: "learning", actionsToday: 12, schedule: "A cada 2h", maxRetries: 2 },
  { id: "report-compliance", name: "Verificação de Compliance", description: "Verifica conformidade com regulamentações fiscais automaticamente", icon: FileSearch, category: "reports", enabled: false, status: "idle", actionsToday: 0, schedule: "Semanal", maxRetries: 3 },
  { id: "finance-forecast", name: "Previsão de Fluxo de Caixa", description: "Projeta fluxo de caixa baseado em histórico e contratos", icon: Calculator, category: "finance", enabled: true, status: "active", actionsToday: 8, schedule: "Diário", maxRetries: 3 },
  { id: "finance-payment", name: "Processamento de Pagamentos", description: "Processa e valida pagamentos recebidos automaticamente", icon: CreditCard, category: "finance", enabled: true, status: "active", actionsToday: 67, schedule: "Contínuo", maxRetries: 5 },
  { id: "finance-overdue", name: "Gestão de Inadimplência", description: "Identifica e gerencia contas inadimplentes com ações automáticas", icon: Clock, category: "finance", enabled: false, status: "idle", actionsToday: 0, schedule: "Diário", maxRetries: 3 },
  { id: "auto-email", name: "Email Marketing", description: "Envia campanhas de email personalizadas para clientes", icon: Mail, category: "automation", enabled: false, status: "idle", actionsToday: 0, schedule: "Sob demanda", maxRetries: 2 },
  { id: "auto-scheduling", name: "Agendamento Inteligente", description: "Agenda reuniões e compromissos automaticamente", icon: Calendar, category: "automation", enabled: true, status: "active", actionsToday: 5, schedule: "Contínuo", maxRetries: 2 },
  { id: "auto-onboarding", name: "Onboarding de Clientes", description: "Automatiza o processo de cadastro e boas-vindas de novos clientes", icon: Users, category: "automation", enabled: true, status: "learning", actionsToday: 3, schedule: "Sob demanda", maxRetries: 3 },
  { id: "auto-workflow", name: "Automação de Workflows", description: "Executa fluxos de trabalho complexos baseados em gatilhos", icon: Zap, category: "automation", enabled: true, status: "active", actionsToday: 89, schedule: "Contínuo", maxRetries: 5 },
];

const mockExecutions: Execution[] = [
  { id: "e1", agentId: "support-chat", agentName: "Atendimento Inteligente", action: "Respondeu dúvida sobre DAS", status: "success", timestamp: "Hoje, 14:32", duration: "2s", details: "Cliente: Acme Corporation", category: "support" },
  { id: "e2", agentId: "auto-workflow", agentName: "Automação de Workflows", action: "Classificou documento NF-e", status: "success", timestamp: "Hoje, 14:28", duration: "1.5s", details: "Arquivo: nfe_acme_mar2026.pdf", category: "automation" },
  { id: "e3", agentId: "invoice-reminder", agentName: "Lembrete de Vencimento", action: "Enviou lembrete por email", status: "success", timestamp: "Hoje, 14:15", duration: "3s", details: "3 clientes notificados", category: "invoices" },
  { id: "e4", agentId: "finance-payment", agentName: "Processamento de Pagamentos", action: "Conciliação bancária", status: "running", timestamp: "Hoje, 14:10", duration: "em execução", details: "12 transações pendentes", category: "finance" },
  { id: "e5", agentId: "report-daily", agentName: "Relatório Diário", action: "Gerou relatório financeiro", status: "success", timestamp: "Hoje, 08:00", duration: "15s", details: "Período: 31 Mar 2026", category: "reports" },
  { id: "e6", agentId: "report-insights", agentName: "Insights de Negócio", action: "Análise de tendência", status: "error", timestamp: "Hoje, 07:45", duration: "8s", details: "Erro: dados insuficientes para Q2", category: "reports" },
  { id: "e7", agentId: "invoice-generator", agentName: "Gerador de Faturas", action: "Criou 5 faturas recorrentes", status: "success", timestamp: "Hoje, 07:00", duration: "4s", details: "Total: R$ 34.500", category: "invoices" },
  { id: "e8", agentId: "auto-onboarding", agentName: "Onboarding de Clientes", action: "Envio de boas-vindas", status: "success", timestamp: "Ontem, 16:00", duration: "2s", details: "Cliente: Nova Empresa Ltda", category: "automation" },
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
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [editForm, setEditForm] = useState({ name: "", description: "", schedule: "", maxRetries: 3 });
  const [execFilter, setExecFilter] = useState<string>("all");
  const [execStatusFilter, setExecStatusFilter] = useState<string>("all");
  const [agentView, setAgentView] = useState<"grid" | "list">("grid");



  const toggleAgent = (id: string) => {
    setAgents((prev) =>
      prev.map((agent) =>
        agent.id === id
          ? { ...agent, enabled: !agent.enabled, status: !agent.enabled ? "active" : "idle", actionsToday: !agent.enabled ? agent.actionsToday : 0 }
          : agent
      )
    );
  };

  const openEdit = (agent: Agent) => {
    setEditingAgent(agent);
    setEditForm({ name: agent.name, description: agent.description, schedule: agent.schedule || "", maxRetries: agent.maxRetries || 3 });
  };

  const saveEdit = () => {
    if (!editingAgent) return;
    setAgents((prev) =>
      prev.map((a) => a.id === editingAgent.id ? { ...a, name: editForm.name, description: editForm.description, schedule: editForm.schedule, maxRetries: editForm.maxRetries } : a)
    );
    setEditingAgent(null);
  };

  const groupedAgents = agents.reduce((acc, agent) => {
    if (!acc[agent.category]) acc[agent.category] = [];
    acc[agent.category].push(agent);
    return acc;
  }, {} as Record<Agent["category"], Agent[]>);

  const totalActive = agents.filter((a) => a.enabled).length;
  const totalActions = agents.reduce((sum, a) => sum + a.actionsToday, 0);

  const filteredExecutions = mockExecutions.filter((e) => {
    const catMatch = execFilter === "all" || e.category === execFilter;
    const statusMatch = execStatusFilter === "all" || e.status === execStatusFilter;
    return catMatch && statusMatch;
  });

  const successCount = mockExecutions.filter(e => e.status === "success").length;
  const errorCount = mockExecutions.filter(e => e.status === "error").length;
  const runningCount = mockExecutions.filter(e => e.status === "running").length;

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
            <TabsTrigger value="workflow" className="gap-2"><FileSearch className="h-4 w-4" />Workflow</TabsTrigger>
            <TabsTrigger value="executions" className="gap-2"><Play className="h-4 w-4" />Execuções</TabsTrigger>
          </TabsList>

          <TabsContent value="agents" className="space-y-6 mt-6">
            <div className="flex justify-end">
              <div className="flex rounded-xl border border-border bg-card p-1">
                <Button variant={agentView === "grid" ? "default" : "ghost"} size="sm" className="rounded-lg" onClick={() => setAgentView("grid")}><LayoutGrid className="h-4 w-4" />Grade</Button>
                <Button variant={agentView === "list" ? "default" : "ghost"} size="sm" className="rounded-lg" onClick={() => setAgentView("list")}><List className="h-4 w-4" />Lista</Button>
              </div>
            </div>
            {(Object.keys(groupedAgents) as Agent["category"][]).map((category) => (
              <div key={category} className="space-y-4">
                <h2 className="text-lg font-medium">{categoryLabels[category]}</h2>
                <div className={cn("grid gap-4", agentView === "grid" ? "md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1")}>
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
                          <CardHeader className={cn("pb-3", agentView === "list" && "pb-4")}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className={cn("p-2 rounded-lg", agent.enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                                <Icon className="h-5 w-5" />
                              </div>
                              <div className="space-y-1">
                                <CardTitle className="text-base">{agent.name}</CardTitle>
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary" className={status.className}>{status.label}</Badge>
                                  {agent.schedule && <span className="text-[10px] text-muted-foreground">{agent.schedule}</span>}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(agent)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Switch checked={agent.enabled} onCheckedChange={() => toggleAgent(agent.id)} />
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className={cn(agentView === "list" && "pt-0")}>
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

          <TabsContent value="workflow" className="mt-6">
            <WorkflowFlow />
          </TabsContent>

          <TabsContent value="executions" className="mt-6 space-y-4">
            {/* Execution stats */}
            <div className="grid grid-cols-3 gap-4">
              <Card className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                  <span className="text-sm text-muted-foreground">Sucesso</span>
                </div>
                <div className="text-xl font-semibold mt-1">{successCount}</div>
              </Card>
              <Card className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-muted-foreground">Erros</span>
                </div>
                <div className="text-xl font-semibold mt-1">{errorCount}</div>
              </Card>
              <Card className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <Play className="h-4 w-4 text-blue-500" />
                  <span className="text-sm text-muted-foreground">Executando</span>
                </div>
                <div className="text-xl font-semibold mt-1">{runningCount}</div>
              </Card>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={execFilter} onValueChange={setExecFilter}>
                <SelectTrigger className="w-[140px] h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas categorias</SelectItem>
                  {Object.entries(categoryLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={execStatusFilter} onValueChange={setExecStatusFilter}>
                <SelectTrigger className="w-[130px] h-8 text-sm"><SelectValue /></SelectTrigger>
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
                <CardTitle className="text-base">Histórico de Execuções</CardTitle>
                <CardDescription>Acompanhe as ações executadas pelos agentes ativos</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {filteredExecutions.map((exec) => (
                    <div key={exec.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-accent/50 transition-colors border border-transparent hover:border-border">
                      <div className={cn(
                        "p-2 rounded-lg shrink-0",
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
                      <Badge variant="outline" className="text-[10px] shrink-0">{categoryLabels[exec.category as Agent["category"]] || exec.category}</Badge>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-muted-foreground">{exec.timestamp}</p>
                        <p className="text-xs text-muted-foreground">{exec.duration}</p>
                      </div>
                      {exec.status === "error" && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {filteredExecutions.length === 0 && (
                    <p className="text-center text-sm text-muted-foreground py-8">Nenhuma execução encontrada</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Edit Agent Dialog */}
        <Dialog open={!!editingAgent} onOpenChange={(open) => !open && setEditingAgent(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Agente</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Agendamento</Label>
                  <Select value={editForm.schedule} onValueChange={(v) => setEditForm({ ...editForm, schedule: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
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
                  <Input type="number" min={1} max={10} value={editForm.maxRetries} onChange={(e) => setEditForm({ ...editForm, maxRetries: parseInt(e.target.value) || 1 })} />
                </div>
              </div>
              <Button onClick={saveEdit} className="w-full">Salvar Alterações</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
