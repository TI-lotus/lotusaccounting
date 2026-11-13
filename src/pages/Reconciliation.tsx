import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, RefreshCw, XCircle } from "lucide-react";
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
  const { payments, updatePayment } = useData();
  const { integrationConnections } = useData();
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [matches, setMatches] = useState<ReconciliationMatch[]>([]);
  const [loadingBank, setLoadingBank] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState("");

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
          <h1 className="text-2xl font-semibold tracking-tight">Conciliação</h1>
          <p className="text-muted-foreground">
            Reconcilie lançamentos com extratos bancários
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">
                  A conciliar
                </span>
                <AlertCircle className="h-4 w-4 text-amber-500" />
              </div>
              <p className="text-2xl font-semibold">{totals.pendCount}</p>
              <p className="text-xs text-muted-foreground">
                {brl(totals.pendAmount)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">
                  Conciliados
                </span>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              </div>
              <p className="text-2xl font-semibold">{totals.okCount}</p>
              <p className="text-xs text-muted-foreground">
                {brl(totals.okAmount)}
              </p>
            </CardContent>
          </Card>
        </div>

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
                <select
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                  value={selectedConnection}
                  onChange={(event) => setSelectedConnection(event.target.value)}
                >
                  <option value="">Selecione a conexão</option>
                  {interConnections.map((connection) => (
                    <option key={connection.id} value={connection.id}>
                      {connection.account_label ?? "Banco Inter"}
                    </option>
                  ))}
                </select>
                <Button size="sm" variant="outline" onClick={() => void refreshBankData()}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Atualizar
                </Button>
                <Button size="sm" onClick={() => void importInterStatement()} disabled={loadingBank}>
                  {loadingBank ? "Enfileirando..." : "Importar 30 dias"}
                </Button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Contas conectadas</p>
                <p className="text-xl font-semibold">{accounts.length}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Transações importadas</p>
                <p className="text-xl font-semibold">{transactions.length}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Sugestões pendentes</p>
                <p className="text-xl font-semibold">{suggestedMatches.length}</p>
              </div>
            </div>

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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lançamentos</CardTitle>
          </CardHeader>
          <CardContent>
            {payments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum lançamento a conciliar
              </p>
            ) : (
              <div className="space-y-2">
                {payments.map((p) => {
                  const ok = !!p.reconciled_at;
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-3 rounded-xl hover:bg-accent/50 transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {p.description || "Sem descrição"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {fmt(p.paid_at ?? p.due_date)} •{" "}
                          {isIncome(p.direction) ? "Entrada" : "Saída"}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold">
                          {brl(Number(p.amount))}
                        </span>
                        {ok && (
                          <Badge className="bg-emerald-500 hover:bg-emerald-500 text-white">
                            Conciliado
                          </Badge>
                        )}
                        <Button
                          size="sm"
                          variant={ok ? "outline" : "default"}
                          className="rounded-xl"
                          onClick={() => toggle(p.id)}
                        >
                          {ok ? "Desfazer" : "Conciliar"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Reconciliation;
