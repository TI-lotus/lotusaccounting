import { DashboardLayout } from "@/layouts/DashboardLayout";
import { Check, Building2, Crown, Rocket, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  createBillingCheckout,
  getTenantSubscription,
  listBillingPlans,
  type BillingPlan,
  type TenantSubscription,
} from "@/services/commercialMvp";

const quoteUrl = "https://preview--lotus-website.lovable.app/orcamento";

const fallbackPlans = [
  {
    id: "starter", name: "Starter", description: "Ideal para autonomos e pequenas empresas.", price: "R$ 220", period: "/mês", icon: Zap,
    features: ["Ate 30 clientes ativos", "Ate 3 colaboradores", "Portal do cliente", "Tarefas, documentos e financeiro", "Suporte essencial"],
    action: "Comecar agora",
  },
  {
    id: "business", name: "Business", description: "Ideal para empresas em crescimento.", price: "R$ 450", period: "/mês", icon: Crown, popular: true,
    features: ["Ate 150 clientes ativos", "Ate 15 colaboradores", "SERPRO Consulta CNPJ", "Banco Inter conciliação", "Suporte prioritario"],
    action: "Comecar agora",
  },
  {
    id: "enterprise", name: "Enterprise", description: "Solucoes sob medida para organizacoes maiores.", price: "R$ 630", period: "/mês", icon: Building2,
    features: ["Tudo do plano Business", "CFO as a Service", "Paineis de business intelligence", "Orcamento e projecoes financeiras", "Suporte a auditorias e due diligence", "Atendimento prioritario"],
    action: "Falar com especialista",
  },
];

const lotusPlanPrices: Record<string, string> = {
  starter: "R$ 220",
  business: "R$ 450",
  enterprise: "R$ 630",
};

const formatPlanPrice = (plan?: BillingPlan) => {
  if (!plan) return null;
  return lotusPlanPrices[plan.id] ?? (plan.price_monthly_cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
};

const statusLabel: Record<TenantSubscription["status"], string> = {
  active: "Ativa",
  trialing: "Em teste",
  past_due: "Pagamento pendente",
  incomplete: "Checkout iniciado",
  canceled: "Cancelada",
  manual: "Manual",
};

const Upgrade = () => {
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [subscription, setSubscription] = useState<TenantSubscription | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([listBillingPlans(), getTenantSubscription()])
      .then(([planRows, subscriptionRow]) => {
        setPlans(planRows);
        setSubscription(subscriptionRow);
      })
      .catch(() => {
        toast.error("Não foi possível carregar a assinatura.");
      });
  }, []);

  const mergedPlans = useMemo(
    () =>
      fallbackPlans.map((plan) => ({
        ...plan,
        db: plans.find((item) => item.id === plan.id),
      })),
    [plans],
  );

  const startCheckout = async (planId: string) => {
    if (planId === "enterprise") {
      window.open(quoteUrl, "_blank", "noopener,noreferrer");
      return;
    }
    setLoadingPlan(planId);
    try {
      const checkout = await createBillingCheckout(planId);
      if (!checkout.checkoutUrl) throw new Error("Checkout sem URL retornada pelo Asaas.");
      window.location.href = checkout.checkoutUrl;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao iniciar checkout.");
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="text-center animate-fade-in">
          <Rocket className="mx-auto mb-4 h-5 w-5 text-gilver" aria-hidden="true" />
          <h1 className="text-[30px] font-normal tracking-[-0.035em]">Escolha o plano da plataforma</h1>
          <p className="mx-auto mt-2 max-w-xl text-muted-foreground">Assinatura comercial com checkout seguro via Asaas e liberação automática por webhook.</p>
          {subscription && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm">
              <span>Plano atual: {subscription.plan_id}</span>
              <Badge variant={subscription.status === "active" ? "default" : "secondary"}>
                {statusLabel[subscription.status]}
              </Badge>
            </div>
          )}
        </div>

        <div className="grid gap-px overflow-hidden rounded-2xl border border-border/70 bg-border/70 animate-fade-in md:grid-cols-3">
          {mergedPlans.map((plan) => {
            const Icon = plan.icon;
            const price = formatPlanPrice(plan.db) ?? plan.price;
            const current = subscription?.plan_id === plan.id;
            return <Card key={plan.id} className={cn("relative rounded-none border-0", plan.popular && "bg-gilver/5", current && "bg-primary text-primary-foreground")}>{plan.popular && !current && <div className="absolute right-5 top-5"><Badge className="bg-gilver text-[hsl(0,0%,9%)]">Mais popular</Badge></div>}{current && <div className="absolute right-5 top-5"><Badge className="bg-primary-foreground text-primary">Plano atual</Badge></div>}<CardHeader className="pb-2"><Icon className={cn("mb-5 h-5 w-5", current ? "text-primary-foreground" : "text-gilver")} aria-hidden="true" /><CardTitle className="text-xl">{plan.name}</CardTitle><CardDescription className={cn(current && "text-primary-foreground/80")}>{plan.db?.description ?? plan.description}</CardDescription></CardHeader><CardContent className="space-y-6"><div><span className={cn("font-semibold tracking-tight", plan.id === "enterprise" ? "text-2xl" : "text-4xl")}>{price}</span>{plan.period && <span className={cn(current ? "text-primary-foreground/75" : "text-muted-foreground")}>{plan.period}</span>}</div><ul className="space-y-3">{plan.features.map((feature) => <li key={feature} className="flex items-start gap-2 text-sm"><Check className={cn("mt-0.5 h-4 w-4 shrink-0", current ? "text-primary-foreground" : "text-gilver")} aria-hidden="true" />{feature}</li>)}</ul><Button className={cn("w-full rounded-xl", current && "bg-primary-foreground text-primary hover:bg-primary-foreground/90 disabled:opacity-100")} disabled={loadingPlan === plan.id || current} onClick={() => void startCheckout(plan.id)}>{current ? "Plano atual" : loadingPlan === plan.id ? "Abrindo checkout..." : plan.action}</Button></CardContent></Card>;
          })}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Upgrade;
