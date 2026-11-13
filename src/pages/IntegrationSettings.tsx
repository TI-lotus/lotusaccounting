import { useEffect, useMemo, useState } from "react";
import type { DragEvent } from "react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Key,
  BarChart3,
  CreditCard,
  Clock,
  AlertCircle,
  Check,
  Copy,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Power,
  PowerOff,
  Play,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useData } from "@/contexts/DataContext";
import { getIntegrationCatalogItem } from "@/lib/integrationCatalog";
import type { Json } from "@/integrations/supabase/types";
import { getConnectionHealthLabel, readCredentialMetadata } from "@/services/integrations/integrationConnections";
import { revokeIntegrationCredentials, storeIntegrationCredential } from "@/services/integrations/integrationCredentials";
import { enqueueHealthCheckJob } from "@/services/integrations/integrationJobs";
import type { PublicCredentialMetadata } from "@/services/integrations/types";

type WorkflowNode = { id: string; label: string; x: number; y: number };

type Credential = PublicCredentialMetadata;

const IntegrationSettings = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { integrationConnections, tenantId, upsertIntegrationConnection, refresh } =
    useData();
  const integration = getIntegrationCatalogItem(id);
  const connection = integrationConnections.find(
    (item) => item.integration_id === id,
  );

  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [newCredDialogOpen, setNewCredDialogOpen] = useState(false);
  const [newCredName, setNewCredName] = useState("");
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [workflowNodes, setWorkflowNodes] = useState<WorkflowNode[]>([
    { id: "trigger", label: "Trigger", x: 8, y: 42 },
    { id: "auth", label: "Autenticação", x: 32, y: 22 },
    { id: "request", label: "Consulta API", x: 56, y: 42 },
    { id: "output", label: "Retorno", x: 80, y: 62 },
  ]);
  const isConnected = connection?.status === "connected";
  const usage = useMemo(() => {
    const value = connection?.usage;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const data = value as Record<string, Json | undefined>;
      return {
        calls: Number(data.calls ?? 0),
        limit: Number(data.limit ?? integration?.usageLimit ?? 0),
        period: String(data.period ?? "Ciclo atual"),
      };
    }
    return {
      calls: 0,
      limit: integration?.usageLimit ?? 0,
      period: "Ciclo atual",
    };
  }, [connection?.usage, integration?.usageLimit]);

  useEffect(() => {
    const config = connection?.config;
    if (config && typeof config === "object" && !Array.isArray(config)) {
      const record = config as Record<string, Json | undefined>;
      setFieldValues(
        Object.fromEntries(
          (integration?.fields ?? []).map((field) => [
            field.key,
            field.type === "password"
              ? ""
              : String(
                  (record.fields as Record<string, Json | undefined>)?.[
                    field.key
                  ] ?? "",
                ),
          ]),
        ),
      );
      if (Array.isArray(record.workflowNodes)) {
        setWorkflowNodes(record.workflowNodes as unknown as WorkflowNode[]);
      }
    }

    setCredentials(readCredentialMetadata(connection?.credentials));
  }, [connection?.config, connection?.credentials, integration?.fields]);

  const persistConnection = async (updates: {
    status?: string;
    fields?: Record<string, string>;
    credentials?: Credential[];
    workflowNodes?: WorkflowNode[];
  }) => {
    if (!id || !integration) return;
    const currentConfig =
      connection?.config &&
      typeof connection.config === "object" &&
      !Array.isArray(connection.config)
        ? (connection.config as Record<string, Json | undefined>)
        : {};
    const nextConfig = {
      ...currentConfig,
      fields: Object.fromEntries(
        Object.entries(updates.fields ?? fieldValues).filter(([key]) => {
          const field = integration.fields.find((item) => item.key === key);
          return field?.type !== "password";
        }),
      ),
      secretFields:
        updates.fields === undefined
          ? (currentConfig.secretFields ?? {})
          : Object.fromEntries(
              integration.fields
                .filter((field) => field.type === "password")
                .map((field) => [
                  field.key,
                  {
                    configured: Boolean(updates.fields?.[field.key]),
                    updatedAt: new Date().toISOString(),
                    storedBy: "edge-function",
                  },
                ]),
            ),
      workflowNodes: updates.workflowNodes ?? workflowNodes,
    };

    return upsertIntegrationConnection(id, {
      status: updates.status ?? (isConnected ? "connected" : "disconnected"),
      account_label: integration.name,
      provider: id,
      config: nextConfig as Json,
      credentials: (updates.credentials ?? credentials) as unknown as Json,
      usage: {
        calls: usage.calls,
        limit: usage.limit,
        period: usage.period,
      } as Json,
    });
  };

  const addWorkflowNode = () => {
    setWorkflowNodes((nodes) => [
      ...nodes,
      {
        id: `node-${Date.now()}`,
        label: `Novo node ${nodes.length + 1}`,
        x: 50,
        y: 50,
      },
    ]);
  };

  const deleteWorkflowNode = (nodeId: string) => {
    setWorkflowNodes((nodes) => nodes.filter((node) => node.id !== nodeId));
  };

  const handleNodeDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const nodeId = event.dataTransfer.getData("node-id");
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.min(
      92,
      Math.max(8, ((event.clientX - rect.left) / rect.width) * 100),
    );
    const y = Math.min(
      88,
      Math.max(12, ((event.clientY - rect.top) / rect.height) * 100),
    );
    setWorkflowNodes((nodes) =>
      nodes.map((node) => (node.id === nodeId ? { ...node, x, y } : node)),
    );
  };

  const handleSaveWorkflow = async () => {
    if (!await persistConnection({ workflowNodes })) return;
    toast.success("Workflow salvo com sucesso!");
  };

  if (!integration) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Integração não encontrada</p>
          <Button variant="link" onClick={() => navigate("/integrations")}>
            Voltar para Integrações
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const usagePercent = usage.limit > 0 ? (usage.calls / usage.limit) * 100 : 0;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado para a área de transferência!");
  };

  const handleSaveFields = async () => {
    if (!id) return;

    const publicFields = Object.fromEntries(
      integration.fields
        .filter((field) => field.type !== "password")
        .map((field) => [field.key, fieldValues[field.key] ?? ""]),
    );
    const secretFields = Object.fromEntries(
      integration.fields
        .filter((field) => field.type === "password")
        .map((field) => [field.key, fieldValues[field.key] ?? ""])
        .filter(([, value]) => value.trim().length > 0),
    );

    try {
      if (Object.keys(secretFields).length) {
        await storeIntegrationCredential({
          provider: id,
          integrationId: id,
          connectionId: connection?.id ?? null,
          accountLabel: integration.name,
          accountName: integration.name,
          publicFields,
          secretFields,
        });
        setFieldValues((current) => ({
          ...current,
          ...Object.fromEntries(Object.keys(secretFields).map((key) => [key, ""])),
        }));
        await refresh();
        toast.success("Credenciais salvas com segurança.");
        return;
      }

      if (!await persistConnection({ fields: fieldValues })) return;
      toast.success("Configurações salvas com sucesso!");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro desconhecido";
      toast.error("Erro ao salvar credenciais: " + message);
    }
  };

  const handleConnect = async () => {
    if (!await persistConnection({ status: "pending" })) return;
    toast.info(`${integration.name} aguardando validação de conexão.`);
  };

  const handleDisconnect = async () => {
    if (!await persistConnection({ status: "disconnected" })) return;
    toast.success(`${integration.name} desconectado.`);
  };

  const handleTestConnection = async () => {
    if (!tenantId || !id) {
      toast.error("Tenant não encontrado para testar a integração");
      return;
    }
    try {
      const savedConnection =
        connection ??
        (await upsertIntegrationConnection(id, {
          provider: id,
          status: "pending",
          account_label: integration.name,
        }));

      await enqueueHealthCheckJob({
        tenantId,
        connectionId: savedConnection?.id ?? null,
        provider: id,
      });
      toast.success("Teste de conexão enfileirado.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro desconhecido";
      toast.error("Erro ao enfileirar teste: " + message);
    }
  };

  const handleCreateCredential = () => {
    setNewCredName("");
    setNewCredDialogOpen(false);
    toast.info("Cadastre os campos secretos na aba Configurações para gravar uma credencial real.");
  };

  const handleDeleteCredential = async () => {
    if (!connection?.id) {
      toast.error("Não há credencial persistida para remover.");
      return;
    }
    try {
      await revokeIntegrationCredentials(connection.id);
      setCredentials([]);
      await refresh();
      toast.success("Credenciais revogadas e conexão desconectada.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "erro desconhecido";
      toast.error("Não foi possível revogar as credenciais: " + message);
    }
  };

  const handleToggleCredential = () => {
    toast.info("Para alterar uma credencial, substitua os campos secretos na aba Configurações.");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="page-header flex items-center gap-4 animate-fade-in">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/integrations")}
            className="rounded-xl"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              {integration.name}
            </h1>
            <p className="text-muted-foreground">{integration.description}</p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>Provider: {connection?.provider ?? id}</span>
              <span>
                Saúde: {getConnectionHealthLabel(connection?.status)}
              </span>
              <span>
                Último sync:{" "}
                {connection?.last_sync_at
                  ? new Date(connection.last_sync_at).toLocaleString("pt-BR")
                  : "pendente"}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            {isConnected ? (
              <>
                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                  <Check className="h-3 w-3 mr-1" />
                  Conectado
                </Badge>
                <Button
                  variant="outline"
                  className="rounded-xl gap-2 text-destructive"
                  onClick={handleDisconnect}
                >
                  <PowerOff className="h-4 w-4" />
                  Desconectar
                </Button>
              </>
            ) : (
              <Button className="rounded-xl gap-2" onClick={handleConnect}>
                <Power className="h-4 w-4" />
                Conectar
              </Button>
            )}
          </div>
        </div>

        <Tabs defaultValue="workflow" className="animate-fade-in">
          <TabsList className="grid w-full max-w-2xl grid-cols-4 segmented-tabs">
            <TabsTrigger value="workflow" className="gap-2">
              <Play className="h-4 w-4" />
              Workflow
            </TabsTrigger>
            <TabsTrigger value="config" className="gap-2">
              <Key className="h-4 w-4" />
              Configuração
            </TabsTrigger>
            <TabsTrigger value="credentials" className="gap-2">
              <CreditCard className="h-4 w-4" />
              Credenciais
            </TabsTrigger>
            <TabsTrigger value="usage" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Uso
            </TabsTrigger>
          </TabsList>

          <TabsContent value="workflow" className="space-y-4 mt-6">
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                className="rounded-xl gap-2"
                onClick={addWorkflowNode}
              >
                <Plus className="h-4 w-4" />
                Adicionar node
              </Button>
              <Button
                variant="outline"
                className="rounded-xl gap-2"
                onClick={handleSaveWorkflow}
              >
                <Save className="h-4 w-4" />
                Salvar alterações
              </Button>
              <Button className="rounded-xl gap-2">
                <Play className="h-4 w-4" />
                Executar
              </Button>
            </div>
            <div
              className="relative h-[460px] overflow-hidden rounded-2xl border border-border/70 bg-card/90"
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleNodeDrop}
              style={{
                backgroundImage:
                  "radial-gradient(hsl(var(--muted-foreground) / 0.25) 1px, transparent 1px)",
                backgroundSize: "18px 18px",
              }}
            >
              <svg
                className="absolute inset-0 h-full w-full"
                aria-hidden="true"
              >
                {workflowNodes.slice(0, -1).map((node, index) => {
                  const next = workflowNodes[index + 1];
                  return (
                    <line
                      key={node.id}
                      x1={`${node.x}%`}
                      y1={`${node.y}%`}
                      x2={`${next.x}%`}
                      y2={`${next.y}%`}
                      stroke="hsl(var(--primary))"
                      strokeWidth="2"
                      strokeDasharray="6 6"
                    />
                  );
                })}
              </svg>
              {workflowNodes.map((node) => (
                <div
                  key={node.id}
                  draggable
                  onDragStart={(event) =>
                    event.dataTransfer.setData("node-id", node.id)
                  }
                  className="absolute w-36 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-2xl border border-border/80 bg-card p-4 text-left shadow-soft transition-[border-color,box-shadow,transform] hover:border-foreground/30 hover:ring-2 hover:ring-primary/30 active:cursor-grabbing"
                  style={{ left: `${node.x}%`, top: `${node.y}%` }}
                >
                  <button
                    className="absolute right-1 top-1 rounded-lg p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => deleteWorkflowNode(node.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    className="text-left"
                    onClick={() => setSelectedNode(node.label)}
                  >
                    <p className="font-medium text-sm">{node.label}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Clique para editar
                    </p>
                  </button>
                </div>
              ))}
            </div>
            <Dialog
              open={!!selectedNode}
              onOpenChange={(open) => !open && setSelectedNode(null)}
            >
              <DialogContent className="sm:max-w-[520px] rounded-2xl">
                <DialogHeader>
                  <DialogTitle>{selectedNode}</DialogTitle>
                  <DialogDescription>
                    Configure os campos e o payload personalizado deste node.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-2">
                  <div className="grid gap-2">
                    <Label>Nome do node</Label>
                    <Input
                      defaultValue={selectedNode ?? ""}
                      className="rounded-xl"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Endpoint / ação</Label>
                    <Input
                      placeholder="https://api.exemplo.com/recurso"
                      className="rounded-xl"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>JSON personalizado</Label>
                    <Textarea
                      className="min-h-32 rounded-xl font-mono text-sm"
                      defaultValue={'{\n  "cnpj": "{{cliente.cnpj}}"\n}'}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    className="rounded-xl"
                    onClick={() => {
                      setSelectedNode(null);
                      void handleSaveWorkflow();
                    }}
                  >
                    Salvar alterações
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* Config Tab */}
          <TabsContent value="config" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  Chaves e Tokens
                </CardTitle>
                <CardDescription>
                  Configure as credenciais de acesso para {integration.name}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {integration.fields.map((field) => (
                  <div key={field.key} className="space-y-2">
                    <Label>{field.label}</Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          type={
                            field.type === "password" && !showSecret[field.key]
                              ? "password"
                              : "text"
                          }
                          value={fieldValues[field.key] || ""}
                          onChange={(e) =>
                            setFieldValues({
                              ...fieldValues,
                              [field.key]: e.target.value,
                            })
                          }
                          placeholder={`Insira ${field.label.toLowerCase()}`}
                          className="font-mono text-sm rounded-xl pr-10"
                        />
                        {field.type === "password" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full rounded-r-xl"
                            onClick={() =>
                              setShowSecret({
                                ...showSecret,
                                [field.key]: !showSecret[field.key],
                              })
                            }
                          >
                            {showSecret[field.key] ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="icon"
                        className="rounded-xl"
                        onClick={() =>
                          copyToClipboard(fieldValues[field.key] || "")
                        }
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                <Separator className="my-4" />

                <div className="flex gap-2">
                  <Button onClick={handleSaveFields} className="rounded-xl">
                    Salvar Configuração
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    onClick={handleTestConnection}
                  >
                    Testar Conexão
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-amber-500/20 bg-amber-500/5">
              <CardContent className="flex items-start gap-3 pt-6">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Mantenha suas chaves seguras</p>
                  <p className="text-sm text-muted-foreground">
                    Nunca compartilhe suas chaves secretas. Se suspeitar de
                    comprometimento, gere novas credenciais imediatamente.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Credentials Tab */}
          <TabsContent value="credentials" className="space-y-6 mt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Credenciais Ativas</h3>
                <p className="text-sm text-muted-foreground">
                  Gerencie suas credenciais de API
                </p>
              </div>
              <Dialog
                open={newCredDialogOpen}
                onOpenChange={setNewCredDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button className="rounded-xl gap-2">
                    <Plus className="h-4 w-4" />
                    Nova Credencial
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Criar Nova Credencial</DialogTitle>
                    <DialogDescription>
                      Registre a credencial na interface; o segredo real deve
                      ser salvo pelo backend seguro da integração.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label>Nome da Credencial</Label>
                      <Input
                        value={newCredName}
                        onChange={(e) => setNewCredName(e.target.value)}
                        placeholder="Ex: Produção, Homologação"
                        className="rounded-xl"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setNewCredDialogOpen(false)}
                      className="rounded-xl"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleCreateCredential}
                      className="rounded-xl"
                    >
                      Criar
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="space-y-4">
              {credentials.map((cred) => (
                <Card
                  key={cred.id}
                  className={cn(!cred.active && "opacity-60")}
                >
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="font-semibold">{cred.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Criada em {cred.createdAt} • Último uso:{" "}
                          {cred.lastUsed}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={cred.active ? "default" : "secondary"}>
                          {cred.active ? "Ativa" : "Inativa"}
                        </Badge>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label className="text-xs w-20">Referência</Label>
                        <Input
                          value={cred.keyHint}
                          readOnly
                          className="font-mono text-xs h-8 rounded-lg bg-muted"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg"
                          onClick={() => copyToClipboard(cred.keyHint)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Segredos reais são gravados somente por Edge Function
                        com service role.
                      </p>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-lg gap-1"
                        onClick={handleToggleCredential}
                      >
                        {cred.active ? (
                          <PowerOff className="h-3 w-3" />
                        ) : (
                          <Power className="h-3 w-3" />
                        )}
                        {cred.active ? "Desativar" : "Ativar"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-lg gap-1 text-destructive"
                        onClick={handleDeleteCredential}
                      >
                        <Trash2 className="h-3 w-3" />
                        Remover
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Usage Tab */}
          <TabsContent value="usage" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">
                      Chamadas API
                    </span>
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-2xl font-semibold">
                    {usage.calls.toLocaleString("pt-BR")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    de {usage.limit.toLocaleString("pt-BR")}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">
                      Período
                    </span>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-2xl font-semibold">{usage.period}</p>
                  <p className="text-sm text-muted-foreground">Ciclo atual</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">
                      Utilização
                    </span>
                    <span className="text-sm font-medium">
                      {usagePercent.toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={usagePercent} className="h-2" />
                  <p className="text-sm text-muted-foreground mt-2">
                    {Math.max(usage.limit - usage.calls, 0).toLocaleString(
                      "pt-BR",
                    )}{" "}
                    chamadas restantes
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Histórico de Uso</CardTitle>
                <CardDescription>
                  Chamadas de API nos últimos 30 dias
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[200px] flex items-end justify-between gap-1">
                  {Array.from({ length: 30 }).map((_, i) => {
                    const height = 24 + ((i * 17 + usage.calls) % 72);
                    return (
                      <div
                        key={i}
                        className="flex-1 bg-gilver/60 hover:bg-gilver rounded-t transition-colors"
                        style={{ height: `${height}%` }}
                      />
                    );
                  })}
                </div>
                <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                  <span>1 Mar</span>
                  <span>15 Mar</span>
                  <span>31 Mar</span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default IntegrationSettings;
