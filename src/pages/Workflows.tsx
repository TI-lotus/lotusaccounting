import { DashboardLayout } from "@/layouts/DashboardLayout";
import { WorkflowFlow } from "@/components/WorkflowFlow";
import { Card, CardContent } from "@/components/ui/card";

const Workflows = () => (
  <DashboardLayout>
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Workflows</h1>
        <p className="text-muted-foreground">Monte processos com fluxos visuais; persistência e execução estão em configuração.</p>
      </div>
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
        O canvas permite experimentar etapas e conexões nesta sessão. Salvar e executar serão habilitados após a integração do backend de workflows.
      </div>
      <Card>
        <CardContent className="p-0 h-[70vh]">
          <WorkflowFlow />
        </CardContent>
      </Card>
    </div>
  </DashboardLayout>
);

export default Workflows;
