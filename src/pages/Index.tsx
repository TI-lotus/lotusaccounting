import { useState } from "react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { KPICard } from "@/components/dashboard/KPICard";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import { QuickStats } from "@/components/dashboard/QuickStats";
import { useViewMode } from "@/contexts/ViewModeContext";
import { useData } from "@/contexts/DataContext";
import { useUserProfile } from "@/contexts/UserProfileContext";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  DollarSign,
  TrendingUp,
  Users,
  FileText,
  CheckSquare,
  Clock,
  AlertCircle,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import insightsBg from "@/assets/lotus-insights.png";

const liaImprovements = [
  { id: "i1", title: "Automatizar lembretes de DAS", desc: "Reduz 30% do retrabalho mensal com envio automático 5 dias antes do vencimento." },
  { id: "i2", title: "Reconciliar Pix com faturas", desc: "Conectar Pix Itaú para conciliar automaticamente 12 entradas pendentes." },
  { id: "i3", title: "Categorizar despesas recorrentes", desc: "A Lia identificou 8 despesas que podem ser auto-categorizadas." },
  { id: "i4", title: "Revisar margens dos clientes", desc: "3 clientes estão com honorários abaixo da média de mercado para o porte." },
  { id: "i5", title: "Ativar alerta de inadimplência", desc: "Notifica antes que o cliente passe de 15 dias em atraso." },
];

