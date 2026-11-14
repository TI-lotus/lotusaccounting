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
  Eye,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { MultiSelectFilter } from "@/components/MultiSelectFilter";
import { BentoStatStrip } from "@/components/dashboard/BentoStatStrip";
import { IconTooltipButton } from "@/components/IconTooltipButton";
import { SortToggle } from "@/components/SortToggle";
import { BentoDataTable } from "@/components/BentoDataTable";
import { RowActions } from "@/components/RowActions";
import { ConfirmDestructiveDialog } from "@/components/ConfirmDestructiveDialog";
import { toast } from "sonner";

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
  const { tasks, addTask, generateRecurringTasks, updateTaskStatus, deleteTask, clients, tenantId } = useData();
  const { viewMode } = useViewMode();
  const { user, profile } = useAuth();
  const canCreateTasks = useWorkspacePermission({
    tenantId,
    userId: user?.id,
    accountType: profile?.account_type,
    resource: "tasks",
    action: "create",
  });
  const canUpdateTasks = useWorkspacePermission({
    tenantId,
    userId: user?.id,
    accountType: profile?.account_type,
    resource: "tasks",
    action: "update",
  });
  const canDeleteTasks = useWorkspacePermission({
    tenantId,
    userId: user?.id,
    accountType: profile?.account_type,
    resource: "tasks",
    action: "delete",
  });
  const [statusFilters, setStatusFilters] = useState<TaskStatus[]>([]);
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [taskSort, setTaskSort] = useState<"asc" | "desc">("asc");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewType, setViewType] = useState<"list" | "grid" | "calendar">(
    viewMode === "client" ? "grid" : "list",
  );
  const [dateRange, setDateRange] = useState(currentMonthRange);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<TaskStatus | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TaskData | null>(null);
  const [blockTarget, setBlockTarget] = useState<TaskData | null>(null);
  const [blockReason, setBlockReason] = useState("");
  const [generatingRecurrences, setGeneratingRecurrences] = useState(false);
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

  useEffect(() => {
    if (viewMode !== "client" && canCreateTasks) {
      void generateRecurringTasks();
    }
  }, [canCreateTasks, generateRecurringTasks, viewMode]);

  const assignees = activeAssignees.length
    ? activeAssignees.map((member) => [member.user_id, member.full_name || "Sem nome"] as [string, string])
    : user?.id ? [[user.id, currentUserName] as [string, string]] : [];

  const filteredTasks = filterTasks(tasks, {
    status: "all",
    clientId: clientFilter,
    assignedToId: assigneeFilter,
    type: typeFilter,
  }).filter((task) => statusFilters.length === 0 || statusFilters.includes(task.status))
    .sort((a, b) => {
      const first = new Date(a.dueDate).getTime();
      const second = new Date(b.dueDate).getTime();
      return taskSort === "asc" ? first - second : second - first;
    });

  const toggleTaskStatus = (taskId: string) => {
    if (!canUpdateTasks) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const newStatus: TaskStatus =
      task.status === "completed" ? "pending" : "completed";
    updateTaskStatus(taskId, newStatus);
  };

  const handleCreateTask = async () => {
    if (!canCreateTasks) return;
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

  const handleGenerateRecurringTasks = async () => {
    if (!canCreateTasks || generatingRecurrences) return;
    setGeneratingRecurrences(true);
    try {
      const generated = await generateRecurringTasks();
      toast.success(
        generated > 0
          ? `${generated} ocorrência(s) recorrente(s) gerada(s).`
          : "Nenhuma nova ocorrência recorrente para gerar.",
      );
    } finally {
      setGeneratingRecurrences(false);
    }
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
    if (!blockTarget || !canUpdateTasks) return;
    const ok = await updateTaskStatus(blockTarget.id, "blocked", blockReason);
    if (!ok) return;
    setSelectedTask(null);
    setBlockTarget(null);
    setBlockReason("");
  };

  const moveTaskToStatus = async (status: TaskStatus) => {
    if (!draggedTaskId || viewMode === "client" || !canUpdateTasks) return;
    const task = tasks.find((item) => item.id === draggedTaskId);
    setDragOverStatus(null);
    setDraggedTaskId(null);
    if (!task || task.status === status) return;
    await updateTaskStatus(task.id, status);
  };

  const KanbanCard = ({ task }: { task: TaskData }) => (
    <button
      type="button"
      draggable={viewMode !== "client" && canUpdateTasks}
      onDragStart={(event) => {
        if (viewMode === "client" || !canUpdateTasks) return;
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", task.id);
        setDraggedTaskId(task.id);
      }}
      onDragEnd={() => {
        setDraggedTaskId(null);
        setDragOverStatus(null);
      }}
      onClick={() => setSelectedTask(task)}
      aria-label={`Abrir detalhes de ${task.title}`}
      className={cn(
        "block w-full rounded-xl border border-border/70 bg-background/70 p-3 text-left transition-[transform,background-color,border-color] duration-200 hover:-translate-y-0.5 hover:border-gilver/50 hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
        viewMode !== "client" ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
        draggedTaskId === task.id && "opacity-45",
        (task.status === "overdue" || task.status === "blocked") && "border-red-500/30 bg-red-500/5",
      )}
    >
      <span className="block truncate text-sm font-medium leading-tight">
        {task.title}
      </span>
      <span className="mt-2 flex items-center justify-between gap-2 border-t border-border/50 pt-2 text-[11px] text-muted-foreground">
        <span className="min-w-0 truncate">{task.clientName || "Sem cliente"}</span>
        <span className="flex shrink-0 items-center gap-1 whitespace-nowrap">
          <Calendar className="h-3 w-3" aria-hidden="true" />
          {new Date(task.dueDate).toLocaleDateString("pt-BR")}
        </span>
      </span>
    </button>
  );

  const taskViewControls = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <div className="flex gap-1 rounded-full border border-border bg-card p-1">
        {[
          { icon: LayoutList, label: "Lista", value: "list" },
          { icon: Columns3, label: "Kanban", value: "grid" },
          { icon: Calendar, label: "Calendário", value: "calendar" },
        ].map((item) => (
          <IconTooltipButton
            key={item.value}
            icon={item.icon}
            label={item.label}
            variant={viewType === item.value ? "default" : "ghost"}
            className="rounded-full"
            aria-pressed={viewType === item.value}
            onClick={() => setViewType(item.value as typeof viewType)}
          />
        ))}
      </div>
      <FilterPopover
        title="Filtrar tarefas"
        activeCount={[statusFilters.length > 0, typeFilter !== "all", clientFilter !== "all", assigneeFilter !== "all"].filter(Boolean).length}
        description="Combine status, tipo, cliente e responsável."
        onClear={() => {
          setStatusFilters([]);
          setTypeFilter("all");
          setClientFilter("all");
          setAssigneeFilter("all");
        }}
      >
        <MultiSelectFilter
          label="Status"
          options={[
            { value: "overdue", label: "Atrasadas" },
            { value: "blocked", label: "Bloqueadas" },
            { value: "pending", label: "Pendentes" },
            { value: "in_progress", label: "Em andamento" },
            { value: "completed", label: "Concluídas" },
          ]}
          value={statusFilters}
          onChange={(value) => setStatusFilters(value as TaskStatus[])}
        />
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full text-sm"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos tipos</SelectItem>
            <SelectItem value="monthly">Mensal</SelectItem>
            <SelectItem value="annual">Anual</SelectItem>
            <SelectItem value="one_time">Única</SelectItem>
          </SelectContent>
        </Select>
        {viewMode !== "client" && (
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="w-full text-sm"><SelectValue placeholder="Cliente" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos clientes</SelectItem>
              {activeClients.map((client) => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {viewMode !== "client" && (
          <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
            <SelectTrigger className="w-full text-sm"><SelectValue placeholder="Responsável" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {assignees.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Ordenar</p>
          <Select value={taskSort} onValueChange={(value: "asc" | "desc") => setTaskSort(value)}>
            <SelectTrigger className="w-full text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="asc">Prazo mais próximo</SelectItem>
              <SelectItem value="desc">Prazo mais distante</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </FilterPopover>
      <SortToggle label="prazo" direction={taskSort} onChange={setTaskSort} />
    </div>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between animate-fade-in">
          <div>
            <h1 className="text-[28px] font-normal tracking-[-0.035em]">
              Minhas Tarefas
            </h1>
            <p className="text-muted-foreground">
              Gerencie suas tarefas e pendências
            </p>
          </div>
          <div className="flex gap-2">
            {viewMode !== "client" && canCreateTasks && (
              <IconTooltipButton
                icon={RefreshCw}
                label="Gerar ocorrências recorrentes"
                className="rounded-full"
                onClick={() => void handleGenerateRecurringTasks()}
                disabled={generatingRecurrences}
              />
            )}
            {viewMode !== "client" && canCreateTasks && (
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

        <BentoStatStrip
          className="animate-fade-in"
          items={[
            { label: "Atrasadas", value: overdueCount, icon: AlertTriangle, compact: true },
            { label: "Bloqueadas", value: blockedCount, icon: LockKeyhole, compact: true },
            { label: "Pendentes", value: pendingCount, icon: AlertCircle, compact: true },
            { label: "Em andamento", value: inProgressCount, icon: Clock, compact: true },
            { label: "Concluídas", value: completedCount, icon: CheckCircle2, compact: true },
          ]}
        />

        {viewType === "calendar" ? (
          <CalendarEventView
            title="Calendário de tarefas"
            headerActions={taskViewControls}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            events={filteredTasks.map((task) => ({
              day: new Date(task.dueDate).getDate(),
              date: task.dueDate,
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
        ) : (
          <section className="page-section space-y-4 animate-fade-in">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-medium">{viewType === "grid" ? "Kanban de tarefas" : "Lista de tarefas"}</h2>
                <p className="mt-1 text-sm text-muted-foreground">Acompanhe e atualize as tarefas deste escopo.</p>
              </div>
              {taskViewControls}
            </div>
            {viewMode === "client" && (
              <div className="rounded-xl border border-border/70 bg-secondary/35 p-4 text-sm text-muted-foreground">
                As tarefas do cliente reúnem dados, documentos e pagamentos enviados para a Lotus.
              </div>
            )}
            {viewType === "grid" ? (
          <div className="custom-scroll min-w-0 overflow-x-auto pb-2">
            <div className="grid min-w-[1180px] grid-cols-5 gap-4 animate-fade-in">
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
                    "min-h-[360px] rounded-2xl border border-border/70 bg-card p-4 transition-[border-color,background-color,box-shadow] duration-200",
                    dragOverStatus === col.key && "border-gilver bg-gilver/10",
                    draggedTaskId && "shadow-sm",
                  )}
                >
                  <div className="flex items-start justify-between gap-3 border-b border-border/70 pb-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", col.bg, col.color)}>
                        {getStatusIcon(col.key)}
                      </div>
                      <div className="min-w-0">
                        <h3 className={cn("truncate text-xs font-medium uppercase tracking-[0.12em]", col.color)}>
                          {col.label}
                        </h3>
                        <p className="mt-1 text-xs text-muted-foreground">Tarefas neste estágio</p>
                      </div>
                    </div>
                    <span className="text-2xl font-semibold tabular-nums tracking-tight">
                      {colTasks.length}
                    </span>
                  </div>
                  <div className="custom-scroll mt-3 max-h-[min(58vh,560px)] space-y-2 overflow-y-auto pr-1">
                    {colTasks.map((task) => (
                      <KanbanCard key={task.id} task={task} />
                    ))}
                    {colTasks.length === 0 && (
                      <p className="rounded-xl border border-dashed border-border/70 px-3 py-8 text-center text-xs text-muted-foreground">
                        Vazio
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        ) : (
          /* List View */
          <BentoDataTable
            rows={filteredTasks}
            getRowKey={(task) => task.id}
            empty={<span>Nenhuma tarefa encontrada.</span>}
            columns={[
              {
                key: "task",
                label: "Tarefa",
                render: (task) => <div className="min-w-0"><p className={cn("max-w-[300px] truncate font-medium", task.status === "completed" && "text-muted-foreground line-through")}>{task.title}</p><p className="max-w-[300px] truncate text-xs text-muted-foreground">{task.description || task.category}</p></div>,
              },
              {
                key: "client",
                label: "Cliente",
                render: (task) => <span className="block max-w-[180px] truncate text-sm text-muted-foreground">{task.clientName || "Sem cliente"}</span>,
              },
              {
                key: "responsible",
                label: "Responsável",
                render: (task) => <span className="block max-w-[150px] truncate text-sm text-muted-foreground">{task.assignedToName || "Sem responsável"}</span>,
              },
              {
                key: "dueDate",
                label: "Prazo",
                sortValue: (task) => task.dueDate ? new Date(task.dueDate) : null,
                render: (task) => <span className="whitespace-nowrap text-sm text-muted-foreground">{new Date(task.dueDate).toLocaleDateString("pt-BR")}</span>,
              },
              {
                key: "tags",
                label: "Tags",
                render: (task) => <div className="flex max-w-[180px] flex-wrap gap-1">{getPriorityBadge(task.priority)}{getTypeBadge(task.type)}<Badge variant="outline" className="text-[10px]">{task.category}</Badge></div>,
              },
              {
                key: "status",
                label: "Status",
                render: (task) => <div className="flex items-center gap-2">{getStatusIcon(task.status)}<Badge variant="outline" className="text-[10px]">{task.status === "completed" ? "Concluída" : task.status === "in_progress" ? "Em andamento" : task.status === "overdue" ? "Atrasada" : task.status === "blocked" ? "Bloqueada" : "Pendente"}</Badge></div>,
              },
            ]}
            actions={(task) => (
              <RowActions
                primaryLabel={`Abrir tarefa ${task.title}`}
                primaryIcon={Eye}
                onPrimary={() => setSelectedTask(task)}
                menuItems={[
                  ...(canUpdateTasks && task.status !== "completed" ? [{ label: "Concluir", icon: CheckCircle2, onSelect: () => void updateTaskStatus(task.id, "completed") }] : []),
                  ...(canUpdateTasks && task.status !== "in_progress" && task.status !== "completed" ? [{ label: "Iniciar", icon: Clock, onSelect: () => void updateTaskStatus(task.id, "in_progress") }] : []),
                  ...(viewMode !== "client" && canDeleteTasks ? [{ label: "Remover tarefa", icon: Trash2, destructive: true, separatorBefore: true, onSelect: () => setDeleteTarget(task) }] : []),
                ]}
              />
            )}
          />
            )}
          </section>
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
                      setDeleteTarget(selectedTask);
                    }}>
                      <Trash2 className="mr-2 h-4 w-4" />Remover
                    </Button>
                  )}
                  <div className="flex flex-wrap gap-2">
                  {canUpdateTasks && selectedTask.status !== "pending" && (
                      <Button variant="outline" className="rounded-xl" onClick={() => { void updateTaskStatus(selectedTask.id, "pending"); setSelectedTask(null); }}>Marcar pendente</Button>
                    )}
                    {canUpdateTasks && selectedTask.status !== "in_progress" && selectedTask.status !== "completed" && (
                      <Button variant="outline" className="rounded-xl" onClick={() => { void updateTaskStatus(selectedTask.id, "in_progress"); setSelectedTask(null); }}>Iniciar</Button>
                    )}
                    {canUpdateTasks && selectedTask.status !== "blocked" && selectedTask.status !== "completed" && (
                      <Button variant="outline" className="rounded-xl" onClick={() => openBlockDialog(selectedTask)}>Bloquear</Button>
                    )}
                    {canUpdateTasks && selectedTask.status !== "completed" && (
                      <Button className="rounded-xl" onClick={() => { void updateTaskStatus(selectedTask.id, "completed"); setSelectedTask(null); }}>Concluir</Button>
                    )}
                  </div>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
        <ConfirmDestructiveDialog
          open={Boolean(deleteTarget)}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          title="Remover tarefa?"
          description={deleteTarget ? `A tarefa “${deleteTarget.title}” será removida do workspace. Essa ação não pode ser desfeita.` : "A tarefa selecionada será removida do workspace."}
          onConfirm={async () => {
            if (!deleteTarget) return false;
            const removed = await deleteTask(deleteTarget.id);
            if (removed) {
              setSelectedTask((current) => current?.id === deleteTarget.id ? null : current);
              setDeleteTarget(null);
            }
            return removed;
          }}
        />
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
