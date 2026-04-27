import { useState } from "react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { CreditCard, Plus, ArrowUpRight, ArrowDownLeft, Calendar, LayoutDashboard, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { CalendarEventView, CalendarRangeControls } from "@/components/CalendarEventView";

interface Payment {
  id: number;
  description: string;
  amount: number;
  type: "income" | "expense";
  status: "completed" | "pending";
  date: string;
  category: string;
}

const initialPayments: Payment[] = [
  { id: 1, description: "Fatura #1234 - Acme Corp", amount: 12500, type: "income", status: "completed", date: "12 Jan, 2026", category: "Serviços" },
  { id: 2, description: "Licença de Software - Adobe", amount: 899, type: "expense", status: "completed", date: "11 Jan, 2026", category: "Software" },
  { id: 3, description: "Fatura #1231 - TechStart", amount: 8750, type: "income", status: "pending", date: "10 Jan, 2026", category: "Serviços" },
  { id: 4, description: "Material de Escritório", amount: 450, type: "expense", status: "completed", date: "10 Jan, 2026", category: "Suprimentos" },
  { id: 5, description: "Fatura #1228 - Global Finance", amount: 15000, type: "income", status: "completed", date: "9 Jan, 2026", category: "Consultoria" },
  { id: 6, description: "Aluguel do Escritório", amount: 4500, type: "expense", status: "completed", date: "5 Jan, 2026", category: "Instalações" },
  { id: 7, description: "Fatura #1225 - DataFlow", amount: 22000, type: "income", status: "completed", date: "3 Jan, 2026", category: "Serviços" },
  { id: 8, description: "Marketing Digital", amount: 2800, type: "expense", status: "pending", date: "2 Jan, 2026", category: "Marketing" },
];

