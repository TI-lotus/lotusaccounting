import { describe, expect, it, vi } from "vitest";
import { computeTaskStatuses } from "./taskUtils";
import type { TaskData } from "@/types";

const task = (overrides: Partial<TaskData>): TaskData => ({
  id: "task-1",
  title: "Fechamento mensal",
  description: "",
  type: "monthly",
  status: "pending",
  priority: "medium",
  dueDate: "2026-09-23",
  category: "Fiscal",
  clientId: null,
  clientName: null,
  assignedToId: "",
  assignedToName: "Sem responsável",
  createdAt: "2026-09-20T10:00:00Z",
  completedAt: null,
  ...overrides,
});

describe("computeTaskStatuses", () => {
  it("does not mark tasks due today as overdue", () => {
    vi.setSystemTime(new Date("2026-09-23T18:00:00-03:00"));

    expect(computeTaskStatuses([task({ dueDate: "2026-09-23" })])[0].status).toBe("pending");

    vi.useRealTimers();
  });

  it("marks open tasks as overdue only after the due date", () => {
    vi.setSystemTime(new Date("2026-09-23T09:00:00-03:00"));

    expect(computeTaskStatuses([task({ dueDate: "2026-09-22" })])[0].status).toBe("overdue");

    vi.useRealTimers();
  });

  it("keeps completed tasks completed even when their due date has passed", () => {
    vi.setSystemTime(new Date("2026-09-23T09:00:00-03:00"));

    expect(computeTaskStatuses([task({ dueDate: "2026-09-01", status: "completed" })])[0].status).toBe("completed");

    vi.useRealTimers();
  });
});
