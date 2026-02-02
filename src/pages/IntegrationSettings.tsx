import { useState } from "react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Key, BarChart3, CreditCard, Clock, AlertCircle, Check, Copy, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";

const integrationData: Record<string, {
  name: string;
  icon: string;
  apiKeyLabel: string;
  secretKeyLabel?: string;
  webhookUrl?: string;
  usage: { calls: number; limit: number; period: string };
  billing: { plan: string; price: string; nextBilling: string; history: Array<{ date: string; amount: string; status: string }> };
}> = {
  stripe: {
    name: "Stripe",
    icon: "💳",
    apiKeyLabel: "Publishable Key",
    secretKeyLabel: "Secret Key",
    webhookUrl: "https://api.lotus.com/webhooks/stripe",
    usage: { calls: 15420, limit: 100000, period: "Janeiro 2026" },
    billing: {
      plan: "Business",
      price: "R$ 299/mês",
      nextBilling: "01 Fev 2026",
      history: [
        { date: "01 Jan 2026", amount: "R$ 299,00", status: "Pago" },
        { date: "01 Dez 2025", amount: "R$ 299,00", status: "Pago" },
        { date: "01 Nov 2025", amount: "R$ 299,00", status: "Pago" },
      ]
    }
  },
  quickbooks: {
    name: "QuickBooks",
    icon: "📊",
    apiKeyLabel: "Client ID",
    secretKeyLabel: "Client Secret",
    usage: { calls: 8750, limit: 50000, period: "Janeiro 2026" },
    billing: {
      plan: "Pro",
      price: "R$ 199/mês",
      nextBilling: "15 Fev 2026",
      history: [
        { date: "15 Jan 2026", amount: "R$ 199,00", status: "Pago" },
        { date: "15 Dez 2025", amount: "R$ 199,00", status: "Pago" },
        { date: "15 Nov 2025", amount: "R$ 199,00", status: "Pago" },
      ]
    }
  },
  plaid: {
    name: "Plaid",
    icon: "🏦",
    apiKeyLabel: "Client ID",
    secretKeyLabel: "Secret",
    usage: { calls: 3200, limit: 10000, period: "Janeiro 2026" },
    billing: {
      plan: "Growth",
      price: "R$ 499/mês",
      nextBilling: "10 Fev 2026",
      history: [
        { date: "10 Jan 2026", amount: "R$ 499,00", status: "Pago" },
        { date: "10 Dez 2025", amount: "R$ 499,00", status: "Pago" },
        { date: "10 Nov 2025", amount: "R$ 499,00", status: "Pago" },
      ]
    }
  }
};

const IntegrationSettings = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [apiKey, setApiKey] = useState("pk_live_xxxxxxxxxxxxxxxxxxxxxxxx");
  const [secretKey, setSecretKey] = useState("sk_live_xxxxxxxxxxxxxxxxxxxxxxxx");

  const integration = integrationData[id || "stripe"];

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
    toast({ title: "Copiado!", description: "Valor copiado para a área de transferência." });
  };

  const handleSaveKeys = () => {
    toast({ title: "Salvo!", description: "Chaves de API atualizadas com sucesso." });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4 animate-fade-in">
          <Button variant="ghost" size="icon" onClick={() => navigate("/integrations")} className="rounded-xl">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{integration.icon}</span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{integration.name}</h1>
              <p className="text-muted-foreground">Configurações e gerenciamento da integração</p>
            </div>
          </div>
          <Badge className="ml-auto bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
            <Check className="h-3 w-3 mr-1" />
            Conectado
          </Badge>
        </div>

        <Tabs defaultValue="api-keys" className="animate-fade-in">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="api-keys" className="gap-2">
              <Key className="h-4 w-4" />
              API Keys
            </TabsTrigger>
            <TabsTrigger value="usage" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Uso
            </TabsTrigger>
            <TabsTrigger value="billing" className="gap-2">
              <CreditCard className="h-4 w-4" />
              Faturamento
            </TabsTrigger>
          </TabsList>

          <TabsContent value="api-keys" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  Chaves de API
                </CardTitle>
                <CardDescription>
                  Configure suas chaves de API para autenticar com {integration.name}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="apiKey">{integration.apiKeyLabel}</Label>
                  <div className="flex gap-2">
                    <Input
                      id="apiKey"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="font-mono text-sm"
                    />
                    <Button variant="outline" size="icon" onClick={() => copyToClipboard(apiKey)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {integration.secretKeyLabel && (
                  <div className="space-y-2">
                    <Label htmlFor="secretKey">{integration.secretKeyLabel}</Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          id="secretKey"
                          type={showSecretKey ? "text" : "password"}
                          value={secretKey}
                          onChange={(e) => setSecretKey(e.target.value)}
                          className="font-mono text-sm pr-10"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full"
                          onClick={() => setShowSecretKey(!showSecretKey)}
                        >
                          {showSecretKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                      <Button variant="outline" size="icon" onClick={() => copyToClipboard(secretKey)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {integration.webhookUrl && (
                  <div className="space-y-2">
                    <Label>Webhook URL</Label>
                    <div className="flex gap-2">
                      <Input
                        value={integration.webhookUrl}
                        readOnly
                        className="font-mono text-sm bg-muted"
                      />
                      <Button variant="outline" size="icon" onClick={() => copyToClipboard(integration.webhookUrl!)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Configure este URL no painel do {integration.name} para receber webhooks
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-4 pt-4 border-t">
                  <Button onClick={handleSaveKeys}>Salvar Alterações</Button>
                  <Button variant="outline">Gerar Novas Chaves</Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-amber-500/20 bg-amber-500/5">
              <CardContent className="flex items-start gap-3 pt-6">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Mantenha suas chaves seguras</p>
                  <p className="text-sm text-muted-foreground">
                    Nunca compartilhe suas chaves secretas. Se suspeitar de comprometimento, gere novas chaves imediatamente.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="usage" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Chamadas API</span>
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-2xl font-semibold">{integration.usage.calls.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">de {integration.usage.limit.toLocaleString()}</p>
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
                    {(integration.usage.limit - integration.usage.calls).toLocaleString()} chamadas restantes
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
                  <span>1 Jan</span>
                  <span>15 Jan</span>
                  <span>30 Jan</span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="billing" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Plano Atual</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-gilver/20 border border-gilver/30">
                    <div>
                      <p className="font-semibold text-lg">{integration.billing.plan}</p>
                      <p className="text-muted-foreground">{integration.billing.price}</p>
                    </div>
                    <Badge variant="secondary">Ativo</Badge>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>Próxima cobrança: {integration.billing.nextBilling}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1">Alterar Plano</Button>
                    <Button variant="outline" className="flex-1">Cancelar</Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Método de Pagamento</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4 p-4 rounded-xl border">
                    <div className="h-10 w-14 bg-primary rounded-md flex items-center justify-center text-primary-foreground text-xs font-bold">
                      VISA
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">•••• •••• •••• 4242</p>
                      <p className="text-sm text-muted-foreground">Expira 12/26</p>
                    </div>
                    <Badge>Padrão</Badge>
                  </div>
                  <Button variant="outline" className="w-full">Adicionar Novo Cartão</Button>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Histórico de Faturas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {integration.billing.history.map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-xl hover:bg-accent/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-gilver/20 flex items-center justify-center">
                          <CreditCard className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">{item.date}</p>
                          <p className="text-sm text-muted-foreground">{integration.name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{item.amount}</p>
                        <Badge variant="secondary" className="text-emerald-600">
                          {item.status}
                        </Badge>
                      </div>
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
};

export default IntegrationSettings;
