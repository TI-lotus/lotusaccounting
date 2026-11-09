import { DashboardLayout } from "@/layouts/DashboardLayout";
import { Gift, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const AffiliationProgram = () => (
  <DashboardLayout>
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Programa de Afiliados</h1>
        <p className="mt-1 text-muted-foreground">Indicacoes e comissoes serao exibidas aqui quando o programa estiver habilitado.</p>
      </div>
      <Card className="glass border-border/70">
        <CardHeader>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gilver/15 text-gilver"><Gift className="h-5 w-5" /></div>
          <CardTitle className="pt-3 text-lg">Sem dados de afiliacao ainda</CardTitle>
          <CardDescription>Esta area nao mostra mais codigos, comissoes, clientes ou metricas simuladas.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-3 border-t border-border pt-5 text-sm text-muted-foreground"><Users className="h-4 w-4 shrink-0" />O modulo sera liberado somente quando cadastro, rastreamento e regras de comissao estiverem conectados a dados reais.</CardContent>
      </Card>
    </div>
  </DashboardLayout>
);

export default AffiliationProgram;
