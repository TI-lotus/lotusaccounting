import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, AlertCircle, RefreshCw, XCircle, ArrowUp, ArrowDown, Eye, ExternalLink, RotateCcw } from "lucide-react";
import { BentoStatStrip } from "@/components/dashboard/BentoStatStrip";
import { BentoDataTable } from "@/components/BentoDataTable";
import { RowActions } from "@/components/RowActions";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useData } from "@/contexts/DataContext";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  applyReconciliationMatch,
  enqueueStatementImport,
  listBankAccounts,
  listBankTransactions,
  listReconciliationMatches,
  type BankAccount,
  type BankTransaction,
  type ReconciliationMatch,
} from "@/services/commercialMvp";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmt = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("pt-BR") : "—";
const isIncome = (direction: string | null) =>
  direction === "entrada" || direction === "income";

const Reconciliation = () => {
  const navigate = useNavigate();
  const { payments, updatePayment } = useData();
  const { integrationConnections } = useData();
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [matches, setMatches] = useState<ReconciliationMatch[]>([]);
  const [loadingBank, setLoadingBank] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState("");
  const [selectedPayment, setSelectedPayment] = useState<(typeof payments)[number] | null>(null);

  const interConnections = useMemo(
    () => integrationConnections.filter((connection) => connection.provider === "inter" || connection.integration_id === "inter"),
    [integrationConnections],
  );

  const refreshBankData = async () => {
    try {
      const [accountRows, transactionRows, matchRows] = await Promise.all([
        listBankAccounts(),
        listBankTransactions(),
        listReconciliationMatches(),
      ]);
      setAccounts(accountRows);
      setTransactions(transactionRows);
      setMatches(matchRows);
    } catch (error) {
      toast.error("Não foi possível carregar os extratos importados.");
    }
  };

  useEffect(() => {
    void refreshBankData();
  }, []);

  useEffect(() => {
    if (!selectedConnection && interConnections[0]?.id) {
      setSelectedConnection(interConnections[0].id);
    }
  }, [interConnections, selectedConnection]);

  const totals = useMemo(() => {
    const pendentes = payments.filter((p) => !p.reconciled_at);
    const conciliados = payments.filter((p) => p.reconciled_at);
    return {
      pendCount: pendentes.length,
      pendAmount: pendentes.reduce((s, p) => s + Number(p.amount), 0),
      okCount: conciliados.length,
      okAmount: conciliados.reduce((s, p) => s + Number(p.amount), 0),
    };
  }, [payments]);

  const toggle = async (id: string) => {
    const payment = payments.find((p) => p.id === id);
    if (!payment) return;
    const isReconciled = !!payment.reconciled_at;

    const saved = await updatePayment(id, {
      reconciled_at: isReconciled ? null : new Date().toISOString(),
      reconciled_by: isReconciled ? null : (user?.id ?? null),
    });
    if (!saved) return;
    toast.success(isReconciled ? "Marcado como pendente" : "Conciliado");
  };

  const importInterStatement = async () => {
    if (!selectedConnection) {
      toast.error("Configure uma integração Banco Inter antes de importar.");
      return;
    }
    setLoadingBank(true);
    try {
      const to = new Date().toISOString().slice(0, 10);
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - 30);
      await enqueueStatementImport(selectedConnection, fromDate.toISOString().slice(0, 10), to);
      toast.success("Importação enfileirada. O scheduler processará o extrato em instantes.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao enfileirar importação.");
    } finally {
      setLoadingBank(false);
    }
  };

  const reviewMatch = async (matchId: string, approve: boolean) => {
    try {
      await applyReconciliationMatch(matchId, approve);
      toast.success(approve ? "Conciliação aprovada" : "Sugestão rejeitada");
      await refreshBankData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível revisar a sugestão.");
    }
  };

  const suggestedMatches = matches.filter((match) => match.status === "suggested");

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-[28px] font-normal tracking-[-0.035em]">Conciliação</h1>
          <p className="text-muted-foreground">
            Reconcilie lançamentos com extratos bancários
          </p>
        </div>

        <BentoStatStrip
          className="sm:grid-cols-2"
          items={[
            { label: "A conciliar", value: totals.pendCount, hint: brl(totals.pendAmount), icon: AlertCircle, compact: true },
            { label: "Conciliados", value: totals.okCount, hint: brl(totals.okAmount), icon: CheckCircle2, compact: true },
          ]}
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Banco Inter</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-medium">Conciliação por extrato importado</p>
                <p className="text-xs text-muted-foreground">
                  O MVP importa extratos e sugere matches. Pix, boleto e pagamentos ficam fora desta etapa.
                </p>
              </div>
              <div className="flex gap-2">
                <Select value={selectedConnection} onValueChange={setSelectedConnection}>
                  <SelectTrigger className="h-9 min-w-[190px] rounded-xl">
                    <SelectValue placeholder="Selecione a conexão" />
                  </SelectTrigger>
                  <SelectContent>
                    {interConnections.map((connection) => (
                      <SelectItem key={connection.id} value={connection.id}>
                        {connection.account_label ?? "Banco Inter"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" onClick={() => void refreshBankData()}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Atualizar
                </Button>
                <Button size="sm" onClick={() => void importInterStatement()} disabled={loadingBank}>
                  {loadingBank ? "Enfileirando..." : "Importar 30 dias"}
                </Button>
              </div>
            </div>

            <BentoStatStrip
              className="sm:grid-cols-3"
              items={[
                { label: "Contas conectadas", value: accounts.length, compact: true },
                { label: "Transações importadas", value: transactions.length, compact: true },
                { label: "Sugestões pendentes", value: suggestedMatches.length, compact: true },
              ]}
            />

            {suggestedMatches.length > 0 && (
              <div className="space-y-2">
                {suggestedMatches.map((match) => {
                  const transaction = transactions.find((item) => item.id === match.bank_transaction_id);
                  const payment = payments.find((item) => item.id === match.payment_id);
                  return (
                    <div key={match.id} className="flex flex-col gap-3 rounded-xl border p-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm font-medium">{transaction?.description ?? "Transação importada"}</p>
                        <p className="text-xs text-muted-foreground">
                          {fmt(transaction?.posted_at)} • {transaction ? brl(Number(transaction.amount)) : "—"} • match com {payment?.description ?? "pagamento"}
                        </p>
                        <p className="text-xs text-muted-foreground">{match.reason}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{Number(match.confidence).toFixed(0)}%</Badge>
                        <Button size="sm" onClick={() => void reviewMatch(match.id, true)}>
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Aprovar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => void reviewMatch(match.id, false)}>
                          <XCircle className="mr-2 h-4 w-4" />
                          Rejeitar
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <section className="page-section animate-fade-in space-y-4">
          <div>
            <h2 className="text-base font-medium">Lançamentos</h2>
            <p className="mt-1 text-sm text-muted-foreground">Compare recebimentos com as transações importadas.</p>
          </div>
          <BentoDataTable
            rows={payments}
            getRowKey={(payment) => payment.id}
            empty="Nenhum lançamento a conciliar."
            columns={[
              {
                key: "reference",
                label: "Referência",
                render: (payment) => <span className="block max-w-[240px] truncate font-medium">{payment.description || "Sem descrição"}</span>,
              },
              {
                key: "date",
                label: "Data",
                sortValue: (payment) => {
                  const date = payment.paid_at ?? payment.due_date;
                  return date ? new Date(date) : null;
                },
                render: (payment) => <span className="whitespace-nowrap text-sm text-muted-foreground">{fmt(payment.paid_at ?? payment.due_date)}</span>,
              },
              {
                key: "type",
                label: "Tipo",
                render: (payment) => { const income = isIncome(payment.direction); const Icon = income ? ArrowUp : ArrowDown; return <span className={income ? "inline-flex items-center gap-2 text-emerald-600 dark:text-emerald-400" : "inline-flex items-center gap-2 text-red-600 dark:text-red-400"}><Icon className="h-4 w-4" aria-hidden="true" />{income ? "Receita" : "Despesa"}</span>; },
              },
              {
                key: "value",
                label: "Valor",
                sortValue: (payment) => Number(payment.amount),
                className: "text-right font-medium tabular-nums",
                headerClassName: "text-right",
                render: (payment) => <span className="whitespace-nowrap">{brl(Number(payment.amount))}</span>,
              },
              {
                key: "status",
                label: "Status",
                render: (payment) => payment.reconciled_at ? <Badge className="bg-emerald-500 text-white hover:bg-emerald-500">Conciliado</Badge> : <Badge variant="secondary">Pendente</Badge>,
              },
            ]}
            actions={(payment) => {
              const reconciled = Boolean(payment.reconciled_at);
              return (
                <RowActions
                  primaryLabel={reconciled ? "Desfazer conciliação" : "Conciliar lançamento"}
                  primaryIcon={reconciled ? RotateCcw : CheckCircle2}
                  onPrimary={() => void toggle(payment.id)}
                  menuItems={[
                    { label: "Ver detalhes", icon: Eye, onSelect: () => setSelectedPayment(payment) },
                    { label: "Abrir pagamentos", icon: ExternalLink, onSelect: () => navigate("/payments") },
                  ]}
                />
              );
            }}
          />
        </section>
      </div>
      <Dialog open={Boolean(selectedPayment)} onOpenChange={(open) => !open && setSelectedPayment(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedPayment?.description || "Lançamento"}</DialogTitle>
            <DialogDescription>Detalhes da conciliação.</DialogDescription>
          </DialogHeader>
          {selectedPayment && (
            <dl className="grid grid-cols-2 gap-4 rounded-2xl border border-border/70 bg-secondary/35 p-4 text-sm">
              <div><dt className="text-xs text-muted-foreground">Referência</dt><dd className="mt-1 break-words font-medium">{selectedPayment.description || "Sem descrição"}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Valor</dt><dd className="mt-1 font-medium tabular-nums">{brl(Number(selectedPayment.amount))}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Data</dt><dd className="mt-1">{fmt(selectedPayment.paid_at ?? selectedPayment.due_date)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Tipo</dt><dd className="mt-1">{isIncome(selectedPayment.direction) ? "Receita" : "Despesa"}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Status</dt><dd className="mt-1">{selectedPayment.reconciled_at ? "Conciliado" : "Pendente"}</dd></div>
            </dl>
          )}
          <DialogFooter><Button variant="ghost" className="border-0" onClick={() => setSelectedPayment(null)}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Reconciliation;
