import { useState } from "react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Key, BarChart3, CreditCard, Clock, AlertCircle, Check, Copy, Eye, EyeOff, Plus, Trash2, Power, PowerOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Credential {
  id: string;
  name: string;
  key: string;
  secret?: string;
  token?: string;
  createdAt: string;
  lastUsed: string;
  active: boolean;
}

const integrationMeta: Record<string, {
  name: string;
  description: string;
  fields: { key: string; label: string; type: "text" | "password" }[];
  usage: { calls: number; limit: number; period: string };
}> = {
  "receita-federal": {
    name: "Receita Federal",
    description: "Consulta de situação cadastral, CNPJ e declarações",
    fields: [
      { key: "certificado", label: "Certificado Digital (Base64)", type: "password" },
      { key: "senha", label: "Senha do Certificado", type: "password" },
      { key: "cnpj_contabil", label: "CNPJ do Escritório", type: "text" },
    ],
    usage: { calls: 1240, limit: 5000, period: "Março 2026" },
  },
  "serpro": {
    name: "SERPRO",
    description: "Serviços de dados governamentais e certificação digital",
    fields: [
      { key: "consumer_key", label: "Consumer Key", type: "text" },
      { key: "consumer_secret", label: "Consumer Secret", type: "password" },
      { key: "token", label: "Token de Acesso", type: "password" },
    ],
    usage: { calls: 890, limit: 10000, period: "Março 2026" },
  },
  "cnpj-api": {
    name: "Consulta CNPJ",
    description: "API de consulta de dados cadastrais de empresas",
    fields: [
      { key: "api_key", label: "API Key", type: "password" },
    ],
    usage: { calls: 3400, limit: 50000, period: "Março 2026" },
  },
  "nfse": {
    name: "NFSe Municipal",
    description: "Emissão e consulta de Notas Fiscais de Serviço",
    fields: [
      { key: "usuario", label: "Usuário", type: "text" },
      { key: "senha", label: "Senha", type: "password" },
      { key: "inscricao_municipal", label: "Inscrição Municipal", type: "text" },
      { key: "token_municipio", label: "Token do Município", type: "password" },
    ],
    usage: { calls: 0, limit: 10000, period: "Março 2026" },
  },
  "certificado-a1": {
    name: "Certificado Digital A1",
    description: "Gerenciamento de certificados digitais para assinatura",
    fields: [
      { key: "certificado_pfx", label: "Certificado PFX (Base64)", type: "password" },
      { key: "senha_certificado", label: "Senha do Certificado", type: "password" },
    ],
    usage: { calls: 560, limit: 5000, period: "Março 2026" },
  },
  "sped": {
    name: "SPED Fiscal",
    description: "Integração com o Sistema Público de Escrituração Digital",
    fields: [
      { key: "token_sped", label: "Token SPED", type: "password" },
      { key: "cnpj", label: "CNPJ Responsável", type: "text" },
    ],
    usage: { calls: 120, limit: 2000, period: "Março 2026" },
  },
  "esocial": {
    name: "eSocial",
    description: "Transmissão de obrigações trabalhistas e previdenciárias",
    fields: [
      { key: "certificado", label: "Certificado Digital", type: "password" },
      { key: "ambiente", label: "Ambiente (1=Produção, 2=Homologação)", type: "text" },
    ],
    usage: { calls: 0, limit: 5000, period: "Março 2026" },
  },
  "simples-nacional": {
    name: "Simples Nacional",
    description: "Consulta e cálculo de DAS e obrigações do Simples",
    fields: [
      { key: "codigo_acesso", label: "Código de Acesso", type: "password" },
      { key: "cnpj", label: "CNPJ", type: "text" },
      { key: "cpf_responsavel", label: "CPF do Responsável", type: "text" },
    ],
    usage: { calls: 2100, limit: 10000, period: "Março 2026" },
  },
  "caixa": {
    name: "Caixa Econômica",
    description: "Integração bancária para conciliação e pagamentos",
    fields: [
      { key: "client_id", label: "Client ID", type: "text" },
      { key: "client_secret", label: "Client Secret", type: "password" },
      { key: "agencia", label: "Agência", type: "text" },
      { key: "conta", label: "Conta", type: "text" },
    ],
    usage: { calls: 0, limit: 20000, period: "Março 2026" },
  },
};

