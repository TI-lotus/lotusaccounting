import { DashboardLayout } from "@/layouts/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Gift, DollarSign, Copy, Share2, TrendingUp, CheckCircle, MousePointerClick, Wallet } from "lucide-react";
import { toast } from "sonner";

const AffiliationProgram = () => {
  const affiliateCode = "LOTUS-ABC123";
  const affiliateLink = `https://lotuscontabilidade.com.br/ref/${affiliateCode}`;

  const stats = [
    { label: "Indicações", value: "12", icon: Users, change: "+3 este mês" },
    { label: "Conversões", value: "8", icon: CheckCircle, change: "67% taxa" },
    { label: "Comissões", value: "R$ 2.400", icon: DollarSign, change: "+R$ 600" },
  ];

  const referrals = [
    { name: "Maria Silva", date: "15 Jan 2026", status: "Ativo", commission: "R$ 300" },
    { name: "João Santos", date: "12 Jan 2026", status: "Ativo", commission: "R$ 300" },
    { name: "Ana Costa", date: "08 Jan 2026", status: "Pendente", commission: "-" },
    { name: "Carlos Lima", date: "02 Jan 2026", status: "Ativo", commission: "R$ 300" },
  ];

  const performance = [
    { label: "Cliques no link", value: "1.284", icon: MousePointerClick, change: "+18%" },
    { label: "Leads qualificados", value: "96", icon: Users, change: "+12" },
    { label: "Ganhos pendentes", value: "R$ 900", icon: Wallet, change: "3 conversões" },
    { label: "Ganhos pagos", value: "R$ 1.500", icon: DollarSign, change: "este mês" },
  ];

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado para a área de transferência!");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-semibold">Programa de Afiliados</h1>
          <p className="text-muted-foreground mt-1">
            Indique clientes e ganhe comissões recorrentes
          </p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-semibold mt-1">{stat.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{stat.change}</p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-secondary flex items-center justify-center">
                    <stat.icon className="h-6 w-6 text-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><TrendingUp className="h-5 w-5" />Dashboard de Performance</CardTitle>
            <CardDescription>Acompanhe conversões e ganhos do programa</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              {performance.map((item) => (
                <div key={item.label} className="rounded-xl border border-border p-4">
                  <item.icon className="h-5 w-5 text-gilver mb-3" />
                  <p className="text-sm text-muted-foreground">{item.label}</p>
                  <p className="text-xl font-semibold mt-1">{item.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{item.change}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Affiliate Link */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              Seu Link de Indicação
            </CardTitle>
            <CardDescription>
              Compartilhe seu link e ganhe R$ 300 por cada cliente convertido
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <Input value={affiliateLink} readOnly className="font-mono text-sm" />
              <Button variant="outline" onClick={() => copyToClipboard(affiliateLink)}>
                <Copy className="h-4 w-4 mr-2" />
                Copiar
              </Button>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Gift className="h-4 w-4" />
              <span>Código: <span className="font-mono font-medium text-foreground">{affiliateCode}</span></span>
            </div>
          </CardContent>
        </Card>

        {/* Commission Info */}
        <Card className="border-dashed">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-xl bg-secondary flex items-center justify-center">
                <TrendingUp className="h-7 w-7" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Como funciona?</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Você ganha R$ 300 de comissão para cada cliente que se cadastrar usando seu link 
                  e permanecer ativo por pelo menos 30 dias. As comissões são pagas mensalmente.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Referrals List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Suas Indicações</CardTitle>
            <CardDescription>Histórico de clientes indicados</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {referrals.map((referral, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-medium">{referral.name.charAt(0)}</span>
                    </div>
                    <div>
                      <p className="font-medium">{referral.name}</p>
                      <p className="text-sm text-muted-foreground">{referral.date}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        referral.status === "Ativo"
                          ? "bg-green-100 text-green-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {referral.status}
                    </span>
                    <span className="font-medium text-sm w-20 text-right">{referral.commission}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AffiliationProgram;
