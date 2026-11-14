import { useMemo } from "react";
import { ArrowDownLeft, ArrowRight, ArrowUpRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useData } from "@/contexts/DataContext";
import { cn } from "@/lib/utils";

interface RecentTransactionsProps {
  className?: string;
}

export const RecentTransactions = ({ className }: RecentTransactionsProps) => {
  const navigate = useNavigate();
  const { payments, clients } = useData();
  const transactions = useMemo(
    () =>
      [...payments]
        .sort((first, second) => {
          const firstDate = first.paid_at ?? first.created_at ?? first.due_date ?? "";
          const secondDate = second.paid_at ?? second.created_at ?? second.due_date ?? "";
          return secondDate.localeCompare(firstDate);
        })
        .slice(0, 5)
        .map((payment) => {
          const type = payment.direction === "expense" ? "expense" : "income";
          const dateValue = payment.paid_at ?? payment.created_at ?? payment.due_date;
          const clientName = clients.find((client) => client.id === payment.company_id)?.name;
          return {
            id: payment.id,
            name: type === "income" ? "Recebimento" : "Despesa",
            description: [payment.description || "Lançamento financeiro", clientName]
              .filter(Boolean)
              .join(" · "),
            amount: Number(payment.amount ?? 0),
            type,
            date: dateValue
              ? new Date(dateValue).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "short",
                })
              : "Sem data",
          };
        }),
    [clients, payments],
  );

  return (
    <div className={cn("glass rounded-2xl p-6 animate-fade-in", className)}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Transações recentes</h3>
          <p className="text-sm text-muted-foreground">Últimas movimentações financeiras</p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          onClick={() => navigate("/payments")}
        >
          Ver tudo <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
      {transactions.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Ainda não há movimentações financeiras registradas.
        </p>
      ) : (
        <div className="space-y-4">
          {transactions.map((transaction, index) => (
            <div
              key={transaction.id}
              className="flex items-center gap-4 rounded-xl p-3 transition-colors hover:bg-accent/50"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <Avatar className="h-10 w-10">
                <AvatarFallback
                  className={cn(
                    transaction.type === "income"
                      ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"
                      : "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400",
                  )}
                >
                  {transaction.type === "income" ? (
                    <ArrowDownLeft className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                  )}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{transaction.name}</p>
                <p className="truncate text-xs text-muted-foreground">{transaction.description}</p>
              </div>
              <div className="text-right">
                <p
                  className={cn(
                    "text-sm font-semibold",
                    transaction.type === "income" && "text-emerald-600 dark:text-emerald-400",
                  )}
                >
                  {transaction.type === "income" ? "+" : "-"}R${" "}
                  {Math.abs(transaction.amount).toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                  })}
                </p>
                <p className="text-xs text-muted-foreground">{transaction.date}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
