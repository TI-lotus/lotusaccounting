import type { Database } from "@/integrations/supabase/types";
import type { ClientData } from "@/types";

type Payment = Database["public"]["Tables"]["payments"]["Row"];
export type DateRange = { start: string; end: string };

export const withinDateRange = (date: string | null | undefined, range?: DateRange) => {
  if (!date) return false;
  const day = date.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && (!range || (day >= range.start && day <= range.end));
};

export const completedPayments = (payments: Payment[], range?: DateRange) => payments.filter(
  (payment) => payment.status === "completed" && withinDateRange(payment.paid_at ?? payment.created_at, range),
);

export const monthlyCashflow = (payments: Payment[], range?: DateRange) => {
  const groups = new Map<string, { month: string; revenue: number; expenses: number }>();
  for (const payment of completedPayments(payments, range)) {
    const key = (payment.paid_at ?? payment.created_at)!.slice(0, 7);
    const group = groups.get(key) ?? { month: key, revenue: 0, expenses: 0 };
    const amount = Number(payment.amount);
    if (!Number.isFinite(amount)) continue;
    if (["income", "entrada"].includes(payment.direction ?? "")) group.revenue += amount;
    else if (["expense", "saida"].includes(payment.direction ?? "")) group.expenses += amount;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => a.month.localeCompare(b.month));
};

export const expenseDistribution = (payments: Payment[], range?: DateRange) => {
  const groups = new Map<string, number>();
  for (const payment of completedPayments(payments, range)) {
    if (!["expense", "saida"].includes(payment.direction ?? "")) continue;
    const amount = Number(payment.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const category = payment.category?.trim() || "Sem categoria";
    groups.set(category, (groups.get(category) ?? 0) + amount);
  }
  return [...groups].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
};

// Contracted fees are a forecast, never a replacement for settled cash income.
export const contractedMonthlyFees = (clients: ClientData[]) => clients
  .filter((client) => client.status === "active")
  .reduce((sum, client) => sum + Math.max(0, Number(client.serviceFee) || 0), 0);
