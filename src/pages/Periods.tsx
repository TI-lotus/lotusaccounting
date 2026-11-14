import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
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
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarClock, CheckCircle2, CircleDashed, Clock, FileWarning, LockKeyhole, MessageSquare, Play, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspaceMembers } from "@/hooks/useWorkspaceMembers";
import { useWorkspacePermission } from "@/hooks/useWorkspacePermission";
import {
  ClientPeriodChecklistItemData,
  ClientPeriodChecklistStatus,
  ClientPeriodData,
  ClientPeriodStatus,
  ClientPeriodStepData,
  ClientPeriodStepStatus,
  ClientData,
  DocumentRequestData,
  OperationalCommentData,
  TaskReviewData,
} from "@/types";
import { cn } from "@/lib/utils";
import { FilterPopover } from "@/components/FilterPopover";
import { BentoStatStrip } from "@/components/dashboard/BentoStatStrip";

const monthNames = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const periodStatusLabels: Record<ClientPeriodStatus, string> = {
  not_started: "Não iniciada",
  waiting_documents: "Aguardando documentos",
  in_progress: "Em execução",
  in_review: "Em revisão",
  delivered: "Entregue",
  closed: "Fechada",
  blocked: "Bloqueada",
};

const periodStatusStyles: Record<ClientPeriodStatus, string> = {
  not_started: "bg-muted text-muted-foreground",
  waiting_documents: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  in_review: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  delivered: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  closed: "bg-gilver text-[hsl(0,0%,9%)]",
  blocked: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

const statusOptions: ClientPeriodStatus[] = [
  "waiting_documents",
  "in_progress",
  "in_review",
  "delivered",
  "closed",
  "blocked",
];

const stepStatusLabels: Record<ClientPeriodStepStatus, string> = {
  pending: "Pendente",
  in_progress: "Em andamento",
  completed: "Concluída",
  blocked: "Bloqueada",
  waived: "Dispensada",
};

const stepStatusStyles: Record<ClientPeriodStepStatus, string> = {
  pending: "border-muted-foreground/30 text-muted-foreground",
  in_progress: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  blocked: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
  waived: "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300",
};

const stepStatusOptions: ClientPeriodStepStatus[] = [
  "pending",
  "in_progress",
  "completed",
  "blocked",
  "waived",
];

const checklistStatusLabels: Record<ClientPeriodChecklistStatus, string> = {
  pending: "Pendente",
  in_progress: "Em andamento",
  in_review: "Em revisão",
  completed: "Concluído",
  blocked: "Bloqueado",
  waived: "Dispensado",
};

const checklistStatusStyles: Record<ClientPeriodChecklistStatus, string> = {
  pending: "bg-muted text-muted-foreground",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  in_review: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  blocked: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  waived: "bg-slate-100 text-slate-700 dark:bg-slate-950 dark:text-slate-300",
};

const checklistStatusOptions: ClientPeriodChecklistStatus[] = [
  "pending",
  "in_progress",
  "in_review",
  "completed",
  "blocked",
  "waived",
];

const serviceAreaLabels: Record<string, string> = {
  fiscal: "Fiscal",
  contabil: "Contábil",
  folha: "Folha",
  financeiro_bpo: "Financeiro/BPO",
  societario: "Societário",
};

const documentRequestStatusLabels: Record<string, string> = {
  requested: "Solicitado",
  uploaded: "Enviado",
  approved: "Aprovado",
  rejected: "Recusado",
  waived: "Dispensado",
};

const documentRequestStatusStyles: Record<string, string> = {
  requested: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  uploaded: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  waived: "bg-slate-100 text-slate-700 dark:bg-slate-950 dark:text-slate-300",
};

const reviewStatusLabels: Record<string, string> = {
  pending_review: "Pendente",
  approved: "Aprovada",
  rejected: "Reprovada",
};

const reviewStatusStyles: Record<string, string> = {
  pending_review: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  rejected: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
};

const currentPeriod = () => {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
};

const samePeriod = (dateValue: string, month: number, year: number) => {
  const date = new Date(dateValue);
  return date.getMonth() + 1 === month && date.getFullYear() === year;
};

const todayIso = new Date().toISOString().slice(0, 10);

const isDocumentRequestOverdue = (request: DocumentRequestData) =>
  Boolean(
    request.dueDate &&
      request.dueDate < todayIso &&
      !["approved", "waived"].includes(request.status),
  );

const statusIcon = (status: ClientPeriodStatus) => {
  if (status === "closed") return CheckCircle2;
  if (status === "blocked") return ShieldAlert;
  if (status === "waiting_documents") return FileWarning;
  if (status === "in_review") return LockKeyhole;
  if (status === "in_progress" || status === "delivered") return Clock;
  return CircleDashed;
};

const Periods = () => {
  const [searchParams] = useSearchParams();
  const {
    tenantId,
    clients,
    clientPeriods,
    clientPeriodSteps,
    clientPeriodChecklistItems,
    documents,
    documentRequests,
    fiscalObligations,
    tasks,
    taskReviews,
    operationalComments,
    createClientPeriod,
    generateClientPeriodsForMonth,
    updateClientPeriodStatus,
    updateClientPeriodStep,
    updateClientPeriodChecklistItem,
    linkClientPeriodChecklistEvidence,
    updateClientPeriodChecklistPlanning,
    createDocumentRequest,
    updateDocumentRequest,
    updateFiscalObligation,
    createOperationalComment,
  } = useData();
  const { user, profile } = useAuth();
  const canCreateClients = useWorkspacePermission({ tenantId, userId: user?.id, accountType: profile?.account_type, resource: "clients", action: "create" });
  const canUpdateClients = useWorkspacePermission({ tenantId, userId: user?.id, accountType: profile?.account_type, resource: "clients", action: "update" });
  const canCreateTasks = useWorkspacePermission({ tenantId, userId: user?.id, accountType: profile?.account_type, resource: "tasks", action: "create" });
  const canUpdateTasks = useWorkspacePermission({ tenantId, userId: user?.id, accountType: profile?.account_type, resource: "tasks", action: "update" });
  const canCreateDocuments = useWorkspacePermission({ tenantId, userId: user?.id, accountType: profile?.account_type, resource: "documents", action: "create" });
  const canUpdateDocuments = useWorkspacePermission({ tenantId, userId: user?.id, accountType: profile?.account_type, resource: "documents", action: "update" });
  const canUpdateFinancial = useWorkspacePermission({ tenantId, userId: user?.id, accountType: profile?.account_type, resource: "financial", action: "update" });
  const canCreatePeriod = canCreateClients || canCreateTasks;
  const canUpdatePeriod = canUpdateClients || canUpdateTasks;
  const canComment = canUpdateClients || canUpdateTasks;
  const { members: workspaceMembers } = useWorkspaceMembers();
  const internalMembers = useMemo(
    () => workspaceMembers.filter((member) => member.accountType !== "client"),
    [workspaceMembers],
  );
  const initial = currentPeriod();
  const initialMonth = Number(searchParams.get("month"));
  const initialYear = Number(searchParams.get("year"));
  const [periodMonth, setPeriodMonth] = useState(
    initialMonth >= 1 && initialMonth <= 12 ? initialMonth : initial.month,
  );
  const [periodYear, setPeriodYear] = useState(
    initialYear >= 2000 && initialYear <= 2100 ? initialYear : initial.year,
  );
  const [statusFilter, setStatusFilter] = useState<ClientPeriodStatus | "all">("all");
  const [responsibleFilter, setResponsibleFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState(searchParams.get("client") ?? "all");
  const [requestTarget, setRequestTarget] = useState<{ period: ClientPeriodData; client: ClientData } | null>(null);
  const [newRequest, setNewRequest] = useState({
    title: "",
    description: "",
    documentType: "outros",
    dueDate: "",
  });
  const [requestActionTarget, setRequestActionTarget] = useState<{
    request: DocumentRequestData;
    action: "reject" | "waive";
  } | null>(null);
  const [requestActionReason, setRequestActionReason] = useState("");
  const [commentTarget, setCommentTarget] = useState<ClientPeriodChecklistItemData | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const [obligationCommentTarget, setObligationCommentTarget] = useState<{ id: string; name: string } | null>(null);
  const [obligationCommentBody, setObligationCommentBody] = useState("");

  const activeClients = useMemo(() => clients.filter((client) => client.status === "active"), [clients]);
  const periodByCompany = useMemo(() => {
    const map = new Map<string, ClientPeriodData>();
    clientPeriods
      .filter((period) => period.periodMonth === periodMonth && period.periodYear === periodYear)
      .forEach((period) => map.set(period.companyId, period));
    return map;
  }, [clientPeriods, periodMonth, periodYear]);

  const responsibles = useMemo(
    () => Array.from(new Set(activeClients.map((client) => client.responsibleUserName).filter(Boolean))),
    [activeClients],
  );
  const stepsByPeriod = useMemo(() => {
    const map = new Map<string, ClientPeriodStepData[]>();
    clientPeriodSteps.forEach((step) => {
      const current = map.get(step.clientPeriodId) ?? [];
      current.push(step);
      map.set(step.clientPeriodId, current.sort((a, b) => a.position - b.position));
    });
    return map;
  }, [clientPeriodSteps]);
  const checklistByPeriod = useMemo(() => {
    const map = new Map<string, ClientPeriodChecklistItemData[]>();
    clientPeriodChecklistItems.forEach((item) => {
      const current = map.get(item.clientPeriodId) ?? [];
      current.push(item);
      map.set(item.clientPeriodId, current.sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title)));
    });
    return map;
  }, [clientPeriodChecklistItems]);
  const documentRequestsByPeriod = useMemo(() => {
    const map = new Map<string, DocumentRequestData[]>();
    documentRequests.forEach((request) => {
      if (!request.clientPeriodId) return;
      const current = map.get(request.clientPeriodId) ?? [];
      current.push(request);
      map.set(request.clientPeriodId, current.sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? "")));
    });
    return map;
  }, [documentRequests]);
  const obligationsByPeriod = useMemo(() => {
    const map = new Map<string, typeof fiscalObligations>();
    fiscalObligations.forEach((obligation) => {
      if (!obligation.client_period_id) return;
      const current = map.get(obligation.client_period_id) ?? [];
      current.push(obligation);
      map.set(
        obligation.client_period_id,
        current.sort((a, b) => String(a.due_date).localeCompare(String(b.due_date))),
      );
    });
    return map;
  }, [fiscalObligations]);
  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const reviewsByTaskId = useMemo(() => {
    const map = new Map<string, TaskReviewData[]>();
    taskReviews.forEach((review) => {
      const current = map.get(review.taskId) ?? [];
      current.push(review);
      map.set(
        review.taskId,
        current.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      );
    });
    return map;
  }, [taskReviews]);
  const commentsByChecklistItemId = useMemo(() => {
    const map = new Map<string, OperationalCommentData[]>();
    operationalComments
      .filter((comment) => comment.targetType === "checklist_item")
      .forEach((comment) => {
        const current = map.get(comment.targetId) ?? [];
        current.push(comment);
        map.set(
          comment.targetId,
          current.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        );
      });
    return map;
  }, [operationalComments]);
  const commentsByObligationId = useMemo(() => {
    const map = new Map<string, OperationalCommentData[]>();
    operationalComments
      .filter((comment) => comment.targetType === "fiscal_obligation")
      .forEach((comment) => {
        const current = map.get(comment.targetId) ?? [];
        current.push(comment);
        map.set(
          comment.targetId,
          current.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        );
      });
    return map;
  }, [operationalComments]);

  const rows = useMemo(() => {
    return activeClients
      .map((client) => {
        const period = periodByCompany.get(client.id) ?? null;
        const steps = period ? stepsByPeriod.get(period.id) ?? [] : [];
        const checklistItems = period ? checklistByPeriod.get(period.id) ?? [] : [];
        const documentRequestsForPeriod = period ? documentRequestsByPeriod.get(period.id) ?? [] : [];
        const obligationsForPeriod = period ? obligationsByPeriod.get(period.id) ?? [] : [];
        const periodTasks = tasks.filter((task) =>
          task.clientId === client.id && task.dueDate && samePeriod(task.dueDate, periodMonth, periodYear),
        );
        const completedTasks = periodTasks.filter((task) => task.status === "completed").length;
        const taskProgress = periodTasks.length ? Math.round((completedTasks / periodTasks.length) * 100) : 0;
        const completedSteps = steps.filter((step) => step.status === "completed" || step.status === "waived").length;
        const completedChecklistItems = checklistItems.filter((item) => item.status === "completed" || item.status === "waived").length;
        const stepProgress = steps.length ? Math.round((completedSteps / steps.length) * 100) : 0;
        const checklistProgress = checklistItems.length ? Math.round((completedChecklistItems / checklistItems.length) * 100) : 0;
        const progress = period?.status === "closed" ? 100 : Math.max(period?.progressPercent ?? 0, checklistProgress, stepProgress, taskProgress);
        return { client, period, steps, checklistItems, documentRequestsForPeriod, obligationsForPeriod, periodTasks, completedTasks, completedSteps, completedChecklistItems, progress };
      })
      .filter((row) => statusFilter === "all" || (row.period?.status ?? "not_started") === statusFilter)
      .filter((row) => responsibleFilter === "all" || row.client.responsibleUserName === responsibleFilter)
      .filter((row) => clientFilter === "all" || row.client.id === clientFilter);
  }, [activeClients, checklistByPeriod, clientFilter, documentRequestsByPeriod, obligationsByPeriod, periodByCompany, periodMonth, periodYear, responsibleFilter, statusFilter, stepsByPeriod, tasks]);

  const stats = useMemo(() => {
    const created = rows.filter((row) => row.period).length;
    const closed = rows.filter((row) => row.period?.status === "closed").length;
    const blocked = rows.filter((row) => row.period?.status === "blocked").length;
    const waiting = rows.filter((row) => row.period?.status === "waiting_documents").length;
    return { created, closed, blocked, waiting, total: rows.length };
  }, [rows]);

  const handleGenerate = async () => {
    if (!canCreatePeriod) {
      toast.error("Seu perfil não tem permissão para gerar competências.");
      return;
    }
    const created = await generateClientPeriodsForMonth(periodMonth, periodYear);
    if (created) toast.success(`${created} competência(s) criada(s)`);
  };

  const handleStart = async (companyId: string) => {
    if (!canCreatePeriod) return;
    const period = await createClientPeriod(companyId, periodMonth, periodYear);
    if (period) toast.success("Competência iniciada");
  };

  const handleStatusChange = async (period: ClientPeriodData, status: ClientPeriodStatus) => {
    if (!canUpdatePeriod) return;
    const ok = await updateClientPeriodStatus(period.id, status, status === "blocked" ? "Bloqueada por pendência crítica" : null);
    if (ok) toast.success("Status da competência atualizado");
  };

  const handleStepChange = async (step: ClientPeriodStepData, status: ClientPeriodStepStatus) => {
    if (!canUpdatePeriod) return;
    const ok = await updateClientPeriodStep(step.id, status, status === "blocked" ? "Etapa bloqueada por pendência operacional" : null);
    if (ok) toast.success("Etapa atualizada");
  };

  const handleChecklistChange = async (item: ClientPeriodChecklistItemData, status: ClientPeriodChecklistStatus) => {
    if (!canUpdatePeriod) return;
    const ok = await updateClientPeriodChecklistItem(item.id, status, status === "blocked" ? "Item bloqueado por pendência operacional" : null);
    if (ok) toast.success("Checklist atualizado");
  };

  const evidenceOptionsFor = (client: ClientData, requests: DocumentRequestData[]) => {
    const options = new Map<string, string>();
    requests
      .filter((request) => request.documentId && ["uploaded", "approved"].includes(request.status))
      .forEach((request) => {
        options.set(request.documentId!, `${request.title} · ${documentRequestStatusLabels[request.status]}`);
      });
    documents
      .filter((document) =>
        document.clientId === client.id &&
        document.month === periodMonth &&
        document.year === periodYear,
      )
      .forEach((document) => {
        options.set(document.id, document.name);
      });
    return Array.from(options.entries()).map(([id, label]) => ({ id, label }));
  };

  const handleChecklistEvidenceChange = async (item: ClientPeriodChecklistItemData, value: string) => {
    if (!canUpdatePeriod) return;
    const documentId = value === "__none__" ? null : value;
    const ok = await linkClientPeriodChecklistEvidence(item.id, documentId);
    if (ok) toast.success(documentId ? "Evidência vinculada ao checklist" : "Evidência removida do checklist");
  };

  const handleChecklistPlanningChange = async (
    item: ClientPeriodChecklistItemData,
    updates: { assignedToId?: string | null; dueDate?: string | null },
  ) => {
    if (!canUpdatePeriod) return;
    const ok = await updateClientPeriodChecklistPlanning(item.id, updates);
    if (ok) toast.success("Planejamento do checklist atualizado");
  };

  const handleObligationEvidenceChange = async (obligationId: string, value: string) => {
    if (!canUpdateFinancial) return;
    const documentId = value === "__none__" ? null : value;
    const ok = await updateFiscalObligation(obligationId, { document_id: documentId });
    if (ok) toast.success(documentId ? "Evidência vinculada à obrigação" : "Evidência removida da obrigação");
  };

  const openDocumentRequestDialog = (period: ClientPeriodData, client: ClientData) => {
    setRequestTarget({ period, client });
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
      toast.error("Informe o título do documento solicitado");
      return;
    }
    const saved = await createDocumentRequest({
      companyId: requestTarget.client.id,
      clientPeriodId: requestTarget.period.id,
      assignedTo: null,
      title: newRequest.title.trim(),
      description: newRequest.description.trim() || null,
      documentType: newRequest.documentType,
      dueDate: newRequest.dueDate || null,
    });
    if (!saved) return;
    toast.success("Documento solicitado");
    setRequestTarget(null);
  };

  const openRequestActionDialog = (request: DocumentRequestData, action: "reject" | "waive") => {
    setRequestActionTarget({ request, action });
    setRequestActionReason(
      action === "reject"
        ? request.rejectionReason || "Arquivo precisa ser reenviado"
        : request.waivedReason || "Dispensado pelo escritório",
    );
  };

  const handleDocumentRequestAction = async () => {
    if (!requestActionTarget || !canUpdateDocuments) return;
    const reason = requestActionReason.trim();
    if (!reason) {
      toast.error("Informe o motivo para registrar a decisão");
      return;
    }
    const ok = requestActionTarget.action === "reject"
      ? await updateDocumentRequest(requestActionTarget.request.id, {
          status: "rejected",
          rejectionReason: reason,
        })
      : await updateDocumentRequest(requestActionTarget.request.id, {
          status: "waived",
          waivedReason: reason,
        });
    if (!ok) return;
    toast.success(requestActionTarget.action === "reject" ? "Documento recusado" : "Solicitação dispensada");
    setRequestActionTarget(null);
    setRequestActionReason("");
  };

  const authorName = (authorId: string | null) => {
    if (!authorId) return "Sistema";
    return internalMembers.find((member) => member.userId === authorId)?.fullName ?? "Equipe";
  };

  const openCommentDialog = (item: ClientPeriodChecklistItemData) => {
    setCommentTarget(item);
    setCommentBody("");
  };

  const handleCreateComment = async () => {
    if (!commentTarget || !canComment) return;
    const saved = await createOperationalComment(
      "checklist_item",
      commentTarget.id,
      commentBody,
    );
    if (!saved) return;
    toast.success("Comentário registrado");
    setCommentBody("");
  };

  const openObligationCommentDialog = (obligation: { id: string; name: string }) => {
    setObligationCommentTarget({ id: obligation.id, name: obligation.name });
    setObligationCommentBody("");
  };

  const handleCreateObligationComment = async () => {
    if (!obligationCommentTarget || !canComment) return;
    const saved = await createOperationalComment(
      "fiscal_obligation",
      obligationCommentTarget.id,
      obligationCommentBody,
    );
    if (!saved) return;
    toast.success("Comentário registrado");
    setObligationCommentBody("");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-[28px] font-normal tracking-[-0.035em]">Ciclo mensal</h1>
            <p className="text-muted-foreground">
              Acompanhe a competência contábil de cada cliente, do início ao fechamento.
            </p>
          </div>
          {canCreatePeriod && <Button className="rounded-xl gap-2" onClick={() => void handleGenerate()}>
            <CalendarClock className="h-4 w-4" />
            Gerar competências
          </Button>}
        </div>

        <BentoStatStrip
          className="animate-fade-in"
          items={[
            { label: "Criadas", value: stats.created, hint: `${stats.total} no total`, icon: CalendarClock, compact: true },
            { label: "Aguardando documentos", value: stats.waiting, icon: FileWarning, compact: true },
            { label: "Bloqueadas", value: stats.blocked, icon: ShieldAlert, compact: true },
            { label: "Fechadas", value: stats.closed, icon: CheckCircle2, compact: true },
          ]}
        />

        <Card>
          <CardHeader className="gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <CardTitle className="mr-auto text-base">Competências por cliente</CardTitle>
              <FilterPopover
                activeCount={[periodMonth !== initial.month, periodYear !== initial.year, statusFilter !== "all", responsibleFilter !== "all", clientFilter !== "all"].filter(Boolean).length}
                description="Escolha o período e refine por status, responsável ou cliente."
                onClear={() => {
                  setPeriodMonth(initial.month);
                  setPeriodYear(initial.year);
                  setStatusFilter("all");
                  setResponsibleFilter("all");
                  setClientFilter("all");
                }}
              >
                <div className="grid grid-cols-2 gap-3">
                  <Select value={String(periodMonth)} onValueChange={(value) => setPeriodMonth(Number(value))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {monthNames.map((label, index) => <SelectItem key={label} value={String(index + 1)}>{label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={String(periodYear)} onValueChange={(value) => setPeriodYear(Number(value))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 5 }, (_, index) => initial.year - 2 + index).map((year) => <SelectItem key={year} value={String(year)}>{year}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Select value={statusFilter} onValueChange={(value: ClientPeriodStatus | "all") => setStatusFilter(value)}>
                  <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    {["not_started", ...statusOptions].map((status) => (
                      <SelectItem key={status} value={status}>{periodStatusLabels[status as ClientPeriodStatus]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={responsibleFilter} onValueChange={setResponsibleFilter}>
                  <SelectTrigger><SelectValue placeholder="Responsável" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos responsáveis</SelectItem>
                    {responsibles.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={clientFilter} onValueChange={setClientFilter}>
                  <SelectTrigger><SelectValue placeholder="Cliente" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos clientes</SelectItem>
                    {activeClients.map((client) => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FilterPopover>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {rows.map(({ client, period, steps, checklistItems, documentRequestsForPeriod, obligationsForPeriod, periodTasks, completedTasks, completedSteps, completedChecklistItems, progress }) => {
                const status = period?.status ?? "not_started";
                const Icon = statusIcon(status);
                const evidenceOptions = evidenceOptionsFor(client, documentRequestsForPeriod);
                return (
                  <div key={client.id} className="rounded-2xl border border-border p-4">
                    <div className="grid gap-4 md:grid-cols-[minmax(220px,1.4fr)_minmax(160px,0.8fr)_minmax(180px,1fr)_minmax(220px,1.1fr)] md:items-center">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <p className="truncate font-medium">{client.name}</p>
                        </div>
                        <p className="mt-1 truncate text-xs text-muted-foreground">Responsável: {client.responsibleUserName || "Sem responsável"}</p>
                      </div>
                      <div>
                        <Badge className={cn("text-[10px]", periodStatusStyles[status])}>
                          {periodStatusLabels[status]}
                        </Badge>
                        {period?.blockedReason && <p className="mt-1 text-xs text-red-600">{period.blockedReason}</p>}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Progresso</span>
                          <span>{progress}%</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                        <p className="text-[11px] text-muted-foreground">
                          {checklistItems.length ? `${completedChecklistItems}/${checklistItems.length} itens do checklist` : steps.length ? `${completedSteps}/${steps.length} etapas` : `${completedTasks}/${periodTasks.length} tarefas da competência`}
                        </p>
                      </div>
                      <div className="flex flex-wrap justify-start gap-2 md:justify-end">
                        {!period ? (
                          <Button size="sm" className="rounded-xl gap-1.5" onClick={() => void handleStart(client.id)}>
                            <Play className="h-3.5 w-3.5" />Iniciar
                          </Button>
                        ) : (
                          <>
                            {canCreateDocuments && <Button variant="outline" size="sm" className="rounded-xl" onClick={() => openDocumentRequestDialog(period, client)}>
                              Solicitar documento
                            </Button>}
                            <Select disabled={!canUpdatePeriod} value={period.status} onValueChange={(value: ClientPeriodStatus) => void handleStatusChange(period, value)}>
                              <SelectTrigger className="h-9 w-[190px] rounded-xl"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {statusOptions.map((option) => (
                                  <SelectItem key={option} value={option}>{periodStatusLabels[option]}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </>
                        )}
                      </div>
                    </div>
                    {period && documentRequestsForPeriod.length > 0 && (
                      <div className="mt-4 border-t border-border pt-4">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium">Documentos solicitados</p>
                            <p className="text-xs text-muted-foreground">Pendências documentais vinculadas à competência.</p>
                          </div>
                          <Badge variant="outline" className="text-[10px]">
                            {documentRequestsForPeriod.filter((request) => request.status === "approved" || request.status === "waived").length}/{documentRequestsForPeriod.length} resolvidos
                          </Badge>
                        </div>
                        <div className="grid gap-2 lg:grid-cols-2">
                          {documentRequestsForPeriod.map((request) => (
                            <div key={request.id} className="rounded-xl border border-border p-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium">{request.title}</p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    Venc. {request.dueDate ? new Date(`${request.dueDate}T00:00:00`).toLocaleDateString("pt-BR") : "sem prazo"} · {request.documentType || "documento"}
                                  </p>
                                </div>
                                <Badge className={cn("shrink-0 text-[10px]", documentRequestStatusStyles[request.status])}>
                                  {documentRequestStatusLabels[request.status]}
                                </Badge>
                              </div>
                              {isDocumentRequestOverdue(request) && <Badge variant="destructive" className="mt-2 text-[10px]">Vencido</Badge>}
                              {request.status === "approved" && request.documentId && (
                                <Badge variant="outline" className="mt-2 text-[10px]">
                                  Evidência aprovada
                                </Badge>
                              )}
                              {request.rejectionReason && <p className="mt-2 text-xs text-red-600">{request.rejectionReason}</p>}
                              {request.waivedReason && <p className="mt-2 text-xs text-muted-foreground">{request.waivedReason}</p>}
                              {canUpdateDocuments && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <Button size="sm" variant="outline" className="h-8 rounded-lg" disabled={request.status !== "uploaded"} onClick={() => void updateDocumentRequest(request.id, { status: "approved" })}>
                                    Aprovar
                                  </Button>
                                  <Button size="sm" variant="outline" className="h-8 rounded-lg" disabled={request.status !== "uploaded"} onClick={() => openRequestActionDialog(request, "reject")}>
                                    Recusar
                                  </Button>
                                  <Button size="sm" variant="outline" className="h-8 rounded-lg" disabled={request.status === "approved"} onClick={() => openRequestActionDialog(request, "waive")}>
                                    Dispensar
                                  </Button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {period && obligationsForPeriod.length > 0 && (
                      <div className="mt-4 border-t border-border pt-4">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium">Obrigações da competência</p>
                            <p className="text-xs text-muted-foreground">
                              Geradas pelo regime tributário e conectadas à agenda e às tarefas.
                            </p>
                          </div>
                          <Badge variant="outline" className="text-[10px]">
                            {obligationsForPeriod.filter((obligation) => obligation.status === "completed").length}/{obligationsForPeriod.length} entregues
                          </Badge>
                        </div>
                        <div className="grid gap-2 lg:grid-cols-2">
                          {obligationsForPeriod.map((obligation) => {
                            const linkedTask = obligation.task_id ? taskById.get(obligation.task_id) : null;
                            const evidenceOk = !obligation.requires_evidence || Boolean(obligation.document_id);
                            const obligationComments = commentsByObligationId.get(obligation.id) ?? [];
                            return (
                              <div key={obligation.id} className="rounded-xl border border-border p-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-medium">{obligation.name}</p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      {serviceAreaLabels[obligation.service_area ?? "fiscal"] ?? "Fiscal"} · venc. {new Date(`${obligation.due_date}T00:00:00`).toLocaleDateString("pt-BR")}
                                    </p>
                                  </div>
                                  <Badge
                                    className={cn(
                                      "shrink-0 text-[10px]",
                                      obligation.status === "completed"
                                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                                        : obligation.status === "in_progress"
                                          ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                                          : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
                                    )}
                                  >
                                    {obligation.status === "completed" ? "Entregue" : obligation.status === "in_progress" ? "Em andamento" : "Pendente"}
                                  </Badge>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {linkedTask && (
                                    <Badge variant="outline" className="text-[10px]">
                                      Tarefa: {linkedTask.status === "completed" ? "concluída" : linkedTask.status === "in_progress" ? "em andamento" : "pendente"}
                                    </Badge>
                                  )}
                                  {obligation.generates_task && <Badge variant="secondary" className="text-[10px]">Gera tarefa</Badge>}
                                  {obligation.requires_evidence && (
                                    <Badge
                                      variant={evidenceOk ? "outline" : "secondary"}
                                      className={cn(
                                        "text-[10px]",
                                        evidenceOk
                                          ? "border-emerald-200 text-emerald-700 dark:border-emerald-900 dark:text-emerald-300"
                                          : "text-amber-700 dark:text-amber-300",
                                      )}
                                    >
                                      {evidenceOk ? "Evidência vinculada" : "Exige evidência"}
                                    </Badge>
                                  )}
                                </div>
                                <div className="mt-3 grid gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground sm:grid-cols-2">
                                  <span>Criada em {obligation.created_at ? new Date(obligation.created_at).toLocaleDateString("pt-BR") : "—"}</span>
                                  <span>Atualizada em {obligation.updated_at ? new Date(obligation.updated_at).toLocaleDateString("pt-BR") : "—"}</span>
                                  <span>{obligation.completed_at ? `Concluída em ${new Date(obligation.completed_at).toLocaleDateString("pt-BR")}` : "Ainda não concluída"}</span>
                                  <span>{obligation.document_id ? "Evidência vinculada" : "Sem evidência vinculada"}</span>
                                </div>
                                {obligationComments.length > 0 && (
                                  <div className="mt-3 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                                    <span className="font-medium text-foreground">
                                      Último comentário de {authorName(obligationComments[0].authorId)}:{" "}
                                    </span>
                                    {obligationComments[0].body}
                                  </div>
                                )}
                                {canComment && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="mt-3 h-8 rounded-lg gap-1.5"
                                    onClick={() => openObligationCommentDialog({ id: obligation.id, name: obligation.name })}
                                  >
                                    <MessageSquare className="h-3.5 w-3.5" />
                                    Comentar
                                  </Button>
                                )}
                                {obligation.requires_evidence && canUpdateFinancial && (
                                  <div className="mt-3 grid gap-1.5">
                                    <Label className="text-[11px] text-muted-foreground">Evidência da obrigação</Label>
                                    <Select
                                      value={obligation.document_id ?? "__none__"}
                                      disabled={evidenceOptions.length === 0}
                                      onValueChange={(value) => void handleObligationEvidenceChange(obligation.id, value)}
                                    >
                                      <SelectTrigger className="h-8 rounded-lg text-xs">
                                        <SelectValue placeholder="Selecionar evidência" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="__none__">Sem evidência vinculada</SelectItem>
                                        {evidenceOptions.map((document) => (
                                          <SelectItem key={document.id} value={document.id}>{document.label}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    {evidenceOptions.length === 0 && (
                                      <p className="text-[11px] text-muted-foreground">Aprove ou envie um documento da competência para vincular.</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {period && steps.length > 0 && (
                      <div className="mt-4 grid gap-2 border-t border-border pt-4 sm:grid-cols-2 xl:grid-cols-3">
                        {steps.map((step) => (
                          <div key={step.id} className={cn("min-w-0 rounded-xl border px-3 py-2", stepStatusStyles[step.status])}>
                            <div className="mb-2 flex items-start justify-between gap-2">
                              <p className="min-w-0 truncate text-xs font-medium">{step.title}</p>
                              <Badge variant="outline" className="shrink-0 text-[10px]">{stepStatusLabels[step.status]}</Badge>
                            </div>
                            <Select disabled={!canUpdatePeriod} value={step.status} onValueChange={(value: ClientPeriodStepStatus) => void handleStepChange(step, value)}>
                              <SelectTrigger className="h-8 rounded-lg bg-background/80 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {stepStatusOptions.map((option) => (
                                  <SelectItem key={option} value={option}>{stepStatusLabels[option]}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ))}
                      </div>
                    )}
                    {period && checklistItems.length > 0 && (
                      <div className="mt-4 border-t border-border pt-4">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium">Checklist operacional</p>
                            <p className="text-xs text-muted-foreground">
                              Gerado pelo regime tributário e vinculado às tarefas da competência.
                            </p>
                          </div>
                          <Badge variant="outline" className="text-[10px]">
                            {completedChecklistItems}/{checklistItems.length} concluídos
                          </Badge>
                        </div>
                        <div className="grid gap-2 lg:grid-cols-2">
                          {checklistItems.map((item) => {
                            const linkedTask = item.taskId ? taskById.get(item.taskId) : null;
                            const itemReviews = item.taskId ? reviewsByTaskId.get(item.taskId) ?? [] : [];
                            const latestRejectedReview = itemReviews.find((review) => review.status === "rejected");
                            const itemComments = commentsByChecklistItemId.get(item.id) ?? [];
                            const assignedMember = item.assignedToId
                              ? internalMembers.find((member) => member.userId === item.assignedToId)
                              : null;
                            const approvedEvidenceRequests = item.requiresDocument
                              ? documentRequestsForPeriod.filter((request) => request.status === "approved" && request.documentId)
                              : [];
                            return (
                              <div key={item.id} className="rounded-xl border border-border p-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-medium">{item.title}</p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      {serviceAreaLabels[item.serviceArea]} · venc. {item.dueDate ? new Date(`${item.dueDate}T00:00:00`).toLocaleDateString("pt-BR") : "sem prazo"}
                                    </p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      Resp. {assignedMember?.fullName ?? linkedTask?.assignedToName ?? "Sem responsável"}
                                    </p>
                                  </div>
                                  <Badge className={cn("shrink-0 text-[10px]", checklistStatusStyles[item.status])}>
                                    {checklistStatusLabels[item.status]}
                                  </Badge>
                                </div>
                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                  <Select disabled={!canUpdatePeriod} value={item.status} onValueChange={(value: ClientPeriodChecklistStatus) => void handleChecklistChange(item, value)}>
                                    <SelectTrigger className="h-8 w-[160px] rounded-lg text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      {checklistStatusOptions.map((option) => (
                                        <SelectItem key={option} value={option}>{checklistStatusLabels[option]}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  {linkedTask && (
                                    <Badge variant="outline" className="text-[10px]">
                                      Tarefa: {linkedTask.status === "completed" ? "concluída" : linkedTask.status === "in_progress" ? "em andamento" : "pendente"}
                                    </Badge>
                                  )}
                                  {item.requiresReview && <Badge variant="secondary" className="text-[10px]">Revisão</Badge>}
                                  {item.requiresDocument && <Badge variant="secondary" className="text-[10px]">Documento</Badge>}
                                </div>
                                {latestRejectedReview?.comment && (
                                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
                                    <span className="font-medium">Última reprovação: </span>
                                    {latestRejectedReview.comment}
                                  </div>
                                )}
                                {itemComments.length > 0 && (
                                  <div className="mt-3 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                                    <span className="font-medium text-foreground">
                                      Último comentário de {authorName(itemComments[0].authorId)}:{" "}
                                    </span>
                                    {itemComments[0].body}
                                  </div>
                                )}
                                {canUpdatePeriod && (
                                  <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px]">
                                    <div className="grid gap-1.5">
                                      <Label className="text-[11px] text-muted-foreground">Responsável do item</Label>
                                      <Select
                                        value={item.assignedToId ?? "__none__"}
                                        onValueChange={(value) => void handleChecklistPlanningChange(item, { assignedToId: value === "__none__" ? null : value })}
                                      >
                                        <SelectTrigger className="h-8 rounded-lg text-xs">
                                          <SelectValue placeholder="Selecionar responsável" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="__none__">Sem responsável</SelectItem>
                                          {internalMembers.map((member) => (
                                            <SelectItem key={member.userId} value={member.userId}>{member.fullName}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="grid gap-1.5">
                                      <Label className="text-[11px] text-muted-foreground">Prazo do item</Label>
                                      <Input
                                        type="date"
                                        value={item.dueDate ?? ""}
                                        className="h-8 rounded-lg text-xs"
                                        onChange={(event) => void handleChecklistPlanningChange(item, { dueDate: event.target.value || null })}
                                      />
                                    </div>
                                  </div>
                                )}
                                {canComment && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="mt-3 h-8 rounded-lg gap-1.5"
                                    onClick={() => openCommentDialog(item)}
                                  >
                                    <MessageSquare className="h-3.5 w-3.5" />
                                    Comentar
                                  </Button>
                                )}
                                {item.requiresDocument && (
                                  <div className="mt-3 space-y-2">
                                    <div className={cn(
                                      "rounded-lg border px-3 py-2 text-xs",
                                      item.evidenceDocumentId || approvedEvidenceRequests.length
                                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                                        : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
                                    )}>
                                      {item.evidenceDocumentId
                                        ? `Evidência vinculada: ${evidenceOptions.find((document) => document.id === item.evidenceDocumentId)?.label ?? "documento selecionado"}`
                                        : approvedEvidenceRequests.length
                                          ? `Há evidência aprovada disponível: ${approvedEvidenceRequests.slice(0, 2).map((request) => request.title).join(", ")}${approvedEvidenceRequests.length > 2 ? ` +${approvedEvidenceRequests.length - 2}` : ""}`
                                          : "Sem evidência aprovada na competência"}
                                    </div>
                                    {canUpdatePeriod && (
                                      <div className="grid gap-1.5">
                                        <Label className="text-[11px] text-muted-foreground">Evidência do checklist</Label>
                                        <Select
                                          value={item.evidenceDocumentId ?? "__none__"}
                                          disabled={evidenceOptions.length === 0}
                                          onValueChange={(value) => void handleChecklistEvidenceChange(item, value)}
                                        >
                                          <SelectTrigger className="h-8 rounded-lg text-xs">
                                            <SelectValue placeholder="Selecionar evidência" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="__none__">Sem evidência vinculada</SelectItem>
                                            {evidenceOptions.map((document) => (
                                              <SelectItem key={document.id} value={document.id}>{document.label}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                        {evidenceOptions.length === 0 && (
                                          <p className="text-[11px] text-muted-foreground">Aprove ou envie um documento da competência para vincular.</p>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {period && checklistItems.some((item) => item.taskId && (reviewsByTaskId.get(item.taskId)?.length ?? 0) > 0) && (
                      <div className="mt-4 border-t border-border pt-4">
                        <div className="mb-3">
                          <p className="text-sm font-medium">Histórico de revisões</p>
                          <p className="text-xs text-muted-foreground">
                            Registro técnico das revisões vinculadas às tarefas desta competência.
                          </p>
                        </div>
                        <div className="grid gap-2 lg:grid-cols-2">
                          {checklistItems
                            .flatMap((item) =>
                              (item.taskId ? reviewsByTaskId.get(item.taskId) ?? [] : []).map((review) => ({
                                item,
                                review,
                              })),
                            )
                            .slice(0, 6)
                            .map(({ item, review }) => (
                              <div key={review.id} className="rounded-xl border border-border p-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-medium">{item.title}</p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      Solicitada em {new Date(review.requestedAt).toLocaleDateString("pt-BR")}
                                      {review.reviewedAt ? ` · revisada em ${new Date(review.reviewedAt).toLocaleDateString("pt-BR")}` : ""}
                                    </p>
                                  </div>
                                  <Badge className={cn("shrink-0 text-[10px]", reviewStatusStyles[review.status])}>
                                    {reviewStatusLabels[review.status]}
                                  </Badge>
                                </div>
                                {review.comment && (
                                  <p className="mt-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                                    {review.comment}
                                  </p>
                                )}
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {rows.length === 0 && (
                <div className="py-12 text-center text-muted-foreground">
                  <CalendarClock className="mx-auto mb-3 h-10 w-10 opacity-50" />
                  <p>Nenhuma competência encontrada para os filtros selecionados.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      <Dialog open={Boolean(requestTarget)} onOpenChange={(open) => !open && setRequestTarget(null)}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Solicitar documento</DialogTitle>
            <DialogDescription>
              {requestTarget ? `Pedido para ${requestTarget.client.name}` : "Crie uma pendência documental para a competência."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Título</Label>
              <Input value={newRequest.title} onChange={(event) => setNewRequest((prev) => ({ ...prev, title: event.target.value }))} placeholder="Ex.: Extrato bancário de setembro" />
            </div>
            <div className="grid gap-2">
              <Label>Descrição</Label>
              <Input value={newRequest.description} onChange={(event) => setNewRequest((prev) => ({ ...prev, description: event.target.value }))} placeholder="Detalhe o arquivo esperado" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Tipo</Label>
                <Input value={newRequest.documentType} onChange={(event) => setNewRequest((prev) => ({ ...prev, documentType: event.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>Vencimento</Label>
                <Input type="date" value={newRequest.dueDate} onChange={(event) => setNewRequest((prev) => ({ ...prev, dueDate: event.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestTarget(null)}>Cancelar</Button>
            <Button onClick={() => void handleCreateDocumentRequest()}>Solicitar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(requestActionTarget)} onOpenChange={(open) => {
        if (!open) {
          setRequestActionTarget(null);
          setRequestActionReason("");
        }
      }}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>
              {requestActionTarget?.action === "reject" ? "Recusar documento" : "Dispensar solicitação"}
            </DialogTitle>
            <DialogDescription>
              Registre um motivo claro para manter o histórico da competência compreensível para o escritório e para o cliente.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label>Motivo</Label>
            <Textarea
              value={requestActionReason}
              onChange={(event) => setRequestActionReason(event.target.value)}
              placeholder="Descreva o motivo da decisão"
              className="min-h-28"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestActionTarget(null)}>Cancelar</Button>
            <Button onClick={() => void handleDocumentRequestAction()}>
              {requestActionTarget?.action === "reject" ? "Recusar" : "Dispensar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(commentTarget)} onOpenChange={(open) => {
        if (!open) {
          setCommentTarget(null);
          setCommentBody("");
        }
      }}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Comentário do checklist</DialogTitle>
            <DialogDescription>
              {commentTarget?.title ?? "Registre contexto para o item da competência."}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[260px] space-y-2 overflow-y-auto pr-1">
            {(commentTarget ? commentsByChecklistItemId.get(commentTarget.id) ?? [] : []).map((comment) => (
              <div key={comment.id} className="rounded-xl border border-border p-3">
                <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>{authorName(comment.authorId)}</span>
                  <span>{new Date(comment.createdAt).toLocaleString("pt-BR")}</span>
                </div>
                <p className="mt-2 text-sm">{comment.body}</p>
              </div>
            ))}
            {commentTarget && (commentsByChecklistItemId.get(commentTarget.id) ?? []).length === 0 && (
              <div className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
                Nenhum comentário registrado neste item.
              </div>
            )}
          </div>
          <div className="grid gap-2 py-2">
            <Label>Novo comentário</Label>
            <Textarea
              value={commentBody}
              onChange={(event) => setCommentBody(event.target.value)}
              placeholder="Descreva uma orientação, impedimento ou combinado operacional"
              className="min-h-28"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCommentTarget(null)}>Fechar</Button>
            <Button onClick={() => void handleCreateComment()}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(obligationCommentTarget)} onOpenChange={(open) => {
        if (!open) {
          setObligationCommentTarget(null);
          setObligationCommentBody("");
        }
      }}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Comentário da obrigação</DialogTitle>
            <DialogDescription>
              {obligationCommentTarget?.name ?? "Registre contexto para a obrigação da competência."}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[260px] space-y-2 overflow-y-auto pr-1">
            {(obligationCommentTarget ? commentsByObligationId.get(obligationCommentTarget.id) ?? [] : []).map((comment) => (
              <div key={comment.id} className="rounded-xl border border-border p-3">
                <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>{authorName(comment.authorId)}</span>
                  <span>{new Date(comment.createdAt).toLocaleString("pt-BR")}</span>
                </div>
                <p className="mt-2 text-sm">{comment.body}</p>
              </div>
            ))}
            {obligationCommentTarget && (commentsByObligationId.get(obligationCommentTarget.id) ?? []).length === 0 && (
              <div className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
                Nenhum comentário registrado nesta obrigação.
              </div>
            )}
          </div>
          <div className="grid gap-2 py-2">
            <Label>Novo comentário</Label>
            <Textarea
              value={obligationCommentBody}
              onChange={(event) => setObligationCommentBody(event.target.value)}
              placeholder="Descreva uma orientação, evidência pendente ou combinado operacional"
              className="min-h-28"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setObligationCommentTarget(null)}>Fechar</Button>
            <Button onClick={() => void handleCreateObligationComment()}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Periods;
