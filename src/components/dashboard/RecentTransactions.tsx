import { ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const transactions = [
  {
    id: 1,
    name: "Stripe Payment",
    description: "Invoice #1234 - Acme Corp",
    amount: 12500,
    type: "income",
    date: "Today, 2:30 PM",
  },
  {
    id: 2,
    name: "Office Supplies",
    description: "Monthly subscription",
    amount: -450,
    type: "expense",
    date: "Today, 11:15 AM",
  },
  {
    id: 3,
    name: "Client Payment",
    description: "Invoice #1231 - TechStart Inc",
    amount: 8750,
    type: "income",
    date: "Yesterday, 4:45 PM",
  },
  {
    id: 4,
    name: "Software License",
    description: "Annual renewal - Adobe CC",
    amount: -899,
    type: "expense",
    date: "Yesterday, 10:00 AM",
  },
  {
    id: 5,
    name: "Consulting Fee",
    description: "Invoice #1228 - Global Finance",
    amount: 15000,
    type: "income",
    date: "Jan 10, 3:20 PM",
  },
];

interface RecentTransactionsProps {
  className?: string;
}

export const RecentTransactions = ({ className }: RecentTransactionsProps) => {
  return (
    <div className={cn("glass rounded-2xl p-6 animate-fade-in", className)}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold">Recent Transactions</h3>
          <p className="text-sm text-muted-foreground">Latest financial activity</p>
        </div>
        <button className="text-sm text-primary font-medium hover:underline">
          View all
        </button>
      </div>
      <div className="space-y-4">
        {transactions.map((transaction, index) => (
          <div
            key={transaction.id}
            className="flex items-center gap-4 p-3 rounded-xl hover:bg-accent/50 transition-colors"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <Avatar className="h-10 w-10">
              <AvatarFallback
                className={cn(
                  transaction.type === "income"
                    ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"
                    : "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400"
                )}
              >
                {transaction.type === "income" ? (
                  <ArrowDownLeft className="h-4 w-4" />
                ) : (
                  <ArrowUpRight className="h-4 w-4" />
                )}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{transaction.name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {transaction.description}
              </p>
            </div>
            <div className="text-right">
              <p
                className={cn(
                  "font-semibold text-sm",
                  transaction.type === "income"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-foreground"
                )}
              >
                {transaction.type === "income" ? "+" : ""}$
                {Math.abs(transaction.amount).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">{transaction.date}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
