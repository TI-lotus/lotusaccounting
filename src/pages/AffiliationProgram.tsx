import { DashboardLayout } from "@/layouts/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Gift, DollarSign, Copy, Share2, TrendingUp, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const AffiliationProgram = () => {
  const affiliateCode = "LOTUS-ABC123";
  const affiliateLink = `https://lotuscontabilidade.com.br/ref/${affiliateCode}`;

  const stats = [
    { label: "Indicações", value: "12", icon: Users, change: "+3 este mês" },
    { label: "Conversões", value: "8", icon: CheckCircle, change: "67% taxa" },
    { label: "Comissões", value: "R$ 2.160", icon: DollarSign, change: "+R$ 360" },
  ];

  const referrals = [
    { name: "Maria Silva", date: "15 Jan 2026", status: "Ativo", commission: "R$ 80" },
    { name: "João Santos", date: "12 Jan 2026", status: "Ativo", commission: "R$ 160" },
    { name: "Ana Costa", date: "08 Jan 2026", status: "Pendente", commission: "-" },
    { name: "Carlos Lima", date: "02 Jan 2026", status: "Ativo", commission: "R$ 280" },
  ];

  const performance = [
    { label: "1ª indicação", indicacoes: 1, comissao: 80, cliques: 180, leads: 12 },
    { label: "2ª indicação", indicacoes: 2, comissao: 160, cliques: 320, leads: 25 },
    { label: "3ª indicação", indicacoes: 3, comissao: 200, cliques: 470, leads: 39 },
    { label: "4ª indicação", indicacoes: 4, comissao: 280, cliques: 690, leads: 58 },
    { label: "5ª+ indicação", indicacoes: 5, comissao: 360, cliques: 940, leads: 82 },
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
            <CardDescription>Comissão progressiva por indicação convertida</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={performance} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="affiliateCommissions" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `R$ ${value}`} />
                  <Tooltip formatter={(value) => [`R$ ${value}`, "Comissão"]} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                  <Area type="monotone" dataKey="comissao" stroke="hsl(var(--primary))" strokeWidth={3} fill="url(#affiliateCommissions)" />
                </AreaChart>
              </ResponsiveContainer>
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
              Compartilhe seu link e ganhe de R$ 80 a R$ 360 por cliente convertido
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
                  A comissão cresce por sequência: R$ 80 na primeira indicação, R$ 160 na segunda,
                  R$ 200 na terceira, R$ 280 na quarta e R$ 360 a partir da quinta.
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
