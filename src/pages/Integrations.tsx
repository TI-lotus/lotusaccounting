import { DashboardLayout } from "@/layouts/DashboardLayout";
import { Plug, Check, ExternalLink, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const integrations = [
  { id: "stripe", name: "Stripe", description: "Payment processing and invoicing", connected: true, icon: "💳" },
  { id: "quickbooks", name: "QuickBooks", description: "Accounting sync and reconciliation", connected: true, icon: "📊" },
  { id: "plaid", name: "Plaid", description: "Bank account connections", connected: true, icon: "🏦" },
  { id: "slack", name: "Slack", description: "Team notifications and alerts", connected: false, icon: "💬" },
  { id: "xero", name: "Xero", description: "Alternative accounting platform", connected: false, icon: "📈" },
  { id: "paypal", name: "PayPal", description: "Payment gateway integration", connected: false, icon: "💰" },
];

const Integrations = () => {
  const navigate = useNavigate();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="animate-fade-in">
          <h1 className="text-2xl font-semibold tracking-tight">Integrações</h1>
          <p className="text-muted-foreground">Conecte serviços terceiros para otimizar seu fluxo de trabalho</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {integrations.map((integration, index) => (
            <div
              key={integration.id}
              className={cn(
                "glass rounded-2xl p-6 transition-all duration-300 hover:shadow-soft-lg animate-fade-in",
                integration.connected && "ring-1 ring-gilver/50"
              )}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="text-3xl">{integration.icon}</div>
                {integration.connected ? (
                  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                    <Check className="h-3 w-3 mr-1" />
                    Conectado
                  </Badge>
                ) : (
                  <Badge variant="secondary">Disponível</Badge>
                )}
              </div>
              <h3 className="font-semibold mb-1">{integration.name}</h3>
              <p className="text-sm text-muted-foreground mb-4">{integration.description}</p>
              <div className="flex gap-2">
                <Button
                  variant={integration.connected ? "outline" : "default"}
                  className="flex-1 rounded-xl gap-2"
                  onClick={() => !integration.connected && navigate(`/integrations/${integration.id}`)}
                >
                  {integration.connected ? (
                    <>
                      <ExternalLink className="h-4 w-4" />
                      Gerenciar
                    </>
                  ) : (
                    <>
                      <Plug className="h-4 w-4" />
                      Conectar
                    </>
                  )}
                </Button>
                {integration.connected && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-xl"
                    onClick={() => navigate(`/integrations/${integration.id}`)}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Integrations;