const Payments = () => {
  const [payments, setPayments] = useState<Payment[]>(initialPayments);
  const [filter, setFilter] = useState<"all" | "income" | "expense">("all");
  const [view, setView] = useState<"dashboard" | "list" | "calendar">("dashboard");
  const [dateRange, setDateRange] = useState({ start: "2026-01-01", end: "2026-01-31" });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newPayment, setNewPayment] = useState({
    description: "",
    amount: "",
    type: "income" as "income" | "expense",
    category: "",
  });

  const filteredPayments = payments.filter((p) => {
    if (filter === "all") return true;
    return p.type === filter;
  });

  const totalIncome = payments.filter((p) => p.type === "income").reduce((sum, p) => sum + p.amount, 0);
  const totalExpense = payments.filter((p) => p.type === "expense").reduce((sum, p) => sum + p.amount, 0);
  const netFlow = totalIncome - totalExpense;

  const handleAddPayment = () => {
    if (!newPayment.description || !newPayment.amount) {
      toast.error("Preencha descrição e valor");
      return;
    }

    const payment: Payment = {
      id: Date.now(),
      description: newPayment.description,
      amount: parseFloat(newPayment.amount),
      type: newPayment.type,
      status: "pending",
      date: new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" }),
      category: newPayment.category || "Outros",
    };

    setPayments([payment, ...payments]);
    setNewPayment({ description: "", amount: "", type: "income", category: "" });
    setDialogOpen(false);
    toast.success("Pagamento registrado com sucesso!");
  };

  const handleToggleStatus = (id: number) => {
    setPayments(payments.map((p) => 
      p.id === id ? { ...p, status: p.status === "completed" ? "pending" : "completed" } : p
    ));
    toast.success("Status atualizado!");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between animate-fade-in">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Pagamentos</h1>
            <p className="text-muted-foreground">Acompanhe entradas e saídas financeiras</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-xl gap-2">
                <Plus className="h-4 w-4" />
                Registrar Pagamento
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Novo Pagamento</DialogTitle>
                <DialogDescription>
                  Registre uma nova entrada ou saída financeira.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="type">Tipo</Label>
                  <Select
                    value={newPayment.type}
                    onValueChange={(value: "income" | "expense") =>
                      setNewPayment({ ...newPayment, type: value })
                    }
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">Entrada</SelectItem>
                      <SelectItem value="expense">Saída</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Input
                    id="description"
                    value={newPayment.description}
                    onChange={(e) => setNewPayment({ ...newPayment, description: e.target.value })}
                    placeholder="Ex: Fatura #1234"
                    className="rounded-xl"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="amount">Valor (R$)</Label>
                  <Input
                    id="amount"
                    type="number"
                    value={newPayment.amount}
                    onChange={(e) => setNewPayment({ ...newPayment, amount: e.target.value })}
                    placeholder="0,00"
                    className="rounded-xl"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="category">Categoria</Label>
                  <Input
                    id="category"
                    value={newPayment.category}
                    onChange={(e) => setNewPayment({ ...newPayment, category: e.target.value })}
                    placeholder="Ex: Serviços, Software"
                    className="rounded-xl"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">
                  Cancelar
                </Button>
                <Button onClick={handleAddPayment} className="rounded-xl">
                  Registrar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 animate-fade-in">
          <div className="flex rounded-2xl border border-border bg-card p-1">
            {[
              { value: "dashboard", label: "Dashboard", icon: LayoutDashboard },
              { value: "list", label: "Lista", icon: List },
              { value: "calendar", label: "Calendário", icon: Calendar },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Button key={item.value} variant={view === item.value ? "default" : "ghost"} size="sm" className="rounded-xl" onClick={() => setView(item.value as typeof view)}>
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Button>
              );
            })}
          </div>
          {view === "calendar" && (
            <CalendarRangeControls dateRange={dateRange} onDateRangeChange={setDateRange} />
          )}
        </div>

        {view === "dashboard" && <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="kpi-card animate-fade-in cursor-pointer hover:ring-2 ring-accent transition-all" onClick={() => setFilter("income")}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950">
                <ArrowDownLeft className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Entradas</p>
                <p className="text-xl font-semibold text-emerald-600 dark:text-emerald-400">
                  R$ {totalIncome.toLocaleString("pt-BR")}
                </p>
              </div>
            </div>
          </div>
          <div className="kpi-card animate-fade-in cursor-pointer hover:ring-2 ring-accent transition-all" onClick={() => setFilter("expense")}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-red-100 dark:bg-red-950">
                <ArrowUpRight className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Saídas</p>
                <p className="text-xl font-semibold text-red-600 dark:text-red-400">
                  R$ {totalExpense.toLocaleString("pt-BR")}
                </p>
              </div>
            </div>
          </div>
          <div className="kpi-card animate-fade-in cursor-pointer hover:ring-2 ring-accent transition-all" onClick={() => setFilter("all")}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-accent">
                <CreditCard className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Saldo Líquido</p>
                <p className={cn("text-xl font-semibold", netFlow >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                  {netFlow >= 0 ? "+" : ""}R$ {netFlow.toLocaleString("pt-BR")}
                </p>
              </div>
            </div>
          </div>
        </div>}

        {view === "calendar" && (
          <CalendarEventView
            title="Calendário financeiro"
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            events={[2, 3, 5, 9, 10, 11, 12].map((day) => ({ day, title: "Pagamento", time: "09:00" }))}
          />
        )}

        {view === "list" && <div className="glass rounded-2xl p-6 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Pagamentos Recentes</h3>
            <div className="flex gap-2">
              <Button
                variant={filter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("all")}
                className="rounded-lg"
              >
                Todos
              </Button>
              <Button
                variant={filter === "income" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("income")}
                className="rounded-lg"
              >
                Entradas
              </Button>
              <Button
                variant={filter === "expense" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("expense")}
                className="rounded-lg"
              >
                Saídas
              </Button>
            </div>
          </div>
          <div className="space-y-3">
            {filteredPayments.map((payment, index) => (
              <div
                key={payment.id}
                className="flex items-center gap-4 p-4 rounded-xl hover:bg-accent/50 transition-colors border border-transparent hover:border-border cursor-pointer"
                style={{ animationDelay: `${index * 50}ms` }}
                onClick={() => handleToggleStatus(payment.id)}
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
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>{payment.date}</span>
                    <span>•</span>
                    <span>{payment.category}</span>
                  </div>
                </div>
                <Badge 
                  variant={payment.status === 'completed' ? 'default' : 'secondary'}
                  className="cursor-pointer"
                >
                  {payment.status === 'completed' ? 'Concluído' : 'Pendente'}
                </Badge>
                <p className={cn(
                  "font-semibold min-w-[100px] text-right",
                  payment.type === 'income' 
                    ? "text-emerald-600 dark:text-emerald-400" 
                    : "text-red-600 dark:text-red-400"
                )}>
                  {payment.type === 'income' ? '+' : '-'}R$ {payment.amount.toLocaleString("pt-BR")}
                </p>
              </div>
            ))}
          </div>
        </div>}
      </div>
    </DashboardLayout>
  );
};

export default Payments;
