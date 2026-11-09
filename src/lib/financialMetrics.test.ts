import { describe, expect, it } from "vitest";
import { monthlyCashflow, expenseDistribution, withinDateRange } from "./financialMetrics";
import type { Database } from "@/integrations/supabase/types";

type Payment = Database["public"]["Tables"]["payments"]["Row"];
const payment = (updates: Partial<Payment>): Payment => ({
  id: "p", amount: 100, direction: "income", status: "completed", paid_at: "2026-09-17T10:00:00Z",
  created_at: "2026-08-20T10:00:00Z", category: null, description: null, company_id: null,
  tenant_id: null, invoice_id: null, due_date: null, method: null, reconciled_at: null,
  reconciled_by: null, ...updates,
});

describe("financial reports use settled cash movements", () => {
  it("excludes pending/cancelled movements and uses settlement month", () => {
    expect(monthlyCashflow([payment({}), payment({ status: "pending", amount: 900 }), payment({ status: "cancelled" }), payment({ direction: "saida", amount: 40 })])).toEqual([
      { month: "2026-09", revenue: 100, expenses: 40 },
    ]);
  });
  it("filters every aggregation by inclusive period", () => {
    const range = { start: "2026-09-01", end: "2026-09-30" };
    expect(monthlyCashflow([payment({ paid_at: "2026-08-31" }), payment({ paid_at: "2026-09-30" })], range)[0].revenue).toBe(100);
    expect(withinDateRange(null, range)).toBe(false);
  });
  it("groups only completed expenses without fabricated categories or totals", () => {
    expect(expenseDistribution([payment({}), payment({ direction: "expense", amount: 40 }), payment({ direction: "saida", amount: 20 }), payment({ direction: "expense", status: "pending" })])).toEqual([{ name: "Sem categoria", value: 60 }]);
    expect(expenseDistribution([])).toEqual([]);
    expect(monthlyCashflow([])).toEqual([]);
  });
});
