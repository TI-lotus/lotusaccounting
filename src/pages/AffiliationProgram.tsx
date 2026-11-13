import { DashboardLayout } from "@/layouts/DashboardLayout";
import { Gift, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const AffiliationProgram = () => (
  <DashboardLayout>
      <div className="mx-auto w-full max-w-[1100px] space-y-8 animate-fade-in">
      <div>
          <Gift className="mb-3 h-5 w-5 text-gilver" aria-hidden="true" title="Programa de afiliados" />
          <h1 className="text-[30px] font-normal tracking-[-0.035em]">Programa de afiliados</h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-6 text-muted-foreground">Indicações e comissões serão exibidas aqui quando o programa estiver habilitado.</p>
      </div>
      <Card className="page-section">
        <CardHeader className="px-0 pt-0">
          <CardTitle className="text-lg">Sem dados de afiliados ainda</CardTitle>
          <CardDescription>Esta área não mostra códigos, comissões, clientes ou métricas simuladas.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-start gap-3 border-t border-border px-0 pt-5 text-sm leading-6 text-muted-foreground"><Users className="mt-0.5 h-4 w-4 shrink-0 text-gilver" aria-hidden="true" />O módulo será liberado somente quando cadastro, rastreamento e regras de comissão estiverem conectados a dados reais.</CardContent>
      </Card>
    </div>
  </DashboardLayout>
);

export default AffiliationProgram;