const IntegrationSettings = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const integration = integrationMeta[id || ""];

  const [credentials, setCredentials] = useState<Credential[]>([
    {
      id: "cred-1",
      name: "Credencial Principal",
      key: "••••••••••••xxxx",
      secret: "••••••••••••yyyy",
      createdAt: "15 Jan, 2026",
      lastUsed: "Hoje",
      active: true,
    },
  ]);

  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [newCredDialogOpen, setNewCredDialogOpen] = useState(false);
  const [newCredName, setNewCredName] = useState("");
  const [isConnected, setIsConnected] = useState(
    ["receita-federal", "serpro", "cnpj-api", "sped", "simples-nacional"].includes(id || "")
  );

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

  const usagePercent = (integration.usage.calls / integration.usage.limit) * 100;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado para a área de transferência!");
  };

  const handleSaveFields = () => {
    toast.success("Configurações salvas com sucesso!");
  };

  const handleConnect = () => {
    setIsConnected(true);
    toast.success(`${integration.name} conectado com sucesso!`);
  };

  const handleDisconnect = () => {
    setIsConnected(false);
    toast.success(`${integration.name} desconectado.`);
  };

  const handleCreateCredential = () => {
    if (!newCredName) {
      toast.error("Informe um nome para a credencial");
      return;
    }
    const newCred: Credential = {
      id: `cred-${Date.now()}`,
      name: newCredName,
      key: `key_${Math.random().toString(36).slice(2, 14)}`,
      secret: `sec_${Math.random().toString(36).slice(2, 14)}`,
      createdAt: new Date().toLocaleDateString("pt-BR"),
      lastUsed: "Nunca",
      active: true,
    };
    setCredentials([...credentials, newCred]);
    setNewCredName("");
    setNewCredDialogOpen(false);
    toast.success("Credencial criada com sucesso!");
  };

  const handleDeleteCredential = (credId: string) => {
    setCredentials(credentials.filter(c => c.id !== credId));
    toast.success("Credencial removida!");
  };

  const handleToggleCredential = (credId: string) => {
    setCredentials(credentials.map(c => c.id === credId ? { ...c, active: !c.active } : c));
    toast.success("Status da credencial atualizado!");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 animate-fade-in">
          <Button variant="ghost" size="icon" onClick={() => navigate("/integrations")} className="rounded-xl">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-semibold tracking-tight">{integration.name}</h1>
            <p className="text-muted-foreground">{integration.description}</p>
          </div>
          <div className="flex gap-2">
            {isConnected ? (
              <>
                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                  <Check className="h-3 w-3 mr-1" />
                  Conectado
                </Badge>
                <Button variant="outline" className="rounded-xl gap-2 text-destructive" onClick={handleDisconnect}>
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

        <Tabs defaultValue="config" className="animate-fade-in">
          <TabsList className="grid w-full max-w-lg grid-cols-3">
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
                          type={field.type === "password" && !showSecret[field.key] ? "password" : "text"}
                          value={fieldValues[field.key] || ""}
                          onChange={(e) => setFieldValues({ ...fieldValues, [field.key]: e.target.value })}
                          placeholder={`Insira ${field.label.toLowerCase()}`}
                          className="font-mono text-sm rounded-xl pr-10"
                        />
                        {field.type === "password" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full rounded-r-xl"
                            onClick={() => setShowSecret({ ...showSecret, [field.key]: !showSecret[field.key] })}
                          >
                            {showSecret[field.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        )}
                      </div>
                      <Button variant="outline" size="icon" className="rounded-xl" onClick={() => copyToClipboard(fieldValues[field.key] || "")}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                <Separator className="my-4" />

                <div className="flex gap-2">
                  <Button onClick={handleSaveFields} className="rounded-xl">Salvar Configuração</Button>
                  <Button variant="outline" className="rounded-xl">Testar Conexão</Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-amber-500/20 bg-amber-500/5">
              <CardContent className="flex items-start gap-3 pt-6">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Mantenha suas chaves seguras</p>
                  <p className="text-sm text-muted-foreground">
                    Nunca compartilhe suas chaves secretas. Se suspeitar de comprometimento, gere novas credenciais imediatamente.
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
                <p className="text-sm text-muted-foreground">Gerencie suas credenciais de API</p>
              </div>
              <Dialog open={newCredDialogOpen} onOpenChange={setNewCredDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="rounded-xl gap-2">
                    <Plus className="h-4 w-4" />
                    Nova Credencial
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Criar Nova Credencial</DialogTitle>
                    <DialogDescription>Uma nova chave de API será gerada automaticamente.</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label>Nome da Credencial</Label>
                      <Input value={newCredName} onChange={(e) => setNewCredName(e.target.value)} placeholder="Ex: Produção, Homologação" className="rounded-xl" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setNewCredDialogOpen(false)} className="rounded-xl">Cancelar</Button>
                    <Button onClick={handleCreateCredential} className="rounded-xl">Criar</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="space-y-4">
              {credentials.map((cred) => (
                <Card key={cred.id} className={cn(!cred.active && "opacity-60")}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="font-semibold">{cred.name}</p>
                        <p className="text-xs text-muted-foreground">Criada em {cred.createdAt} • Último uso: {cred.lastUsed}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={cred.active ? "default" : "secondary"}>
                          {cred.active ? "Ativa" : "Inativa"}
                        </Badge>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label className="text-xs w-12">Key</Label>
                        <Input value={cred.key} readOnly className="font-mono text-xs h-8 rounded-lg bg-muted" />
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => copyToClipboard(cred.key)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      {cred.secret && (
                        <div className="flex items-center gap-2">
                          <Label className="text-xs w-12">Secret</Label>
                          <Input
                            value={showSecret[cred.id] ? cred.secret : "••••••••••••"}
                            readOnly
                            className="font-mono text-xs h-8 rounded-lg bg-muted"
                          />
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setShowSecret({ ...showSecret, [cred.id]: !showSecret[cred.id] })}>
                            {showSecret[cred.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => copyToClipboard(cred.secret!)}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Button variant="outline" size="sm" className="rounded-lg gap-1" onClick={() => handleToggleCredential(cred.id)}>
                        {cred.active ? <PowerOff className="h-3 w-3" /> : <Power className="h-3 w-3" />}
                        {cred.active ? "Desativar" : "Ativar"}
                      </Button>
                      <Button variant="outline" size="sm" className="rounded-lg gap-1 text-destructive" onClick={() => handleDeleteCredential(cred.id)}>
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
                    <span className="text-sm text-muted-foreground">Chamadas API</span>
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-2xl font-semibold">{integration.usage.calls.toLocaleString("pt-BR")}</p>
                  <p className="text-sm text-muted-foreground">de {integration.usage.limit.toLocaleString("pt-BR")}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Período</span>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-2xl font-semibold">{integration.usage.period}</p>
                  <p className="text-sm text-muted-foreground">Ciclo atual</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Utilização</span>
                    <span className="text-sm font-medium">{usagePercent.toFixed(1)}%</span>
                  </div>
                  <Progress value={usagePercent} className="h-2" />
                  <p className="text-sm text-muted-foreground mt-2">
                    {(integration.usage.limit - integration.usage.calls).toLocaleString("pt-BR")} chamadas restantes
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Histórico de Uso</CardTitle>
                <CardDescription>Chamadas de API nos últimos 30 dias</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[200px] flex items-end justify-between gap-1">
                  {Array.from({ length: 30 }).map((_, i) => {
                    const height = Math.random() * 100 + 20;
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
