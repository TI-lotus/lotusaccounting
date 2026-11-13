import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import {
  CheckCircle2,
  Circle,
  Clock,
  Plus,
  Calendar,
  AlertCircle,
  AlertTriangle,
  LockKeyhole,
  LayoutList,
  Columns3,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { TaskData, TaskStatus, TaskPriority, TaskType } from "@/types";
import { filterTasks } from "@/lib/taskUtils";
import { useViewMode } from "@/contexts/ViewModeContext";
import { CalendarEventView } from "@/components/CalendarEventView";
import { useWorkspacePermission } from "@/hooks/useWorkspacePermission";
import { FilterPopover } from "@/components/FilterPopover";

const currentMonthRange = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return {
    start: `${year}-${String(month).padStart(2, "0")}-01`,
    end: new Date(year, month, 0).toISOString().slice(0, 10),
  };
};

const Tasks = () => {
  const { tasks, addTask, updateTaskStatus, deleteTask, clients, tenantId } = useData();
  const { viewMode } = useViewMode();
  const { user, profile } = useAuth();
  const canDeleteTasks = useWorkspacePermission({
    tenantId,
    userId: user?.id,
    accountType: profile?.account_type,
    resource: "tasks",
    action: "delete",
  });
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewType, setViewType] = useState<"list" | "grid" | "calendar">(
    viewMode === "client" ? "grid" : "list",
  );
  const [dateRange, setDateRange] = useState(currentMonthRange);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<TaskStatus | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskData | null>(null);
  const [blockTarget, setBlockTarget] = useState<TaskData | null>(null);
  const [blockReason, setBlockReason] = useState("");
  const [activeAssignees, setActiveAssignees] = useState<Array<{ user_id: string; full_name: string | null; avatar_url: string | null }>>([]);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    priority: "medium" as TaskPriority,
    dueDate: "",
    category: "",
    clientId: "",
    assignedToId: user?.id ?? "",
    type: "monthly" as TaskType,
  });

  const currentUserName = profile?.full_name || user?.email || "Você";
  const activeClients = useMemo(() => clients.filter((client) => client.status === "active"), [clients]);
  useEffect(() => {
    if (!tenantId || viewMode === "client") {
      setActiveAssignees([]);
      return;
    }
    void supabase
      .from("profiles")
      .select("user_id, full_name, avatar_url")
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .order("full_name")
      .then(({ data }) => setActiveAssignees(data ?? []));
  }, [tenantId, viewMode]);
  const assignees = activeAssignees.length
    ? activeAssignees.map((member) => [member.user_id, member.full_name || "Sem nome"] as [string, string])
    : user?.id ? [[user.id, currentUserName] as [string, string]] : [];

  const filteredTasks = filterTasks(tasks, {
    status: statusFilter,
    clientId: clientFilter,
    assignedToId: assigneeFilter,
    type: typeFilter,
  });

  const toggleTaskStatus = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const newStatus: TaskStatus =
      task.status === "completed" ? "pending" : "completed";
    updateTaskStatus(taskId, newStatus);
  };

  const handleCreateTask = async () => {
    if (!newTask.title.trim()) return;
    const selectedClient = clients.find((c) => c.id === newTask.clientId);
    const assigneeName =
      assignees.find(([id]) => id === newTask.assignedToId)?.[1] ||
      "Sem responsável";

    const saved = await addTask({
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
    if (!saved) return;

    setNewTask({
      title: "",
      description: "",
      priority: "medium",
      dueDate: "",
      category: "",
      clientId: "",
      assignedToId: user?.id ?? "",
      type: "monthly",
    });
    setDialogOpen(false);
  };

  const getStatusIcon = (status: TaskStatus) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
      case "in_progress":
        return <Clock className="h-5 w-5 text-amber-500" />;
      case "overdue":
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case "blocked":
        return <LockKeyhole className="h-5 w-5 text-red-600" />;
      default:
        return <Circle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getPriorityBadge = (priority: TaskPriority) => {
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

  const getTypeBadge = (type: TaskType) => {
    const labels = { monthly: "Mensal", annual: "Anual", one_time: "Única" };
    return (
      <Badge variant="outline" className="text-xs">
        {labels[type]}
      </Badge>
    );
  };

  const pendingCount = tasks.filter((t) => t.status === "pending").length;
  const inProgressCount = tasks.filter(
    (t) => t.status === "in_progress",
  ).length;
  const completedCount = tasks.filter((t) => t.status === "completed").length;
  const overdueCount = tasks.filter((t) => t.status === "overdue").length;
  const blockedCount = tasks.filter((t) => t.status === "blocked").length;

  const openBlockDialog = (task: TaskData) => {
    setBlockTarget(task);
    setBlockReason(task.blockedReason ?? "");
  };

  const handleBlockTask = async () => {
    if (!blockTarget) return;
    const ok = await updateTaskStatus(blockTarget.id, "blocked", blockReason);
    if (!ok) return;
    setSelectedTask(null);
    setBlockTarget(null);
    setBlockReason("");
  };

  const moveTaskToStatus = async (status: TaskStatus) => {
    if (!draggedTaskId || viewMode === "client") return;
    const task = tasks.find((item) => item.id === draggedTaskId);
    setDragOverStatus(null);
    setDraggedTaskId(null);
    if (!task || task.status === status) return;
    await updateTaskStatus(task.id, status);
  };

  const KanbanCard = ({ task }: { task: TaskData }) => (
    <div
      draggable={viewMode !== "client"}
      onDragStart={(event) => {
        if (viewMode === "client") return;
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", task.id);
        setDraggedTaskId(task.id);
      }}
      onDragEnd={() => {
        setDraggedTaskId(null);
        setDragOverStatus(null);
      }}
      onClick={() => setSelectedTask(task)}
      className={cn(
        "glass rounded-xl p-3 space-y-2.5 cursor-grab active:cursor-grabbing",
        draggedTaskId === task.id && "opacity-45",
        (task.status === "overdue" || task.status === "blocked") && "border border-red-500/30 bg-red-500/5",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h4
          className={cn(
            "text-sm font-medium leading-tight",
            task.status === "completed" && "line-through text-muted-foreground",
          )}
        >
          {task.title}
        </h4>
        {getPriorityBadge(task.priority)}
      </div>
      {task.description && (
        <p className="text-xs text-muted-foreground line-clamp-2">
          {task.description}
        </p>
      )}
      {task.blockedReason && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {task.blockedReason}
        </p>
      )}
      <div className="flex items-center gap-1.5 flex-wrap">
        {task.clientName && (
          <Badge variant="outline" className="text-[10px] py-0 px-1.5">
            {task.clientName}
          </Badge>
        )}
        {getTypeBadge(task.type)}
      </div>
      <div className="flex items-center justify-between pt-1.5 border-t border-border/50">
        <div className="flex items-center gap-1.5">
          <Avatar className="h-5 w-5">
            <AvatarImage src={activeAssignees.find((member) => member.user_id === task.assignedToId)?.avatar_url ?? undefined} />
            <AvatarFallback className="text-[9px] font-medium text-muted-foreground">{task.assignedToName?.charAt(0)}</AvatarFallback>
          </Avatar>
          <span className="text-[11px] text-muted-foreground">
            {task.assignedToName}
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Calendar className="h-2.5 w-2.5" />
          {new Date(task.dueDate).toLocaleDateString("pt-BR")}
        </span>
      </div>
      {task.status !== "completed" && (
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs h-7 rounded-lg"
          onClick={(event) => {
            event.stopPropagation();
            if (task.status === "pending" || task.status === "overdue" || task.status === "blocked")
              updateTaskStatus(task.id, "in_progress");
            else if (task.status === "in_progress")
              updateTaskStatus(task.id, "completed");
          }}
        >
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
            <h1 className="text-2xl font-semibold tracking-tight">
              Minhas Tarefas
            </h1>
            <p className="text-muted-foreground">
              Gerencie suas tarefas e pendências
            </p>
          </div>
          <div className="flex gap-2">
            <div className="flex border border-border rounded-xl overflow-hidden">
              <Button
                variant={viewType === "list" ? "default" : "ghost"}
                size="sm"
                className="rounded-none rounded-l-xl"
                onClick={() => setViewType("list")}
              >
                <LayoutList className="h-4 w-4" />
              </Button>
              <Button
                variant={viewType === "grid" ? "default" : "ghost"}
                size="sm"
                className="rounded-none rounded-r-xl"
                onClick={() => setViewType("grid")}
              >
                <Columns3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewType === "calendar" ? "default" : "ghost"}
                size="sm"
                className="rounded-none"
                onClick={() => setViewType("calendar")}
              >
                <Calendar className="h-4 w-4" />
              </Button>
            </div>
            {viewMode !== "client" && (
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
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
                        onChange={(e) =>
                          setNewTask({ ...newTask, title: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Descrição</Label>
                      <Textarea
                        placeholder="Descreva a tarefa"
                        value={newTask.description}
                        onChange={(e) =>
                          setNewTask({
                            ...newTask,
                            description: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Tipo</Label>
                        <Select
                          value={newTask.type}
                          onValueChange={(v: TaskType) =>
                            setNewTask({ ...newTask, type: v })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="monthly">Mensal</SelectItem>
                            <SelectItem value="annual">Anual</SelectItem>
                            <SelectItem value="one_time">Única</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Prioridade</Label>
                        <Select
                          value={newTask.priority}
                          onValueChange={(v: TaskPriority) =>
                            setNewTask({ ...newTask, priority: v })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
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
                        <Input
                          type="date"
                          value={newTask.dueDate}
                          onChange={(e) =>
                            setNewTask({ ...newTask, dueDate: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Categoria</Label>
                        <Input
                          placeholder="Ex: Fiscal, Contratos"
                          value={newTask.category}
                          onChange={(e) =>
                            setNewTask({ ...newTask, category: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Cliente</Label>
                        <Select
                          value={newTask.clientId}
                          onValueChange={(v) =>
                            setNewTask({ ...newTask, clientId: v })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            {activeClients.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Responsável</Label>
                        <Select
                          value={newTask.assignedToId}
                          onValueChange={(v) =>
                            setNewTask({ ...newTask, assignedToId: v })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {assignees.map(([id, name]) => (
                              <SelectItem key={id} value={id}>
                                {name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button onClick={handleCreateTask} className="w-full">
                      Criar Tarefa
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 animate-fade-in md:grid-cols-5">
          <div className="glass rounded-2xl p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-red-500/10">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{overdueCount}</p>
              <p className="text-sm text-muted-foreground">Atrasadas</p>
            </div>
          </div>
          <div className="glass rounded-2xl p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-red-500/10">
              <LockKeyhole className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{blockedCount}</p>
              <p className="text-sm text-muted-foreground">Bloqueadas</p>
            </div>
          </div>
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
        <div className="filter-toolbar flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex min-w-0 items-center gap-2">
            <FilterPopover
              activeCount={[statusFilter !== "all", typeFilter !== "all", clientFilter !== "all", assigneeFilter !== "all"].filter(Boolean).length}
              description="Combine status, tipo, cliente e responsável."
              onClear={() => {
                setStatusFilter("all");
                setTypeFilter("all");
                setClientFilter("all");
                setAssigneeFilter("all");
              }}
            >
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Status</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        ["all", "Todas"],
                        ["overdue", "Atrasadas"],
                        ["blocked", "Bloqueadas"],
                        ["pending", "Pendentes"],
                        ["in_progress", "Em andamento"],
                        ["completed", "Concluídas"],
                      ] as const
                    ).map(([value, label]) => (
                      <Button
                        key={value}
                        type="button"
                        variant={statusFilter === value ? "default" : "outline"}
                        size="sm"
                        className="justify-start"
                        onClick={() => setStatusFilter(value)}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full text-sm">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos tipos</SelectItem>
                <SelectItem value="monthly">Mensal</SelectItem>
                <SelectItem value="annual">Anual</SelectItem>
                <SelectItem value="one_time">Única</SelectItem>
              </SelectContent>
            </Select>
            {viewMode !== "client" && (
              <Select value={clientFilter} onValueChange={setClientFilter}>
                <SelectTrigger className="w-full text-sm">
                  <SelectValue placeholder="Cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos clientes</SelectItem>
                  {activeClients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {viewMode !== "client" && (
              <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                <SelectTrigger className="w-full text-sm">
                  <SelectValue placeholder="Responsável" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {assignees.map(([id, name]) => (
                    <SelectItem key={id} value={id}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            </FilterPopover>
          </div>
        </div>

        {viewMode === "client" && (
          <div className="glass rounded-2xl p-4 text-sm text-muted-foreground animate-fade-in">
            As tarefas do cliente reúnem dados, documentos e pagamentos enviados
            para a Lotus.
          </div>
        )}

        {viewType === "calendar" ? (
          <CalendarEventView
            title="Calendário de tarefas"
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            events={filteredTasks.map((task) => ({
              day: new Date(task.dueDate).getDate(),
              title: task.title,
              subtitle: `${task.category} • ${task.clientName ?? "Lotus"}`,
              time: "10:00",
              status:
                task.status === "completed"
                  ? "Concluída"
                  : task.status === "overdue"
                    ? "Atrasada"
                    : task.status === "blocked"
                      ? "Bloqueada"
                    : "Pendente",
            }))}
          />
        ) : viewType === "grid" ? (
          <div className="grid grid-cols-1 gap-4 animate-fade-in md:grid-cols-2 xl:grid-cols-5">
            {(
              [
                {
                  key: "overdue",
                  label: "Atraso",
                  color: "text-red-600",
                  bg: "bg-red-500/10",
                },
                {
                  key: "blocked",
                  label: "Bloqueado",
                  color: "text-red-700",
                  bg: "bg-red-500/10",
                },
                {
                  key: "pending",
                  label: "Pendente",
                  color: "text-amber-600",
                  bg: "bg-amber-500/10",
                },
                {
                  key: "in_progress",
                  label: "Em andamento",
                  color: "text-primary",
                  bg: "bg-primary/10",
                },
                {
                  key: "completed",
                  label: "Concluído",
                  color: "text-emerald-600",
                  bg: "bg-emerald-500/10",
                },
              ] as const
            ).map((col) => {
              const colTasks = filteredTasks.filter(
                (t) => t.status === col.key,
              );
              return (
                <div
                  key={col.key}
                  onDragOver={(event) => {
                    if (viewMode === "client") return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    setDragOverStatus(col.key);
                  }}
                  onDragLeave={() => setDragOverStatus((current) => current === col.key ? null : current)}
                  onDrop={(event) => {
                    event.preventDefault();
                    void moveTaskToStatus(col.key);
                  }}
                  className={cn(
                    "min-h-[300px] space-y-3 rounded-2xl border bg-card/50 p-3 transition-colors",
                    dragOverStatus === col.key && "border-gilver bg-gilver/10",
                  )}
                >
                  <div
                    className={cn(
                      "flex items-center justify-between rounded-xl px-3 py-2",
                      col.bg,
                    )}
                  >
                    <h3 className={cn("text-sm font-semibold", col.color)}>
                      {col.label}
                    </h3>
                    <Badge variant="secondary" className="rounded-full text-xs">
                      {colTasks.length}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {colTasks.map((task) => (
                      <KanbanCard key={task.id} task={task} />
                    ))}
                    {colTasks.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-6">
                        Vazio
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* List View */
          <div className="space-y-3 animate-fade-in">
            {filteredTasks.map((task, index) => (
              <div
                key={task.id}
                onClick={() => setSelectedTask(task)}
                className={cn(
                  "glass rounded-2xl p-4 flex items-start gap-4 transition-all cursor-pointer hover:bg-accent/35",
                  task.status === "completed" && "opacity-60",
                  (task.status === "overdue" || task.status === "blocked") && "border border-red-500/30",
                )}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <Checkbox
                  checked={task.status === "completed"}
                  onCheckedChange={() => toggleTaskStatus(task.id)}
                  onClick={(event) => event.stopPropagation()}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3
                      className={cn(
                        "font-medium",
                        task.status === "completed" &&
                          "line-through text-muted-foreground",
                      )}
                    >
                      {task.title}
                    </h3>
                    {getPriorityBadge(task.priority)}
                    {getTypeBadge(task.type)}
                    <Badge variant="outline" className="text-xs">
                      {task.category}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {task.description}
                  </p>
                  {task.blockedReason && (
                    <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
                      {task.blockedReason}
                    </p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Prazo:{" "}
                      {new Date(task.dueDate).toLocaleDateString("pt-BR")}
                    </span>
                    {task.clientName && <span>Cliente: {task.clientName}</span>}
                    <span>Responsável: {task.assignedToName}</span>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1">
                  {getStatusIcon(task.status)}
                  {task.status !== "completed" && task.status !== "overdue" && task.status !== "blocked" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-6 px-2"
                      onClick={(event) => { event.stopPropagation(); void updateTaskStatus(task.id, "in_progress"); }}
                    >
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

        <Dialog open={Boolean(selectedTask)} onOpenChange={(open) => !open && setSelectedTask(null)}>
          <DialogContent className="sm:max-w-[560px]">
            {selectedTask && (
              <>
                <DialogHeader>
                  <DialogTitle>{selectedTask.title}</DialogTitle>
                  <DialogDescription>{selectedTask.clientName ?? "Sem cliente"} · {selectedTask.category}</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {getPriorityBadge(selectedTask.priority)}
                    {getTypeBadge(selectedTask.type)}
                    <Badge variant="outline" className="text-xs">
                      {selectedTask.status === "completed" ? "Concluída" : selectedTask.status === "in_progress" ? "Em andamento" : selectedTask.status === "overdue" ? "Atrasada" : selectedTask.status === "blocked" ? "Bloqueada" : "Pendente"}
                    </Badge>
                  </div>
                  {selectedTask.description && <p className="rounded-xl bg-muted/45 p-3 text-sm text-muted-foreground">{selectedTask.description}</p>}
                  {selectedTask.blockedReason && (
                    <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
                      {selectedTask.blockedReason}
                    </p>
                  )}
                  <div className="grid gap-3 text-sm sm:grid-cols-2">
                    <div><p className="text-xs text-muted-foreground">Prazo</p><p className="font-medium">{new Date(selectedTask.dueDate).toLocaleDateString("pt-BR")}</p></div>
                    <div><p className="text-xs text-muted-foreground">Responsável</p><p className="font-medium">{selectedTask.assignedToName || "Sem responsável"}</p></div>
                    <div><p className="text-xs text-muted-foreground">Criada em</p><p className="font-medium">{new Date(selectedTask.createdAt).toLocaleDateString("pt-BR")}</p></div>
                    <div><p className="text-xs text-muted-foreground">Concluída em</p><p className="font-medium">{selectedTask.completedAt ? new Date(selectedTask.completedAt).toLocaleDateString("pt-BR") : "—"}</p></div>
                  </div>
                </div>
                <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
                  {viewMode !== "client" && canDeleteTasks && (
                    <Button variant="destructive" className="rounded-xl" onClick={() => {
                      void deleteTask(selectedTask.id).then((removed) => {
                        if (removed) setSelectedTask(null);
                      });
                    }}>
                      <Trash2 className="mr-2 h-4 w-4" />Remover
                    </Button>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {selectedTask.status !== "pending" && (
                      <Button variant="outline" className="rounded-xl" onClick={() => { void updateTaskStatus(selectedTask.id, "pending"); setSelectedTask(null); }}>Marcar pendente</Button>
                    )}
                    {selectedTask.status !== "in_progress" && selectedTask.status !== "completed" && (
                      <Button variant="outline" className="rounded-xl" onClick={() => { void updateTaskStatus(selectedTask.id, "in_progress"); setSelectedTask(null); }}>Iniciar</Button>
                    )}
                    {selectedTask.status !== "blocked" && selectedTask.status !== "completed" && (
                      <Button variant="outline" className="rounded-xl" onClick={() => openBlockDialog(selectedTask)}>Bloquear</Button>
                    )}
                    {selectedTask.status !== "completed" && (
                      <Button className="rounded-xl" onClick={() => { void updateTaskStatus(selectedTask.id, "completed"); setSelectedTask(null); }}>Concluir</Button>
                    )}
                  </div>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
        <Dialog open={Boolean(blockTarget)} onOpenChange={(open) => {
          if (!open) {
            setBlockTarget(null);
            setBlockReason("");
          }
        }}>
          <DialogContent className="sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle>Bloquear tarefa</DialogTitle>
              <DialogDescription>
                {blockTarget?.title ?? "Informe o motivo do bloqueio operacional."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2 py-2">
              <Label>Motivo do bloqueio</Label>
              <Textarea
                value={blockReason}
                onChange={(event) => setBlockReason(event.target.value)}
                placeholder="Ex.: aguardando documento do cliente, orientação do sócio ou dado externo"
                className="min-h-28"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBlockTarget(null)}>Cancelar</Button>
              <Button onClick={() => void handleBlockTask()}>Bloquear</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Tasks;
