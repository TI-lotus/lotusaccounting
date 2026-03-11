import { ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const transactions = [
  {
    id: 1,
    name: "Pagamento Stripe",
    description: "Fatura #1234 - Acme Corp",
    amount: 12500,
    type: "income",
    date: "Hoje, 14:30",
  },
  {
    id: 2,
    name: "Material de Escritório",
    description: "Assinatura mensal",
    amount: -450,
    type: "expense",
    date: "Hoje, 11:15",
  },
  {
    id: 3,
    name: "Pagamento Cliente",
    description: "Fatura #1231 - TechStart Inc",
    amount: 8750,
    type: "income",
    date: "Ontem, 16:45",
  },
  {
    id: 4,
    name: "Licença de Software",
    description: "Renovação anual - Adobe CC",
    amount: -899,
    type: "expense",
    date: "Ontem, 10:00",
  },
  {
    id: 5,
    name: "Taxa de Consultoria",
    description: "Fatura #1228 - Global Finance",
    amount: 15000,
    type: "income",
    date: "10 Jan, 15:20",
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
          <h3 className="text-lg font-semibold">Transações Recentes</h3>
          <p className="text-sm text-muted-foreground">Últimas movimentações financeiras</p>
        </div>
        <button className="text-sm text-primary font-medium hover:underline">
          Ver tudo
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
                {transaction.type === "income" ? "+" : "-"}R${" "}
                {Math.abs(transaction.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-muted-foreground">{transaction.date}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
