import { DashboardLayout } from "@/layouts/DashboardLayout";
import { Plug, Check, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const integrations = [
  { id: 1, name: "Stripe", description: "Payment processing and invoicing", connected: true, icon: "💳" },
  { id: 2, name: "QuickBooks", description: "Accounting sync and reconciliation", connected: true, icon: "📊" },
  { id: 3, name: "Plaid", description: "Bank account connections", connected: true, icon: "🏦" },
  { id: 4, name: "Slack", description: "Team notifications and alerts", connected: false, icon: "💬" },
  { id: 5, name: "Xero", description: "Alternative accounting platform", connected: false, icon: "📈" },
  { id: 6, name: "PayPal", description: "Payment gateway integration", connected: false, icon: "💰" },
];

const Integrations = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="animate-fade-in">
          <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
          <p className="text-muted-foreground">Connect third-party services to streamline your workflow</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {integrations.map((integration, index) => (
            <div
              key={integration.id}
              className={cn(
                "glass rounded-2xl p-6 transition-all duration-300 hover:shadow-soft-lg animate-fade-in",
                integration.connected && "ring-1 ring-primary/20"
              )}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="text-3xl">{integration.icon}</div>
                {integration.connected ? (
                  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                    <Check className="h-3 w-3 mr-1" />
                    Connected
                  </Badge>
                ) : (
                  <Badge variant="secondary">Available</Badge>
                )}
              </div>
              <h3 className="font-semibold mb-1">{integration.name}</h3>
              <p className="text-sm text-muted-foreground mb-4">{integration.description}</p>
              <Button
                variant={integration.connected ? "outline" : "default"}
                className="w-full rounded-xl gap-2"
              >
                {integration.connected ? (
                  <>
                    <ExternalLink className="h-4 w-4" />
                    Manage
                  </>
                ) : (
                  <>
                    <Plug className="h-4 w-4" />
                    Connect
                  </>
                )}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Integrations;
