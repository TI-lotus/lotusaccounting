import { DashboardLayout } from "@/layouts/DashboardLayout";
import { CreditCard, Plus, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const payments = [
  { id: 1, description: "Invoice #1234 - Acme Corp", amount: 12500, type: "income", status: "completed", date: "Jan 12, 2026" },
  { id: 2, description: "Software License - Adobe", amount: -899, type: "expense", status: "completed", date: "Jan 11, 2026" },
  { id: 3, description: "Invoice #1231 - TechStart", amount: 8750, type: "income", status: "pending", date: "Jan 10, 2026" },
  { id: 4, description: "Office Supplies", amount: -450, type: "expense", status: "completed", date: "Jan 10, 2026" },
  { id: 5, description: "Invoice #1228 - Global Finance", amount: 15000, type: "income", status: "completed", date: "Jan 9, 2026" },
];

const Payments = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between animate-fade-in">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
            <p className="text-muted-foreground">Track incoming and outgoing payments</p>
          </div>
          <Button className="rounded-xl gap-2">
            <Plus className="h-4 w-4" />
            Record Payment
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="kpi-card animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950">
                <ArrowDownLeft className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Income</p>
                <p className="text-xl font-semibold text-emerald-600 dark:text-emerald-400">$36,250</p>
              </div>
            </div>
          </div>
          <div className="kpi-card animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-red-100 dark:bg-red-950">
                <ArrowUpRight className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Expenses</p>
                <p className="text-xl font-semibold">$1,349</p>
              </div>
            </div>
          </div>
          <div className="kpi-card animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10">
                <CreditCard className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Net Flow</p>
                <p className="text-xl font-semibold text-primary">+$34,901</p>
              </div>
            </div>
          </div>
        </div>

        <div className="glass rounded-2xl p-6 animate-fade-in">
          <h3 className="text-lg font-semibold mb-4">Recent Payments</h3>
          <div className="space-y-3">
            {payments.map((payment, index) => (
              <div
                key={payment.id}
                className="flex items-center gap-4 p-4 rounded-xl hover:bg-accent/50 transition-colors"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className={cn(
                  "p-2 rounded-xl",
                  payment.type === 'income' 
                    ? "bg-emerald-100 dark:bg-emerald-950" 
                    : "bg-red-100 dark:bg-red-950"
                )}>
                  {payment.type === 'income' ? (
                    <ArrowDownLeft className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <ArrowUpRight className="h-4 w-4 text-red-600 dark:text-red-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{payment.description}</p>
                  <p className="text-sm text-muted-foreground">{payment.date}</p>
                </div>
                <Badge variant={payment.status === 'completed' ? 'default' : 'secondary'}>
                  {payment.status}
                </Badge>
                <p className={cn(
                  "font-semibold",
                  payment.type === 'income' 
                    ? "text-emerald-600 dark:text-emerald-400" 
                    : "text-foreground"
                )}>
                  {payment.type === 'income' ? '+' : ''}${Math.abs(payment.amount).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Payments;
