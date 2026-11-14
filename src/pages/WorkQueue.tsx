import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileQuestion,
  Inbox,
  LockKeyhole,
  MessageSquare,
  Play,
  Plus,
  Send,
  ShieldAlert,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { useWorkspacePermission } from "@/hooks/useWorkspacePermission";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { FilterPopover } from "@/components/FilterPopover";
import { BentoStatStrip } from "@/components/dashboard/BentoStatStrip";
import {
  ClientData,
  ClientPeriodChecklistItemData,
  ClientPeriodData,
  DocumentRequestData,
  OperationalCommentData,
  OperationalCommentTargetType,
  TaskData,
  TaskReviewData,
} from "@/types";

type QueueSectionKey =
  | "overdue"
  | "today"
  | "upcoming"
  | "waiting_client"
  | "review"
  | "blocked";

type QueueRow =
  | {
      id: string;
      kind: "task";
      task: TaskData;
      client: ClientData | null;
      period: ClientPeriodData | null;
      checklistItem: ClientPeriodChecklistItemData | null;
      section: QueueSectionKey;
      nextAction: string;
    }
  | {
      id: string;
      kind: "document_request";
      request: DocumentRequestData;
      client: ClientData | null;
      period: ClientPeriodData | null;
      section: QueueSectionKey;
      nextAction: string;
    }
  | {
      id: string;
      kind: "checklist";
      checklistItem: ClientPeriodChecklistItemData;
      task: TaskData | null;
      review: TaskReviewData | null;
      client: ClientData | null;
      period: ClientPeriodData | null;
      section: QueueSectionKey;
      nextAction: string;
    };

type WorkspaceMember = {
  user_id: string;
  full_name: string | null;
  account_type: string | null;
};

const todayIso = new Date().toISOString().slice(0, 10);

const parseDate = (value: string | null | undefined) => {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return new Date(value);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
};

const formatDate = (value: string | null | undefined) => {
  const date = parseDate(value);
  if (!date || Number.isNaN(date.getTime())) return "Sem prazo";
  return date.toLocaleDateString("pt-BR");
};

const daysUntil = (value: string | null | undefined) => {
  const date = parseDate(value);
  if (!date || Number.isNaN(date.getTime())) return null;
  const today = parseDate(todayIso);
  if (!today) return null;
  return Math.ceil((date.getTime() - today.getTime()) / 86_400_000);
};

const periodLabel = (period: ClientPeriodData | null) =>
  period
    ? `${String(period.periodMonth).padStart(2, "0")}/${period.periodYear}`
    : "Sem competência";

const priorityLabel: Record<string, string> = {
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};

const statusLabel: Record<string, string> = {
  pending: "Pendente",
  in_progress: "Em andamento",
  completed: "Concluída",
  overdue: "Atrasada",
  requested: "Solicitado",
  uploaded: "Enviado",
  approved: "Aprovado",
  rejected: "Recusado",
  waived: "Dispensado",
  in_review: "Em revisão",
  blocked: "Bloqueado",
};

const sectionMeta: Record<
  QueueSectionKey,
  { title: string; description: string; icon: typeof Inbox; badgeClass: string }
