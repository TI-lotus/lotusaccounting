import { DashboardLayout } from "@/layouts/DashboardLayout";
import { Check, Crown, Zap, Building2, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const plans = [
  {
    id: "starter",
    name: "Starter",
    description: "Ideal para pequenas empresas",
    price: "R$ 99",
    period: "/mês",
    icon: Zap,
    features: [
      "Até 50 clientes",
      "100 documentos/mês",
      "1 usuário",
      "Suporte por email",
      "Relatórios básicos",
    ],
    current: false,
  },
  {
    id: "professional",
    name: "Professional",
    description: "Para empresas em crescimento",
    price: "R$ 249",
    period: "/mês",
    icon: Crown,
    features: [
      "Até 200 clientes",
      "500 documentos/mês",
      "5 usuários",
      "Suporte prioritário",
      "Relatórios avançados",
      "Integrações ilimitadas",
      "API Access",
    ],
    current: true,
    popular: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "Para grandes organizações",
    price: "R$ 599",
    period: "/mês",
    icon: Building2,
    features: [
      "Clientes ilimitados",
      "Documentos ilimitados",
      "Usuários ilimitados",
      "Suporte 24/7",
      "Relatórios personalizados",
      "Integrações ilimitadas",
      "API Access",
      "Dedicated Account Manager",
      "SLA garantido",
    ],
    current: false,
  },
];

const Upgrade = () => {
  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="text-center animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gilver/30 text-foreground mb-4">
            <Rocket className="h-4 w-4" />
            <span className="text-sm font-medium">Escolha o plano ideal para você</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Upgrade seu Plano</h1>
          <p className="text-muted-foreground mt-2 max-w-md mx-auto">
            Desbloqueie recursos avançados e escale seu negócio com nossos planos premium
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
          {plans.map((plan, index) => {
            const Icon = plan.icon;
            return (
              <Card 
                key={plan.id} 
                className={cn(
                  "relative transition-all duration-300 hover:shadow-lg",
                  plan.popular && "ring-2 ring-gilver-dark shadow-lg scale-[1.02]",
                  plan.current && "bg-gilver/10"
                )}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground">
                      Mais Popular
                    </Badge>
                  </div>
                )}
                <CardHeader className="text-center pb-2">
                  <div className={cn(
                    "mx-auto h-14 w-14 rounded-2xl flex items-center justify-center mb-4",
                    plan.popular ? "bg-gilver" : "bg-muted"
                  )}>
                    <Icon className={cn("h-7 w-7", plan.popular ? "text-foreground" : "text-muted-foreground")} />
                  </div>
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="text-center">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>

                  <ul className="space-y-3">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <div className="h-5 w-5 rounded-full bg-gilver/30 flex items-center justify-center shrink-0">
                          <Check className="h-3 w-3 text-foreground" />
                        </div>
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <Button 
                    className={cn(
                      "w-full rounded-xl",
                      plan.current && "bg-gilver text-foreground hover:bg-gilver-dark"
                    )}
                    variant={plan.current ? "secondary" : "default"}
                    disabled={plan.current}
                  >
                    {plan.current ? "Plano Atual" : "Selecionar Plano"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="text-center text-sm text-muted-foreground animate-fade-in">
          <p>Todos os planos incluem 14 dias de teste grátis. Cancele quando quiser.</p>
          <p className="mt-1">
            Precisa de um plano personalizado?{" "}
            <Button variant="link" className="p-0 h-auto">Entre em contato</Button>
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Upgrade;
