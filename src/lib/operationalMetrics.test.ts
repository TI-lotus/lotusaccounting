import { describe, expect, it } from "vitest";
import { computeOperationalMetrics } from "./operationalMetrics";
import type {
  ClientData,
  ClientPeriodData,
  ClientPeriodStepData,
  DocumentRequestData,
  TaskData,
  TaskReviewData,
} from "@/types";

const client = (overrides: Partial<ClientData>): ClientData => ({
  id: "client-1",
  name: "Cliente A",
  cnpj: "",
  taxRegime: "simples_nacional",
  serviceAreas: ["fiscal", "contabil"],
  responsibleUserId: "user-1",
  responsibleUserName: "Ana",
  serviceFee: 0,
  city: "",
  state: "",
  status: "active",
  email: "",
  phone: "",
  createdAt: "2026-09-01T00:00:00Z",
  ...overrides,
});

const period = (overrides: Partial<ClientPeriodData>): ClientPeriodData => ({
  id: "period-1",
  tenantId: "tenant-1",
  companyId: "client-1",
  periodMonth: 9,
  periodYear: 2026,
  status: "in_progress",
  progressPercent: 50,
  startedAt: "2026-09-01T00:00:00Z",
  deliveredAt: null,
  closedAt: null,
  blockedReason: null,
  responsibleUserId: "user-1",
  createdBy: "admin",
  createdAt: "2026-09-01T00:00:00Z",
  updatedAt: "2026-09-01T00:00:00Z",
  ...overrides,
});

const task = (overrides: Partial<TaskData>): TaskData => ({
  id: "task-1",
  title: "Apurar imposto",
  description: "",
  type: "monthly",
  status: "pending",
  priority: "high",
  dueDate: "2026-09-20",
  category: "Fiscal",
  clientId: "client-1",
  clientName: "Cliente A",
  assignedToId: "user-1",
  assignedToName: "Ana",
  createdAt: "2026-09-01T00:00:00Z",
  completedAt: null,
  ...overrides,
});

const documentRequest = (overrides: Partial<DocumentRequestData>): DocumentRequestData => ({
  id: "doc-request-1",
  tenantId: "tenant-1",
  companyId: "client-1",
  clientPeriodId: "period-1",
  requestedBy: "admin",
  assignedTo: null,
  title: "Extrato",
  description: null,
  documentType: "extrato",
  dueDate: "2026-09-18",
  status: "requested",
  documentId: null,
  rejectionReason: null,
  waivedReason: null,
  createdAt: "2026-09-01T00:00:00Z",
  updatedAt: "2026-09-01T00:00:00Z",
  ...overrides,
});

const review = (overrides: Partial<TaskReviewData>): TaskReviewData => ({
  id: "review-1",
  tenantId: "tenant-1",
  taskId: "task-1",
  reviewerId: null,
  status: "pending_review",
  requestedAt: "2026-09-21T00:00:00Z",
  reviewedAt: null,
  comment: null,
  createdAt: "2026-09-21T00:00:00Z",
  updatedAt: "2026-09-21T00:00:00Z",
  ...overrides,
});

describe("computeOperationalMetrics", () => {
  it("identifies client risk, pending client documents and overdue work by assignee", () => {
    const metrics = computeOperationalMetrics({
      now: new Date("2026-09-23T12:00:00-03:00"),
      clients: [client({}), client({ id: "client-2", name: "Cliente B" })],
      clientPeriods: [
        period({ status: "waiting_documents" }),
        period({ id: "period-2", companyId: "client-2", status: "closed", progressPercent: 100 }),
      ],
      clientPeriodSteps: [],
      tasks: [task({})],
      documentRequests: [documentRequest({})],
      taskReviews: [review({})],
      fiscalObligations: [
        {
          id: "obl-1",
          company_id: "client-1",
          client_period_id: "period-1",
          due_date: "2026-09-19",
          status: "pending",
        },
      ],
    });

    expect(metrics.clientsWithClientPending).toBe(1);
    expect(metrics.pendingDocuments).toBe(1);
    expect(metrics.pendingReviews).toBe(1);
    expect(metrics.overdueTasksByAssignee).toEqual([
      { assigneeId: "user-1", assigneeName: "Ana", count: 1 },
    ]);
    expect(metrics.riskClients[0].clientName).toBe("Cliente A");
    expect(metrics.riskClients[0].reasons).toContain("Aguardando documentos");
  });

  it("calculates status distribution, closure average and bottlenecks", () => {
    const step = (overrides: Partial<ClientPeriodStepData>): ClientPeriodStepData => ({
      id: "step-1",
      tenantId: "tenant-1",
      clientPeriodId: "period-1",
      companyId: "client-1",
      stepKey: "documents",
      title: "Documentos recebidos",
      description: null,
      status: "blocked",
      dueDate: "2026-09-10",
      completedAt: null,
      blockedReason: "Cliente atrasado",
      position: 1,
      createdAt: "2026-09-01T00:00:00Z",
      updatedAt: "2026-09-01T00:00:00Z",
      ...overrides,
    });
    const metrics = computeOperationalMetrics({
      now: new Date("2026-09-23T12:00:00-03:00"),
      clients: [client({})],
      clientPeriods: [
        period({ status: "blocked" }),
        period({
          id: "period-old",
          periodMonth: 8,
          status: "closed",
          startedAt: "2026-08-01T00:00:00Z",
          closedAt: "2026-08-11T00:00:00Z",
        }),
      ],
      clientPeriodSteps: [step({})],
      tasks: [],
      documentRequests: [],
      taskReviews: [],
      fiscalObligations: [],
    });

    expect(metrics.periodStatusCounts.blocked).toBe(1);
    expect(metrics.averageClosureDays).toBe(10);
    expect(metrics.bottlenecksByStep).toEqual([
      { stepKey: "documents", title: "Documentos", count: 1 },
    ]);
    expect(metrics.lateCompetencies).toBe(1);
  });
});
