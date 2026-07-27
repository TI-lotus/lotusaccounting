import { DashboardLayout } from "@/layouts/DashboardLayout";
import { WorkflowFlow } from "@/components/WorkflowFlow";
import { Card, CardContent } from "@/components/ui/card";

const Workflows = () => (
  <DashboardLayout>
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Workflows</h1>
        <p className="text-muted-foreground">Automatize processos com fluxos visuais</p>
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