> = {
  overdue: {
    title: "Atrasadas",
    description: "Itens que precisam de ação imediata.",
    icon: AlertTriangle,
    badgeClass: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  },
  today: {
    title: "Para hoje",
    description: "Execução esperada no dia.",
    icon: CalendarDays,
    badgeClass:
      "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  },
  upcoming: {
    title: "Próximas",
    description: "Vencimentos dos próximos sete dias.",
    icon: Clock3,
    badgeClass:
      "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  },
  waiting_client: {
    title: "Aguardando cliente",
    description: "Pendências documentais abertas ou recusadas.",
    icon: FileQuestion,
    badgeClass:
      "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  },
  review: {
    title: "Em revisão",
    description: "Itens do checklist aguardando conferência.",
    icon: LockKeyhole,
    badgeClass:
      "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  },
  blocked: {
    title: "Bloqueadas",
    description: "Itens parados por impedimento operacional.",
    icon: ShieldAlert,
    badgeClass: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  },
};

const WorkQueue = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const {
    tenantId,
    clients,
    tasks,
    clientPeriods,
    clientPeriodChecklistItems,
    documentRequests,
    updateTaskStatus,
    updateClientPeriodChecklistItem,
    taskReviews,
    operationalComments,
    requestTaskReview,
    approveTaskReview,
    rejectTaskReview,
    createOperationalComment,
    createDocumentRequest,
  } = useData();
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>("all");
  const [requestTarget, setRequestTarget] = useState<{
    client: ClientData;
    period: ClientPeriodData | null;
  } | null>(null);
  const [newRequest, setNewRequest] = useState({
    title: "",
    description: "",
    documentType: "outros",
    dueDate: "",
  });
  const [rejectReviewTarget, setRejectReviewTarget] = useState<TaskReviewData | null>(null);
  const [reviewComment, setReviewComment] = useState("");
  const [commentTarget, setCommentTarget] = useState<{
    targetType: OperationalCommentTargetType;
    targetId: string;
    title: string;
  } | null>(null);
  const [commentBody, setCommentBody] = useState("");

  const isAdmin = profile?.account_type === "admin";
  const canCreateDocuments = useWorkspacePermission({ tenantId, userId: user?.id, accountType: profile?.account_type, resource: "documents", action: "create" });
  const canUpdateTasks = useWorkspacePermission({ tenantId, userId: user?.id, accountType: profile?.account_type, resource: "tasks", action: "update" });
  const canUpdateClients = useWorkspacePermission({ tenantId, userId: user?.id, accountType: profile?.account_type, resource: "clients", action: "update" });
  const canComment = canUpdateTasks || canUpdateClients;

  useEffect(() => {
    if (!tenantId) {
      setMembers([]);
      return;
    }
    void supabase
      .from("profiles")
      .select("user_id, full_name, account_type")
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .in("account_type", ["admin", "collaborator"])
      .order("full_name")
      .then(({ data, error }) => {
        if (error) {
          toast.error("Não foi possível carregar colaboradores");
          return;
        }
        setMembers((data ?? []) as WorkspaceMember[]);
      });
  }, [tenantId]);

  useEffect(() => {
    if (!user?.id) return;
    setSelectedMemberId((current) => {
      if (isAdmin) return current || "all";
      return user.id;
    });
  }, [isAdmin, user?.id]);

  const clientById = useMemo(
    () => new Map(clients.map((client) => [client.id, client])),
    [clients],
  );
  const taskById = useMemo(
    () => new Map(tasks.map((task) => [task.id, task])),
    [tasks],
  );
  const periodById = useMemo(
    () => new Map(clientPeriods.map((period) => [period.id, period])),
    [clientPeriods],
  );

  const currentPeriodByCompany = useMemo(() => {
    const map = new Map<string, ClientPeriodData>();
    const current = new Date();
    const month = current.getMonth() + 1;
    const year = current.getFullYear();
    clientPeriods
      .filter(
        (period) =>
          period.periodMonth === month && period.periodYear === year,
      )
      .forEach((period) => map.set(period.companyId, period));
    return map;
  }, [clientPeriods]);

  const checklistByTaskId = useMemo(() => {
    const map = new Map<string, ClientPeriodChecklistItemData>();
    clientPeriodChecklistItems.forEach((item) => {
      if (item.taskId) map.set(item.taskId, item);
    });
    return map;
  }, [clientPeriodChecklistItems]);

  const pendingReviewByTaskId = useMemo(() => {
    const map = new Map<string, TaskReviewData>();
    taskReviews
      .filter((review) => review.status === "pending_review")
      .forEach((review) => map.set(review.taskId, review));
    return map;
  }, [taskReviews]);

  const commentsByTarget = useMemo(() => {
    const map = new Map<string, OperationalCommentData[]>();
    operationalComments.forEach((comment) => {
      const key = `${comment.targetType}:${comment.targetId}`;
      const current = map.get(key) ?? [];
      current.push(comment);
      map.set(
        key,
        current.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      );
    });
    return map;
  }, [operationalComments]);

  const latestRejectedReviewByTaskId = useMemo(() => {
    const map = new Map<string, TaskReviewData>();
    taskReviews
      .filter((review) => review.status === "rejected")
      .forEach((review) => {
        const current = map.get(review.taskId);
        if (!current || review.updatedAt > current.updatedAt) {
          map.set(review.taskId, review);
        }
      });
    return map;
  }, [taskReviews]);

  const isResponsibleForClient = useCallback((client: ClientData | null) => {
    if (!client) return false;
    if (isAdmin && selectedMemberId === "all") return true;
    return client.responsibleUserId === selectedMemberId;
  }, [isAdmin, selectedMemberId]);

  const isResponsibleForTask = useCallback((task: TaskData) => {
    if (isAdmin && selectedMemberId === "all") return true;
    if (task.assignedToId === selectedMemberId) return true;
    const client = task.clientId ? clientById.get(task.clientId) ?? null : null;
    return isResponsibleForClient(client);
  }, [clientById, isAdmin, isResponsibleForClient, selectedMemberId]);

  const queueRows = useMemo(() => {
    const rows: QueueRow[] = [];

    tasks
      .filter((task) => task.status !== "completed")
      .filter(isResponsibleForTask)
      .forEach((task) => {
        const dueDistance = daysUntil(task.dueDate);
        const client = task.clientId ? clientById.get(task.clientId) ?? null : null;
        const checklistItem = checklistByTaskId.get(task.id) ?? null;
        const period = checklistItem
          ? periodById.get(checklistItem.clientPeriodId) ?? null
          : client?.id
            ? currentPeriodByCompany.get(client.id) ?? null
            : null;
        const section: QueueSectionKey =
          task.status === "blocked"
            ? "blocked"
            : task.status === "overdue" || (dueDistance !== null && dueDistance < 0)
            ? "overdue"
            : dueDistance === 0
              ? "today"
              : "upcoming";

        if (section === "upcoming" && dueDistance !== null && dueDistance > 7) return;

        rows.push({
          id: `task-${task.id}`,
          kind: "task",
          task,
          client,
          period,
          checklistItem,
          section,
          nextAction:
            task.status === "blocked"
              ? "Resolver bloqueio"
              : checklistItem?.requiresReview && task.status === "in_progress"
              ? "Enviar para revisão"
              : task.status === "in_progress"
                ? "Concluir"
                : "Iniciar",
        });
      });

    documentRequests
      .filter((request) => ["requested", "rejected"].includes(request.status))
      .forEach((request) => {
        const client = clientById.get(request.companyId) ?? null;
        if (!isResponsibleForClient(client)) return;
        rows.push({
          id: `document-${request.id}`,
          kind: "document_request",
          request,
          client,
          period: request.clientPeriodId
            ? periodById.get(request.clientPeriodId) ?? null
            : null,
          section: "waiting_client",
          nextAction:
            request.status === "rejected"
              ? "Aguardar reenvio"
              : "Aguardar envio",
        });
      });

    clientPeriodChecklistItems
      .filter((item) => item.status === "in_review" || item.status === "blocked")
      .forEach((item) => {
        const client = clientById.get(item.companyId) ?? null;
        const task = item.taskId ? taskById.get(item.taskId) ?? null : null;
        if (task ? !isResponsibleForTask(task) : !isResponsibleForClient(client)) return;
        rows.push({
          id: `checklist-${item.id}`,
          kind: "checklist",
          checklistItem: item,
          task,
          review: item.taskId ? pendingReviewByTaskId.get(item.taskId) ?? null : null,
          client,
          period: periodById.get(item.clientPeriodId) ?? null,
          section: item.status === "blocked" ? "blocked" : "review",
          nextAction:
            item.status === "blocked" ? "Resolver impedimento" : "Concluir revisão",
        });
      });

    return rows.sort((a, b) => {
      const dateA =
        a.kind === "task"
          ? a.task.dueDate
          : a.kind === "document_request"
            ? a.request.dueDate
            : a.checklistItem.dueDate;
      const dateB =
        b.kind === "task"
          ? b.task.dueDate
          : b.kind === "document_request"
            ? b.request.dueDate
            : b.checklistItem.dueDate;
      return (dateA ?? "9999-12-31").localeCompare(dateB ?? "9999-12-31");
    });
  }, [
    checklistByTaskId,
    clientById,
    clientPeriodChecklistItems,
    currentPeriodByCompany,
    documentRequests,
    isResponsibleForClient,
    isResponsibleForTask,
    pendingReviewByTaskId,
    periodById,
    taskById,
    tasks,
  ]);

  const rowsBySection = useMemo(() => {
    const map = new Map<QueueSectionKey, QueueRow[]>();
    (Object.keys(sectionMeta) as QueueSectionKey[]).forEach((key) =>
      map.set(key, []),
    );
    queueRows.forEach((row) => map.get(row.section)?.push(row));
    return map;
  }, [queueRows]);

  const ownedClients = useMemo(
    () =>
      clients.filter((client) =>
        isAdmin && selectedMemberId === "all"
          ? client.status === "active"
          : client.status === "active" &&
            client.responsibleUserId === selectedMemberId,
      ),
    [clients, isAdmin, selectedMemberId],
  );

  const visibleTasks = useMemo(
    () => tasks.filter(isResponsibleForTask),
    [isResponsibleForTask, tasks],
  );

  const stats = useMemo(() => {
    const completedToday = visibleTasks.filter(
      (task) => task.completedAt?.slice(0, 10) === todayIso,
    ).length;
    return {
      completedToday,
      overdue: rowsBySection.get("overdue")?.length ?? 0,
      review: rowsBySection.get("review")?.length ?? 0,
      clients: ownedClients.length,
    };
  }, [ownedClients.length, rowsBySection, visibleTasks]);

  const selectedMemberLabel =
    selectedMemberId === "all"
      ? "Todos"
      : members.find((member) => member.user_id === selectedMemberId)?.full_name ||
        profile?.full_name ||
        user?.email ||
        "Colaborador";

  const openRequestDialog = (client: ClientData | null, period: ClientPeriodData | null) => {
    if (!client) {
      toast.error("Selecione um cliente para solicitar documento");
      return;
    }
    setRequestTarget({ client, period });
    setNewRequest({
      title: "",
      description: "",
      documentType: "outros",
      dueDate: "",
    });
  };

  const handleCreateDocumentRequest = async () => {
    if (!canCreateDocuments) {
      toast.error("Seu perfil não tem permissão para solicitar documentos.");
      return;
    }
    if (!requestTarget || !newRequest.title.trim()) {
      toast.error("Informe o documento solicitado");
      return;
    }
    const saved = await createDocumentRequest({
      companyId: requestTarget.client.id,
      clientPeriodId: requestTarget.period?.id ?? null,
      assignedTo: null,
      title: newRequest.title.trim(),
      description: newRequest.description.trim() || null,
      documentType: newRequest.documentType.trim() || "outros",
      dueDate: newRequest.dueDate || null,
    });
    if (!saved) return;
    toast.success("Documento solicitado ao cliente");
    setRequestTarget(null);
  };

  const sendTaskToReview = async (
    task: TaskData,
    checklistItem: ClientPeriodChecklistItemData | null,
  ) => {
    if (!canUpdateTasks) {
      toast.error("Seu perfil não tem permissão para atualizar tarefas.");
      return;
    }
    if (!checklistItem) {
      toast.info("Esta tarefa ainda não possui item de checklist vinculado para revisão.");
      return;
    }
    const review = await requestTaskReview(task.id);
    if (!review) return;
    if (checklistItem.status !== "in_review") {
      const ok = await updateClientPeriodChecklistItem(checklistItem.id, "in_review");
      if (!ok) return;
    }
    if (task.status === "pending" || task.status === "overdue" || task.status === "blocked") {
      await updateTaskStatus(task.id, "in_progress");
    }
    toast.success("Tarefa enviada para revisão");
  };

  const completeTask = async (
    task: TaskData,
    checklistItem: ClientPeriodChecklistItemData | null,
  ) => {
    if (!canUpdateTasks) {
      toast.error("Seu perfil não tem permissão para concluir tarefas.");
      return;
    }
    if (checklistItem?.requiresReview && checklistItem.status !== "in_review") {
      await sendTaskToReview(task, checklistItem);
      return;
    }
    const ok = await updateTaskStatus(task.id, "completed");
    if (ok) toast.success("Tarefa concluída");
  };

  const approveReview = async (
    item: ClientPeriodChecklistItemData,
    task: TaskData | null,
    review: TaskReviewData | null,
  ) => {
    if (!canUpdateTasks) {
      toast.error("Seu perfil não tem permissão para revisar tarefas.");
      return;
    }
    const ok = review
      ? await approveTaskReview(review.id)
      : await updateClientPeriodChecklistItem(item.id, "completed");
    if (!ok) return;
    if (!review && task && task.status !== "completed") await updateTaskStatus(task.id, "completed");
    toast.success("Revisão aprovada");
  };

  const openRejectReview = (review: TaskReviewData | null) => {
    if (!review) {
      toast.error("A revisão ainda não foi registrada para reprovação");
      return;
    }
    setRejectReviewTarget(review);
    setReviewComment(review.comment || "");
  };

  const handleRejectReview = async () => {
    if (!rejectReviewTarget || !canUpdateTasks) return;
    const ok = await rejectTaskReview(rejectReviewTarget.id, reviewComment);
    if (!ok) return;
    toast.success("Revisão reprovada");
    setRejectReviewTarget(null);
    setReviewComment("");
  };

  const openPeriod = (period: ClientPeriodData | null, client: ClientData | null) => {
    const params = new URLSearchParams();
    if (period) {
      params.set("month", String(period.periodMonth));
      params.set("year", String(period.periodYear));
      params.set("client", client?.id ?? period.companyId);
    } else if (client) {
      params.set("client", client.id);
    }
    navigate(params.size ? `/periods?${params.toString()}` : "/periods");
  };

  const authorName = (authorId: string | null) => {
    if (!authorId) return "Sistema";
    if (authorId === user?.id) return "Você";
    return members.find((member) => member.user_id === authorId)?.full_name || "Equipe";
  };

  const commentsFor = (targetType: OperationalCommentTargetType, targetId: string) =>
    commentsByTarget.get(`${targetType}:${targetId}`) ?? [];

  const openCommentDialog = (
    targetType: OperationalCommentTargetType,
    targetId: string,
    title: string,
  ) => {
    setCommentTarget({ targetType, targetId, title });
    setCommentBody("");
  };

  const handleCreateComment = async () => {
    if (!commentTarget || !canComment) return;
    const saved = await createOperationalComment(
      commentTarget.targetType,
      commentTarget.targetId,
      commentBody,
    );
    if (!saved) return;
    toast.success("Comentário registrado");
    setCommentBody("");
  };

  const RowCard = ({ row }: { row: QueueRow }) => {
    const client =
      row.kind === "task"
        ? row.client
        : row.kind === "document_request"
          ? row.client
          : row.client;
    const period =
      row.kind === "task"
        ? row.period
        : row.kind === "document_request"
          ? row.period
          : row.period;
    const dueDate =
      row.kind === "task"
        ? row.task.dueDate
        : row.kind === "document_request"
          ? row.request.dueDate
          : row.checklistItem.dueDate;
    const title =
      row.kind === "task"
        ? row.task.title
        : row.kind === "document_request"
          ? row.request.title
          : row.checklistItem.title;
    const status =
      row.kind === "task"
        ? row.task.status
        : row.kind === "document_request"
          ? row.request.status
          : row.checklistItem.status;
    const taskId =
      row.kind === "task"
        ? row.task.id
        : row.kind === "checklist"
          ? row.checklistItem.taskId
          : null;
    const latestRejectedReview = taskId
      ? latestRejectedReviewByTaskId.get(taskId) ?? null
      : null;
    const commentTargetInfo =
      row.kind === "checklist"
        ? {
            targetType: "checklist_item" as const,
            targetId: row.checklistItem.id,
            title,
          }
        : row.kind === "task"
          ? {
              targetType: "task" as const,
              targetId: row.task.id,
              title,
            }
          : period
            ? {
                targetType: "client_period" as const,
                targetId: period.id,
                title: `${client?.name ?? "Cliente"} · ${periodLabel(period)}`,
              }
            : null;
    const rowComments = commentTargetInfo
      ? commentsFor(commentTargetInfo.targetType, commentTargetInfo.targetId)
      : [];

    return (
      <div className="rounded-xl border border-border bg-background/70 p-3 transition-colors hover:bg-accent/30">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="min-w-0 truncate text-sm font-medium">{title}</p>
              <Badge variant="outline" className="text-[10px]">
                {statusLabel[status] ?? status}
              </Badge>
              {row.kind === "task" && (
                <Badge variant="secondary" className="text-[10px]">
                  {priorityLabel[row.task.priority]}
                </Badge>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>Cliente: {client?.name ?? "Sem cliente"}</span>
              <span>Competência: {periodLabel(period)}</span>
              <span>Prazo: {formatDate(dueDate)}</span>
            </div>
            {row.kind === "checklist" && row.checklistItem.blockedReason && (
              <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
                {row.checklistItem.blockedReason}
              </p>
            )}
            {row.kind === "task" && row.task.blockedReason && (
              <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
                {row.task.blockedReason}
              </p>
            )}
            {row.kind === "document_request" && row.request.rejectionReason && (
              <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
                {row.request.rejectionReason}
              </p>
            )}
            {latestRejectedReview?.comment && (
              <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
                <span className="font-medium">Última reprovação: </span>
                {latestRejectedReview.comment}
              </div>
            )}
            {rowComments.length > 0 && (
              <div className="mt-2 rounded-lg border border-border bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  Último comentário de {authorName(rowComments[0].authorId)}:{" "}
                </span>
                {rowComments[0].body}
              </div>
            )}
          </div>
          <Badge className={cn("text-[10px]", sectionMeta[row.section].badgeClass)}>
            {row.nextAction}
          </Badge>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {canUpdateTasks && row.kind === "task" && row.task.status !== "in_progress" && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 rounded-lg gap-1.5"
              onClick={() => void updateTaskStatus(row.task.id, "in_progress")}
            >
              <Play className="h-3.5 w-3.5" />
              Iniciar
            </Button>
          )}
          {canUpdateTasks && row.kind === "task" && row.checklistItem?.requiresReview && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 rounded-lg gap-1.5"
              onClick={() => void sendTaskToReview(row.task, row.checklistItem)}
            >
              <Send className="h-3.5 w-3.5" />
              Revisão
            </Button>
          )}
          {canUpdateTasks && row.kind === "task" && row.task.status !== "blocked" && (
            <Button
              size="sm"
              className="h-8 rounded-lg gap-1.5"
              onClick={() => void completeTask(row.task, row.checklistItem)}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Concluir
            </Button>
          )}
          {canUpdateTasks && row.kind === "checklist" && row.checklistItem.status === "in_review" && (
            <>
              <Button
                size="sm"
                className="h-8 rounded-lg gap-1.5"
                onClick={() => void approveReview(row.checklistItem, row.task, row.review)}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Aprovar
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 rounded-lg gap-1.5"
                onClick={() => openRejectReview(row.review)}
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                Reprovar
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-8 rounded-lg gap-1.5"
            onClick={() => openPeriod(period, client)}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Competência
          </Button>
          {canCreateDocuments && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 rounded-lg gap-1.5"
              onClick={() => openRequestDialog(client, period)}
            >
              <Plus className="h-3.5 w-3.5" />
              Solicitar documento
            </Button>
          )}
          {commentTargetInfo && canComment && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 rounded-lg gap-1.5"
              onClick={() => openCommentDialog(commentTargetInfo.targetType, commentTargetInfo.targetId, commentTargetInfo.title)}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Comentar
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-[28px] font-normal tracking-[-0.035em]">Minha fila</h1>
            <p className="text-muted-foreground">
              Execução diária por colaborador, cliente e competência.
            </p>
          </div>
        </div>

        <section className="page-section space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-medium">Execução da fila</h2>
              <p className="mt-1 text-sm text-muted-foreground">Acompanhe os indicadores e os itens filtrados no mesmo contexto.</p>
            </div>
            {isAdmin ? (
              <FilterPopover
                title="Responsável da fila"
                description="Alterne a visão da fila entre todos os colaboradores ou uma pessoa específica."
                activeCount={selectedMemberId === "all" ? 0 : 1}
                onClear={() => setSelectedMemberId("all")}
              >
                <div className="space-y-1.5">
                  <Label htmlFor="queue-member">Colaborador</Label>
                  <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                    <SelectTrigger id="queue-member" className="w-full rounded-xl">
                      <SelectValue placeholder="Todos colaboradores" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos colaboradores</SelectItem>
                      {members.map((member) => (
                        <SelectItem key={member.user_id} value={member.user_id}>
                          {member.full_name || "Sem nome"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </FilterPopover>
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
                <UserCheck className="h-4 w-4" aria-hidden="true" />
                <span>{selectedMemberLabel}</span>
              </div>
            )}
          </div>

          <BentoStatStrip
            className="animate-fade-in"
            items={[
              { label: "Concluídas hoje", value: stats.completedToday, icon: CheckCircle2, compact: true },
              { label: "Atrasadas", value: stats.overdue, icon: AlertTriangle, compact: true },
              { label: "Em revisão", value: stats.review, icon: LockKeyhole, compact: true },
              { label: "Clientes sob responsabilidade", value: stats.clients, icon: UserCheck, compact: true },
            ]}
          />

          <div className="grid gap-4 xl:grid-cols-2">
          {(Object.keys(sectionMeta) as QueueSectionKey[]).map((section) => {
            const meta = sectionMeta[section];
            const Icon = meta.icon;
            const rows = rowsBySection.get(section) ?? [];
            return (
              <Card key={section}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        {meta.title}
                      </CardTitle>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {meta.description}
                      </p>
                    </div>
                    <Badge className={cn("text-[10px]", meta.badgeClass)}>
                      {rows.length}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                    {rows.map((row) => (
                      <RowCard key={row.id} row={row} />
                    ))}
                    {rows.length === 0 && (
                      <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                        <Inbox className="mx-auto mb-2 h-8 w-8 opacity-45" />
                        Nada nesta seção.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
          </div>
        </section>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Critério operacional da fila</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            A fila combina tarefas atribuídas, clientes sob responsabilidade,
            documentos aguardando o cliente e itens de checklist em revisão ou
            bloqueados. Administradores podem alternar o colaborador; demais
            usuários veem a própria responsabilidade.
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={Boolean(requestTarget)}
        onOpenChange={(open) => !open && setRequestTarget(null)}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Solicitar documento</DialogTitle>
            <DialogDescription>
              {requestTarget
                ? `${requestTarget.client.name} · ${periodLabel(requestTarget.period)}`
                : "Crie uma pendência documental para o cliente."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="queue-request-title">Título</Label>
              <Input
                id="queue-request-title"
                name="document-request-title"
                value={newRequest.title}
                onChange={(event) =>
                  setNewRequest((prev) => ({ ...prev, title: event.target.value }))
                }
                placeholder="Ex.: Extrato bancário do mês…"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="queue-request-description">Descrição</Label>
              <Textarea
                id="queue-request-description"
                name="document-request-description"
                value={newRequest.description}
                onChange={(event) =>
                  setNewRequest((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }))
                }
                placeholder="Detalhe o arquivo esperado…"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="queue-request-type">Tipo</Label>
                <Input
                  id="queue-request-type"
                  name="document-request-type"
                  value={newRequest.documentType}
                  onChange={(event) =>
                    setNewRequest((prev) => ({
                      ...prev,
                      documentType: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="queue-request-due-date">Vencimento</Label>
                <Input
                  id="queue-request-due-date"
                  name="document-request-due-date"
                  type="date"
                  value={newRequest.dueDate}
                  onChange={(event) =>
                    setNewRequest((prev) => ({
                      ...prev,
                      dueDate: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestTarget(null)}>
              Cancelar
            </Button>
            <Button onClick={() => void handleCreateDocumentRequest()}>
              Solicitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(rejectReviewTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setRejectReviewTarget(null);
            setReviewComment("");
          }
        }}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Reprovar revisão</DialogTitle>
            <DialogDescription>
              Registre o motivo para devolver a tarefa ao colaborador com contexto claro.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label>Motivo</Label>
            <Textarea
              value={reviewComment}
              onChange={(event) => setReviewComment(event.target.value)}
              placeholder="Descreva o ajuste necessário"
              className="min-h-28"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectReviewTarget(null)}>
              Cancelar
            </Button>
            <Button onClick={() => void handleRejectReview()}>
              Reprovar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(commentTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setCommentTarget(null);
            setCommentBody("");
          }
        }}
      >
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Comentário operacional</DialogTitle>
            <DialogDescription>
              {commentTarget?.title ?? "Registre contexto para a execução."}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[260px] space-y-2 overflow-y-auto pr-1">
            {commentTarget &&
              commentsFor(commentTarget.targetType, commentTarget.targetId).map((comment) => (
                <div key={comment.id} className="rounded-xl border border-border p-3">
                  <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span>{authorName(comment.authorId)}</span>
                    <span>{new Date(comment.createdAt).toLocaleString("pt-BR")}</span>
                  </div>
                  <p className="mt-2 text-sm">{comment.body}</p>
                </div>
              ))}
            {commentTarget && commentsFor(commentTarget.targetType, commentTarget.targetId).length === 0 && (
              <div className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
                Nenhum comentário registrado neste contexto.
              </div>
            )}
          </div>
          <div className="grid gap-2 py-2">
            <Label>Novo comentário</Label>
            <Textarea
              value={commentBody}
              onChange={(event) => setCommentBody(event.target.value)}
              placeholder="Descreva a orientação, impedimento ou combinado operacional"
              className="min-h-28"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCommentTarget(null)}>
              Fechar
            </Button>
            <Button onClick={() => void handleCreateComment()}>
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default WorkQueue;
