import type {
  ClientData,
  ClientPeriodData,
  ClientPeriodStatus,
  ClientPeriodStepData,
  DocumentRequestData,
  TaskData,
  TaskReviewData,
} from "@/types";

type FiscalObligationLike = {
  id: string;
  company_id: string | null;
  client_period_id?: string | null;
  due_date: string;
  status: string;
};

export type OperationalMetricsInput = {
  clients: ClientData[];
  clientPeriods: ClientPeriodData[];
  clientPeriodSteps: ClientPeriodStepData[];
  tasks: TaskData[];
  documentRequests: DocumentRequestData[];
  taskReviews: TaskReviewData[];
  fiscalObligations: FiscalObligationLike[];
  now?: Date;
};

export type OperationalMetrics = {
  periodMonth: number;
  periodYear: number;
  activeClients: number;
  clientsOnTrack: number;
  clientsWithClientPending: number;
  clientsWithoutPeriod: number;
  lateCompetencies: number;
  periodStatusCounts: Record<ClientPeriodStatus, number>;
  overdueTasksByAssignee: Array<{ assigneeId: string; assigneeName: string; count: number }>;
  pendingReviews: number;
  pendingDocuments: number;
  averageClosureDays: number | null;
  bottlenecksByStep: Array<{ stepKey: string; title: string; count: number }>;
  riskClients: Array<{ clientId: string; clientName: string; reasons: string[]; score: number }>;
};

const periodStatuses: ClientPeriodStatus[] = [
  "not_started",
  "waiting_documents",
  "in_progress",
  "in_review",
  "delivered",
  "closed",
  "blocked",
];

const stepLabels: Record<string, string> = {
  documents: "Documentos",
  classification: "Classificacao",
  fiscal: "Fiscal",
  accounting: "Contabil",
  review: "Revisao",
  delivery: "Entrega",
};

const parseDate = (value?: string | null) => {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const isOverdue = (value: string | null | undefined, now: Date) => {
  const date = parseDate(value);
  return Boolean(date && startOfDay(date) < startOfDay(now));
};

const daysBetween = (start?: string | null, end?: string | null) => {
  const startDate = parseDate(start);
  const endDate = parseDate(end);
  if (!startDate || !endDate) return null;
  return Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000));
};

