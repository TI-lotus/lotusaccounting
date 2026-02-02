import { useState } from "react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { CheckCircle2, Circle, Clock, Plus, Calendar, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Task {
  id: number;
  title: string;
  description: string;
  status: "pending" | "in_progress" | "completed";
  priority: "low" | "medium" | "high";
  dueDate: string;
  category: string;
}

const initialTasks: Task[] = [
  {
    id: 1,
    title: "Enviar documentos fiscais",
    description: "Enviar notas fiscais do mês de janeiro para o contador",
    status: "pending",
    priority: "high",
    dueDate: "2024-02-05",
    category: "Documentos",
  },
  {
    id: 2,
    title: "Revisar relatório mensal",
    description: "Verificar e aprovar o relatório financeiro de dezembro",
    status: "in_progress",
    priority: "medium",
    dueDate: "2024-02-10",
    category: "Relatórios",
  },
  {
    id: 3,
    title: "Atualizar dados cadastrais",
    description: "Atualizar endereço e telefone da empresa no sistema",
    status: "completed",
    priority: "low",
    dueDate: "2024-01-28",
    category: "Cadastro",
  },
  {
    id: 4,
    title: "Aprovar fatura pendente",
    description: "Verificar e aprovar fatura #INV-2024-0089",
    status: "pending",
    priority: "high",
    dueDate: "2024-02-03",
    category: "Pagamentos",
  },
  {
    id: 5,
    title: "Assinar contrato de serviço",
    description: "Assinar digitalmente o novo contrato de prestação de serviços",
    status: "pending",
    priority: "medium",
    dueDate: "2024-02-08",
    category: "Contratos",
  },
  {
    id: 6,
    title: "Responder questionário fiscal",
    description: "Preencher questionário sobre atividades da empresa para declaração anual",
    status: "in_progress",
    priority: "high",
    dueDate: "2024-02-15",
    category: "Fiscal",
  },
];

const Tasks = () => {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [filter, setFilter] = useState<"all" | "pending" | "in_progress" | "completed">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    priority: "medium" as Task["priority"],
    dueDate: "",
    category: "",
  });

  const filteredTasks = tasks.filter((task) => {
    if (filter === "all") return true;
    return task.status === filter;
  });

  const toggleTaskStatus = (taskId: number) => {
    setTasks(tasks.map((task) => {
      if (task.id === taskId) {
        const newStatus = task.status === "completed" ? "pending" : "completed";
        return { ...task, status: newStatus };
      }
      return task;
    }));
  };

  const handleCreateTask = () => {
    if (!newTask.title.trim()) return;
    
    const task: Task = {
      id: Date.now(),
      title: newTask.title,
      description: newTask.description,
      status: "pending",
      priority: newTask.priority,
      dueDate: newTask.dueDate,
      category: newTask.category || "Geral",
    };
    
    setTasks([task, ...tasks]);
    setNewTask({ title: "", description: "", priority: "medium", dueDate: "", category: "" });
    setDialogOpen(false);
  };

  const getStatusIcon = (status: Task["status"]) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
      case "in_progress":
        return <Clock className="h-5 w-5 text-amber-500" />;
      default:
        return <Circle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getPriorityBadge = (priority: Task["priority"]) => {
    const variants = {
      high: "bg-destructive/10 text-destructive border-destructive/20",
      medium: "bg-amber-500/10 text-amber-600 border-amber-500/20",
      low: "bg-muted text-muted-foreground border-border",
    };
    const labels = { high: "Alta", medium: "Média", low: "Baixa" };
    
    return (
      <Badge variant="outline" className={cn("text-xs", variants[priority])}>
        {labels[priority]}
      </Badge>
    );
  };

  const pendingCount = tasks.filter((t) => t.status === "pending").length;
  const inProgressCount = tasks.filter((t) => t.status === "in_progress").length;
  const completedCount = tasks.filter((t) => t.status === "completed").length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between animate-fade-in">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Minhas Tarefas</h1>
            <p className="text-muted-foreground">Gerencie suas tarefas e pendências</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-xl gap-2">
                <Plus className="h-4 w-4" />
                Nova Tarefa
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Nova Tarefa</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Título</Label>
                  <Input
                    placeholder="Digite o título da tarefa"
                    value={newTask.title}
                    onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea
                    placeholder="Descreva a tarefa"
                    value={newTask.description}
                    onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                    className="rounded-xl"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Prioridade</Label>
                    <Select
                      value={newTask.priority}
                      onValueChange={(value: Task["priority"]) => setNewTask({ ...newTask, priority: value })}
                    >
                      <SelectTrigger className="rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Baixa</SelectItem>
                        <SelectItem value="medium">Média</SelectItem>
                        <SelectItem value="high">Alta</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Data Limite</Label>
                    <Input
                      type="date"
                      value={newTask.dueDate}
                      onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                      className="rounded-xl"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Input
                    placeholder="Ex: Documentos, Fiscal, Contratos"
                    value={newTask.category}
                    onChange={(e) => setNewTask({ ...newTask, category: e.target.value })}
                    className="rounded-xl"
                  />
                </div>
                <Button onClick={handleCreateTask} className="w-full rounded-xl">
                  Criar Tarefa
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in">
          <div className="glass rounded-2xl p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-amber-500/10">
              <AlertCircle className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{pendingCount}</p>
              <p className="text-sm text-muted-foreground">Pendentes</p>
            </div>
          </div>
          <div className="glass rounded-2xl p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{inProgressCount}</p>
              <p className="text-sm text-muted-foreground">Em Andamento</p>
            </div>
          </div>
          <div className="glass rounded-2xl p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-emerald-500/10">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{completedCount}</p>
              <p className="text-sm text-muted-foreground">Concluídas</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 animate-fade-in">
          {[
            { value: "all", label: "Todas" },
            { value: "pending", label: "Pendentes" },
            { value: "in_progress", label: "Em Andamento" },
            { value: "completed", label: "Concluídas" },
          ].map((item) => (
            <Button
              key={item.value}
              variant={filter === item.value ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(item.value as typeof filter)}
              className="rounded-xl"
            >
              {item.label}
            </Button>
          ))}
        </div>

        {/* Task List */}
        <div className="space-y-3 animate-fade-in">
          {filteredTasks.map((task, index) => (
            <div
              key={task.id}
              className={cn(
                "glass rounded-2xl p-4 flex items-start gap-4 transition-all",
                task.status === "completed" && "opacity-60"
              )}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <Checkbox
                checked={task.status === "completed"}
                onCheckedChange={() => toggleTaskStatus(task.id)}
                className="mt-1"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className={cn(
                    "font-medium",
                    task.status === "completed" && "line-through text-muted-foreground"
                  )}>
                    {task.title}
                  </h3>
                  {getPriorityBadge(task.priority)}
                  <Badge variant="outline" className="text-xs">
                    {task.category}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span>Prazo: {new Date(task.dueDate).toLocaleDateString("pt-BR")}</span>
                </div>
              </div>
              {getStatusIcon(task.status)}
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Tasks;
