import { useState } from "react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { CheckCircle2, Circle, Clock, Plus, Calendar, AlertCircle, AlertTriangle, LayoutList, Columns3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useData } from "@/contexts/DataContext";
import { TaskData, TaskStatus, TaskPriority, TaskType } from "@/types";
import { filterTasks } from "@/lib/taskUtils";
import { useViewMode } from "@/contexts/ViewModeContext";
import { CalendarEventView } from "@/components/CalendarEventView";

const kanbanColumns: { status: TaskStatus; label: string; color: string; icon: React.ReactNode }[] = [
  { status: "overdue", label: "Atrasadas", color: "border-red-500/40", icon: <AlertTriangle className="h-4 w-4 text-red-500" /> },
  { status: "pending", label: "Pendentes", color: "border-amber-500/40", icon: <Circle className="h-4 w-4 text-amber-500" /> },
  { status: "in_progress", label: "Em Andamento", color: "border-primary/40", icon: <Clock className="h-4 w-4 text-primary" /> },
  { status: "completed", label: "Concluídas", color: "border-emerald-500/40", icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" /> },
];

const Tasks = () => {
  const { tasks, addTask, updateTaskStatus, clients } = useData();
  const { viewMode } = useViewMode();
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewType, setViewType] = useState<"list" | "grid" | "calendar">(viewMode === "client" ? "grid" : "list");
  const [dateRange, setDateRange] = useState({ start: "2026-01-01", end: "2026-01-31" });
  const [newTask, setNewTask] = useState({
    title: "", description: "", priority: "medium" as TaskPriority,
    dueDate: "", category: "", clientId: "", assignedToId: "u2",
    type: "monthly" as TaskType,
  });

  const assignees = Array.from(new Map(tasks.map(t => [t.assignedToId, t.assignedToName])).entries());

  const filteredTasks = filterTasks(tasks, {
    status: statusFilter,
    clientId: clientFilter,
    assignedToId: assigneeFilter,
    type: typeFilter,
  });

  const toggleTaskStatus = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const newStatus: TaskStatus = task.status === "completed" ? "pending" : "completed";
    updateTaskStatus(taskId, newStatus);
  };

  const handleCreateTask = () => {
    if (!newTask.title.trim()) return;
    const selectedClient = clients.find(c => c.id === newTask.clientId);
    const assigneeName = assignees.find(([id]) => id === newTask.assignedToId)?.[1] || "Ana Costa";

    addTask({
      title: newTask.title,
      description: newTask.description,
      status: "pending",
      priority: newTask.priority,
      type: newTask.type,
      dueDate: newTask.dueDate,
      category: newTask.category || "Geral",
      clientId: newTask.clientId || null,
      clientName: selectedClient?.name ?? null,
      assignedToId: newTask.assignedToId,
      assignedToName: assigneeName,
    });

    setNewTask({ title: "", description: "", priority: "medium", dueDate: "", category: "", clientId: "", assignedToId: "u2", type: "monthly" });
    setDialogOpen(false);
  };

  const getStatusIcon = (status: TaskStatus) => {
    switch (status) {
      case "completed": return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
      case "in_progress": return <Clock className="h-5 w-5 text-amber-500" />;
      case "overdue": return <AlertTriangle className="h-5 w-5 text-red-500" />;
      default: return <Circle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getPriorityBadge = (priority: TaskPriority) => {
    const variants = {
      high: "bg-destructive/10 text-destructive border-destructive/20",
      medium: "bg-amber-500/10 text-amber-600 border-amber-500/20",
      low: "bg-muted text-muted-foreground border-border",
    };
    const labels = { high: "Alta", medium: "Média", low: "Baixa" };
    return <Badge variant="outline" className={cn("text-xs", variants[priority])}>{labels[priority]}</Badge>;
  };

  const getTypeBadge = (type: TaskType) => {
    const labels = { monthly: "Mensal", annual: "Anual", one_time: "Única" };
    return <Badge variant="outline" className="text-xs">{labels[type]}</Badge>;
  };

  const pendingCount = tasks.filter(t => t.status === "pending").length;
  const inProgressCount = tasks.filter(t => t.status === "in_progress").length;
  const completedCount = tasks.filter(t => t.status === "completed").length;
  const overdueCount = tasks.filter(t => t.status === "overdue").length;

  const KanbanCard = ({ task }: { task: TaskData }) => (
    <div className={cn(
      "glass rounded-xl p-3 space-y-2.5 cursor-pointer hover:shadow-md transition-all",
      task.status === "overdue" && "border border-red-500/30 bg-red-500/5"
    )}>
      <div className="flex items-start justify-between gap-2">
        <h4 className={cn("text-sm font-medium leading-tight", task.status === "completed" && "line-through text-muted-foreground")}>
          {task.title}
        </h4>
        {getPriorityBadge(task.priority)}
      </div>
      {task.description && (
        <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
      )}
      <div className="flex items-center gap-1.5 flex-wrap">
        {task.clientName && <Badge variant="outline" className="text-[10px] py-0 px-1.5">{task.clientName}</Badge>}
        {getTypeBadge(task.type)}
      </div>
      <div className="flex items-center justify-between pt-1.5 border-t border-border/50">
        <div className="flex items-center gap-1.5">
          <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[9px] font-medium text-muted-foreground">
            {task.assignedToName?.charAt(0)}
          </div>
          <span className="text-[11px] text-muted-foreground">{task.assignedToName}</span>
        </div>
        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Calendar className="h-2.5 w-2.5" />{new Date(task.dueDate).toLocaleDateString("pt-BR")}
        </span>
      </div>
      {task.status !== "completed" && (
        <Button variant="outline" size="sm" className="w-full text-xs h-7 rounded-lg" onClick={() => {
          if (task.status === "pending" || task.status === "overdue") updateTaskStatus(task.id, "in_progress");
          else if (task.status === "in_progress") updateTaskStatus(task.id, "completed");
        }}>
          {task.status === "in_progress" ? "✓ Concluir" : "▶ Iniciar"}
        </Button>
      )}
    </div>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between animate-fade-in">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Minhas Tarefas</h1>
            <p className="text-muted-foreground">Gerencie suas tarefas e pendências</p>
          </div>
          <div className="flex gap-2">
            <div className="flex border border-border rounded-xl overflow-hidden">
              <Button variant={viewType === "list" ? "default" : "ghost"} size="sm" className="rounded-none rounded-l-xl" onClick={() => setViewType("list")}>
                <LayoutList className="h-4 w-4" />
              </Button>
              <Button variant={viewType === "grid" ? "default" : "ghost"} size="sm" className="rounded-none rounded-r-xl" onClick={() => setViewType("grid")}>
                <Columns3 className="h-4 w-4" />
              </Button>
              <Button variant={viewType === "calendar" ? "default" : "ghost"} size="sm" className="rounded-none" onClick={() => setViewType("calendar")}>
                <Calendar className="h-4 w-4" />
              </Button>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2"><Plus className="h-4 w-4" />Nova Tarefa</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Criar Nova Tarefa</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Título</Label>
                    <Input placeholder="Digite o título da tarefa" value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Descrição</Label>
                    <Textarea placeholder="Descreva a tarefa" value={newTask.description} onChange={(e) => setNewTask({ ...newTask, description: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Tipo</Label>
                      <Select value={newTask.type} onValueChange={(v: TaskType) => setNewTask({ ...newTask, type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">Mensal</SelectItem>
                          <SelectItem value="annual">Anual</SelectItem>
                          <SelectItem value="one_time">Única</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Prioridade</Label>
                      <Select value={newTask.priority} onValueChange={(v: TaskPriority) => setNewTask({ ...newTask, priority: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Baixa</SelectItem>
                          <SelectItem value="medium">Média</SelectItem>
                          <SelectItem value="high">Alta</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Data Limite</Label>
                      <Input type="date" value={newTask.dueDate} onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Categoria</Label>
                      <Input placeholder="Ex: Fiscal, Contratos" value={newTask.category} onChange={(e) => setNewTask({ ...newTask, category: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Cliente</Label>
                      <Select value={newTask.clientId} onValueChange={(v) => setNewTask({ ...newTask, clientId: v })}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {clients.map(c => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Responsável</Label>
                      <Select value={newTask.assignedToId} onValueChange={(v) => setNewTask({ ...newTask, assignedToId: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {assignees.map(([id, name]) => (<SelectItem key={id} value={id}>{name}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button onClick={handleCreateTask} className="w-full">Criar Tarefa</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in">
          <div className="glass rounded-2xl p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-red-500/10"><AlertTriangle className="h-5 w-5 text-red-500" /></div>
            <div><p className="text-2xl font-semibold">{overdueCount}</p><p className="text-sm text-muted-foreground">Atrasadas</p></div>
          </div>
          <div className="glass rounded-2xl p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-amber-500/10"><AlertCircle className="h-5 w-5 text-amber-500" /></div>
            <div><p className="text-2xl font-semibold">{pendingCount}</p><p className="text-sm text-muted-foreground">Pendentes</p></div>
          </div>
          <div className="glass rounded-2xl p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10"><Clock className="h-5 w-5 text-primary" /></div>
            <div><p className="text-2xl font-semibold">{inProgressCount}</p><p className="text-sm text-muted-foreground">Em Andamento</p></div>
          </div>
          <div className="glass rounded-2xl p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-emerald-500/10"><CheckCircle2 className="h-5 w-5 text-emerald-500" /></div>
            <div><p className="text-2xl font-semibold">{completedCount}</p><p className="text-sm text-muted-foreground">Concluídas</p></div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 animate-fade-in">
          <div className="flex gap-2">
            {([["all", "Todas"], ["overdue", "Atrasadas"], ["pending", "Pendentes"], ["in_progress", "Em Andamento"], ["completed", "Concluídas"]] as const).map(([value, label]) => (
              <Button key={value} variant={statusFilter === value ? "default" : "outline"} size="sm" onClick={() => setStatusFilter(value)}>
                {label}
              </Button>
            ))}
          </div>
          <div className="ml-auto flex gap-2">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[120px] h-9 text-sm"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos tipos</SelectItem>
                <SelectItem value="monthly">Mensal</SelectItem>
                <SelectItem value="annual">Anual</SelectItem>
                <SelectItem value="one_time">Única</SelectItem>
              </SelectContent>
            </Select>
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger className="w-[160px] h-9 text-sm"><SelectValue placeholder="Cliente" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos clientes</SelectItem>
                {clients.map(c => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
              <SelectTrigger className="w-[160px] h-9 text-sm"><SelectValue placeholder="Responsável" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {assignees.map(([id, name]) => (<SelectItem key={id} value={id}>{name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {viewMode === "client" && (
          <div className="glass rounded-2xl p-4 text-sm text-muted-foreground animate-fade-in">
            As tarefas do cliente reúnem dados, documentos e pagamentos enviados para a Lotus.
          </div>
        )}

        {viewType === "calendar" ? (
          <CalendarEventView
            title="Calendário de tarefas"
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            events={filteredTasks.map((task, index) => ({
              day: ((index * 3) % 30) + 1,
              title: task.title,
              subtitle: `${task.category} • ${task.clientName ?? "Lotus"}`,
              time: "10:00",
              status: task.status === "completed" ? "Concluída" : task.status === "overdue" ? "Atrasada" : "Pendente",
            }))}
          />
        ) : viewType === "grid" ? (
          <div className="grid grid-cols-1 gap-4 animate-fade-in md:grid-cols-2 xl:grid-cols-3">
            {filteredTasks.map((task) => <KanbanCard key={task.id} task={task} />)}
          </div>
        ) : (
          /* List View */
          <div className="space-y-3 animate-fade-in">
            {filteredTasks.map((task, index) => (
              <div
                key={task.id}
                className={cn(
                  "glass rounded-2xl p-4 flex items-start gap-4 transition-all",
                  task.status === "completed" && "opacity-60",
                  task.status === "overdue" && "border border-red-500/30"
                )}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <Checkbox checked={task.status === "completed"} onCheckedChange={() => toggleTaskStatus(task.id)} className="mt-1" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className={cn("font-medium", task.status === "completed" && "line-through text-muted-foreground")}>{task.title}</h3>
                    {getPriorityBadge(task.priority)}
                    {getTypeBadge(task.type)}
                    <Badge variant="outline" className="text-xs">{task.category}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />Prazo: {new Date(task.dueDate).toLocaleDateString("pt-BR")}</span>
                    {task.clientName && <span>Cliente: {task.clientName}</span>}
                    <span>Responsável: {task.assignedToName}</span>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1">
                  {getStatusIcon(task.status)}
                  {task.status !== "completed" && task.status !== "overdue" && (
                    <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={() => updateTaskStatus(task.id, "in_progress")}>
                      Iniciar
                    </Button>
                  )}
                </div>
              </div>
            ))}

            {filteredTasks.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma tarefa encontrada</p>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Tasks;