export function computeOperationalMetrics(input: OperationalMetricsInput): OperationalMetrics {
  const now = input.now ?? new Date();
  const periodMonth = now.getMonth() + 1;
  const periodYear = now.getFullYear();
  const activeClients = input.clients.filter((client) => client.status === "active");
  const currentPeriods = input.clientPeriods.filter(
    (period) => period.periodMonth === periodMonth && period.periodYear === periodYear,
  );
  const periodByCompany = new Map(currentPeriods.map((period) => [period.companyId, period]));

  const periodStatusCounts = Object.fromEntries(
    periodStatuses.map((status) => [status, 0]),
  ) as Record<ClientPeriodStatus, number>;
  currentPeriods.forEach((period) => {
    periodStatusCounts[period.status] += 1;
  });

  const openDocumentRequests = input.documentRequests.filter(
    (request) => !["approved", "waived"].includes(request.status),
  );
  const pendingDocuments = openDocumentRequests.length;
  const pendingReviews = input.taskReviews.filter(
    (review) => review.status === "pending_review",
  ).length;

  const overdueTasks = input.tasks.filter(
    (task) => task.status !== "completed" && (task.status === "overdue" || isOverdue(task.dueDate, now)),
  );
  const overdueObligations = input.fiscalObligations.filter(
    (obligation) => obligation.status !== "completed" && isOverdue(obligation.due_date, now),
  );

  const overdueTasksByAssigneeMap = new Map<string, { assigneeId: string; assigneeName: string; count: number }>();
  overdueTasks.forEach((task) => {
    const key = task.assignedToId || "unassigned";
    const current =
      overdueTasksByAssigneeMap.get(key) ??
      { assigneeId: key, assigneeName: task.assignedToName || "Sem responsavel", count: 0 };
    current.count += 1;
    overdueTasksByAssigneeMap.set(key, current);
  });

  const bottleneckMap = new Map<string, { stepKey: string; title: string; count: number }>();
  input.clientPeriodSteps
    .filter((step) => currentPeriods.some((period) => period.id === step.clientPeriodId))
    .filter((step) => !["completed", "waived"].includes(step.status))
    .forEach((step) => {
      const current =
        bottleneckMap.get(step.stepKey) ??
        { stepKey: step.stepKey, title: stepLabels[step.stepKey] ?? step.title, count: 0 };
      current.count += 1;
      bottleneckMap.set(step.stepKey, current);
    });

  const closedDurations = input.clientPeriods
    .filter((period) => period.status === "closed" && period.startedAt && period.closedAt)
    .map((period) => daysBetween(period.startedAt, period.closedAt))
    .filter((value): value is number => value !== null);
  const averageClosureDays = closedDurations.length
    ? Math.round((closedDurations.reduce((sum, value) => sum + value, 0) / closedDurations.length) * 10) / 10
    : null;

  const riskClients = activeClients
    .map((client) => {
      const period = periodByCompany.get(client.id) ?? null;
      const clientOpenDocs = openDocumentRequests.filter((request) => request.companyId === client.id);
      const clientOverdueTasks = overdueTasks.filter((task) => task.clientId === client.id);
      const clientOverdueObligations = overdueObligations.filter((obligation) => obligation.company_id === client.id);
      const reasons: string[] = [];
      let score = 0;

      if (!period) {
        reasons.push("Sem competencia do mes");
        score += 40;
      } else {
        if (period.status === "blocked") {
          reasons.push("Competencia bloqueada");
          score += 60;
        }
        if (period.status === "waiting_documents") {
          reasons.push("Aguardando documentos");
          score += 30;
        }
        if (period.status === "in_review") {
          reasons.push("Em revisao");
          score += 20;
        }
      }
      if (clientOpenDocs.length) {
        reasons.push(`${clientOpenDocs.length} documento(s) pendente(s)`);
        score += clientOpenDocs.length * 10;
      }
      if (clientOverdueTasks.length) {
        reasons.push(`${clientOverdueTasks.length} tarefa(s) atrasada(s)`);
        score += clientOverdueTasks.length * 15;
      }
      if (clientOverdueObligations.length) {
        reasons.push(`${clientOverdueObligations.length} obrigacao(oes) vencida(s)`);
        score += clientOverdueObligations.length * 20;
      }

      return { clientId: client.id, clientName: client.name, reasons, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.clientName.localeCompare(b.clientName))
    .slice(0, 5);

  const clientsWithClientPending = activeClients.filter((client) =>
    openDocumentRequests.some((request) => request.companyId === client.id),
  ).length;
  const clientsWithoutPeriod = activeClients.filter((client) => !periodByCompany.has(client.id)).length;
  const lateCompetencies = currentPeriods.filter(
    (period) =>
      !["closed", "delivered"].includes(period.status) &&
      (
        period.status === "blocked" ||
        overdueTasks.some((task) => task.clientId === period.companyId) ||
        overdueObligations.some((obligation) => obligation.company_id === period.companyId)
      ),
  ).length;
  const riskyClientIds = new Set(riskClients.map((client) => client.clientId));
  const clientsOnTrack = activeClients.filter((client) => {
    const period = periodByCompany.get(client.id);
    return Boolean(period && !riskyClientIds.has(client.id) && !["blocked", "waiting_documents"].includes(period.status));
  }).length;

  return {
    periodMonth,
    periodYear,
    activeClients: activeClients.length,
    clientsOnTrack,
    clientsWithClientPending,
    clientsWithoutPeriod,
    lateCompetencies,
    periodStatusCounts,
    overdueTasksByAssignee: Array.from(overdueTasksByAssigneeMap.values()).sort((a, b) => b.count - a.count),
    pendingReviews,
    pendingDocuments,
    averageClosureDays,
    bottlenecksByStep: Array.from(bottleneckMap.values()).sort((a, b) => b.count - a.count).slice(0, 6),
    riskClients,
  };
}