const LiaInsights = () => {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const toggle = (id: string) => setSelected((s) => ({ ...s, [id]: !s[id] }));
  const applyImprovements = () => {
    const count = Object.values(selected).filter(Boolean).length;
    toast.success(count > 0 ? `${count} melhoria(s) aplicada(s) pela Lia` : "Nenhuma melhoria selecionada");
    setOpen(false);
  };

  return (
    <>
      <div
        className="relative rounded-2xl p-5 text-white animate-fade-in overflow-hidden"
        style={{
          backgroundImage: `url(${insightsBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-black/35" />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3 min-w-0">
            <div className="rounded-xl bg-white/20 p-2 shrink-0 backdrop-blur-sm">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold">Insights da Lia</h3>
              <p className="text-sm opacity-95 mt-1">
                Receita 12% acima da média trimestral. 23 faturas vencendo nos próximos 7 dias. A Lia sugere automatizar lembretes para reduzir inadimplência em até 40%.
              </p>
            </div>
          </div>
          <Button variant="secondary" className="rounded-xl shrink-0 gap-2" onClick={() => setOpen(true)}>
            Saiba mais <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-gilver" />Melhorias sugeridas pela Lia</DialogTitle>
            <DialogDescription>Selecione as melhorias que deseja aplicar agora.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 max-h-[400px] overflow-y-auto custom-scroll">
            {liaImprovements.map((imp) => (
              <label key={imp.id} className="flex items-start gap-3 rounded-xl border border-border p-3 hover:bg-accent/40 cursor-pointer">
                <Checkbox checked={!!selected[imp.id]} onCheckedChange={() => toggle(imp.id)} className="mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{imp.title}</p>
                  <p className="text-xs text-muted-foreground">{imp.desc}</p>
                </div>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button className="rounded-xl" onClick={applyImprovements}>Aplicar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};


const ClientDashboard = () => {
  const profile = useUserProfile();
  const { tasks, updateTaskStatus } = useData();
  const recentDocs = [
    { name: "Balancete Mensal - Jan/2026", date: "12 Jan, 2026", type: "Relatório" },
    { name: "Fatura #1234", date: "10 Jan, 2026", type: "Fatura" },
    { name: "DAS - Janeiro", date: "08 Jan, 2026", type: "Guia" },
    { name: "Nota Fiscal #892", date: "05 Jan, 2026", type: "NF" },
  ];

  return (
    <div className="space-y-6">
      <div className="animate-fade-in">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Bem-vindo de volta, {profile.firstName}. Aqui está o resumo da sua empresa.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Tarefas Abertas"
          value="4"
          change={-2}
          changeLabel="2 com prazo esta semana"
          icon={CheckSquare}
        />
        <KPICard
          title="Tarefas Concluídas"
          value="18"
          change={25}
          changeLabel="vs mês anterior"
          icon={Clock}
        />
        <KPICard
          title="Documentos Recentes"
          value="12"
          change={8}
          changeLabel="vs mês anterior"
          icon={FileText}
        />
        <KPICard
          title="Pagamentos Pendentes"
          value="2"
          changeLabel="R$ 3.450,00 total"
          icon={AlertCircle}
        />
      </div>

      {/* Recent Documents */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass rounded-2xl p-6 animate-fade-in">
          <h3 className="text-lg font-semibold mb-4">Documentos Recentes</h3>
          <div className="space-y-3">
            {recentDocs.map((doc, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl hover:bg-accent/50 transition-colors">
                <div className="p-2 rounded-lg bg-accent">
                  <FileText className="h-4 w-4 text-accent-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{doc.name}</p>
                  <p className="text-xs text-muted-foreground">{doc.date}</p>
                </div>
                <Badge variant="outline" className="text-xs">{doc.type}</Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Tasks */}
        <div className="glass rounded-2xl p-6 animate-fade-in">
          <h3 className="text-lg font-semibold mb-4">Tarefas da conta</h3>
          <div className="space-y-3">
            {tasks.slice(0, 5).map((task) => (
              <div key={task.id} className="flex items-start gap-3 p-3 rounded-xl border border-border hover:bg-accent/30 transition-colors">
                <Checkbox checked={task.status === "completed"} onCheckedChange={(checked) => updateTaskStatus(task.id, checked ? "completed" : "pending")} className="mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm font-medium", task.status === "completed" && "line-through text-muted-foreground")}>{task.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{task.clientName} · vence em {new Date(task.dueDate).toLocaleDateString("pt-BR")}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Payment Summary */}
      <div className="glass rounded-2xl p-6 animate-fade-in">
        <h3 className="text-lg font-semibold mb-4">Resumo de Pagamentos</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30">
            <p className="text-sm text-muted-foreground">Pagos este mês</p>
            <p className="text-xl font-semibold text-emerald-600 dark:text-emerald-400">R$ 8.750,00</p>
          </div>
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30">
            <p className="text-sm text-muted-foreground">Pendentes</p>
            <p className="text-xl font-semibold text-amber-600 dark:text-amber-400">R$ 3.450,00</p>
          </div>
          <div className="p-4 rounded-xl bg-muted">
            <p className="text-sm text-muted-foreground">Total do mês</p>
            <p className="text-xl font-semibold">R$ 12.200,00</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const Index = () => {
  const { viewMode } = useViewMode();
  const profile = useUserProfile();
  const { tasks, updateTaskStatus } = useData();

  if (viewMode === "client") {
    return (
      <DashboardLayout>
        <ClientDashboard />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="animate-fade-in">
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Bem-vindo de volta, {profile.firstName}. Aqui está seu panorama financeiro.
          </p>
        </div>

        <LiaInsights />



        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            title="Receita Total"
            value="R$ 284.500,00"
            change={12.5}
            icon={DollarSign}
          />
          <KPICard
            title="Lucro Líquido"
            value="R$ 68.200,00"
            change={8.2}
            icon={TrendingUp}
          />
          <KPICard
            title="Clientes Ativos"
            value="142"
            change={4.1}
            icon={Users}
          />
          <KPICard
            title="Faturas Pendentes"
            value="23"
            change={-15}
            changeLabel="12 vencem esta semana"
            icon={FileText}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <RevenueChart className="lg:col-span-2" />
          <QuickStats />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RecentTransactions />
          <div className="glass rounded-2xl p-6 animate-fade-in">
            <h3 className="text-lg font-semibold mb-4">Tarefas da conta</h3>
            <div className="space-y-3">
              {tasks.slice(0, 6).map((task) => (
                <div key={task.id} className="flex items-start gap-3 p-3 rounded-xl border border-border hover:bg-accent/30 transition-colors">
                  <Checkbox checked={task.status === "completed"} onCheckedChange={(checked) => updateTaskStatus(task.id, checked ? "completed" : "pending")} className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-sm font-medium", task.status === "completed" && "line-through text-muted-foreground")}>{task.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{task.clientName} · vence em {new Date(task.dueDate).toLocaleDateString("pt-BR")}</p>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">{task.category}</Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Index;
