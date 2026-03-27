import { TaskData, TaskStatus } from "@/types";

/**
 * Check and update overdue status for tasks based on due date.
 * A task becomes overdue when its due date has passed and it's not completed.
 */
export function computeTaskStatuses(tasks: TaskData[]): TaskData[] {
  const now = new Date();
  return tasks.map(task => {
    if (task.status === "completed") return task;
    const dueDate = new Date(task.dueDate);
    if (dueDate < now && task.status !== "overdue") {
      return { ...task, status: "overdue" as TaskStatus };
    }
    return task;
  });
}

/**
 * Sort tasks: overdue first, then by priority (high > medium > low), then by due date ascending.
 */
export function sortTasks(tasks: TaskData[]): TaskData[] {
  const statusOrder: Record<TaskStatus, number> = {
    overdue: 0,
    pending: 1,
    in_progress: 2,
    completed: 3,
  };
  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };

  return [...tasks].sort((a, b) => {
    // Overdue/high-priority first
    const statusDiff = statusOrder[a.status] - statusOrder[b.status];
    if (statusDiff !== 0) return statusDiff;
    
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;

    // Earlier due date first
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });
}

/**
 * Filter tasks by multiple dimensions.
 */
export function filterTasks(
  tasks: TaskData[],
  filters: {
    status?: TaskStatus | "all";
    assignedToId?: string | "all";
    clientId?: string | "all";
    type?: string | "all";
  }
): TaskData[] {
  return tasks.filter(task => {
    if (filters.status && filters.status !== "all" && task.status !== filters.status) return false;
    if (filters.assignedToId && filters.assignedToId !== "all" && task.assignedToId !== filters.assignedToId) return false;
    if (filters.clientId && filters.clientId !== "all" && task.clientId !== filters.clientId) return false;
    if (filters.type && filters.type !== "all" && task.type !== filters.type) return false;
    return true;
  });
}
