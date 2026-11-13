import { DashboardLayout } from "@/layouts/DashboardLayout";
import { WorkflowFlow } from "@/components/WorkflowFlow";
import { Card, CardContent } from "@/components/ui/card";

const Workflows = () => (
  <DashboardLayout>
      <div className="mx-auto w-full max-w-[1280px] space-y-8">
      <div>
          <h1 className="text-[30px] font-normal tracking-[-0.035em]">Workflows</h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-6 text-muted-foreground">Monte processos com fluxos visuais; persistência e execução estão em configuração.</p>
      </div>
      <div className="rounded-2xl border border-gilver/30 bg-gilver/10 px-4 py-3 text-sm text-foreground">
        O canvas permite experimentar etapas e conexões nesta sessão. Salvar e executar serão habilitados após a integração do backend de workflows.
      </div>
      <Card className="page-section overflow-hidden p-0">
        <CardContent className="h-[70vh] p-0">
          <WorkflowFlow />
        </CardContent>
      </Card>
    </div>
  </DashboardLayout>
);

export default Workflows;
