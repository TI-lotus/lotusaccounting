import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Building2,
  Edit,
  Save,
  X,
  FileText,
  CheckSquare,
  CreditCard,
  Wallet,
  ScrollText,
  MessageSquare,
  Activity,
  CalendarClock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useData } from "@/contexts/DataContext";
import {
  ClientData,
  ClientPeriodChecklistStatus,
  ClientPeriodStatus,
  ClientPeriodStepStatus,
} from "@/types";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { BentoStatStrip } from "@/components/dashboard/BentoStatStrip";

type ClientActivity = Pick<
  Database["public"]["Tables"]["activity_logs"]["Row"],
  "id" | "entity" | "action" | "created_at" | "user_id" | "metadata"
>;
type ActivityEntityFilter =
  | "all"
  | "document"
  | "task"
  | "invoice"
  | "payment"
  | "fiscal_obligation"
  | "audit";
type ActivityPeriodFilter = "all" | "7" | "30" | "90";

const taxRegimeLabels: Record<string, string> = {
  simples_nacional: "Simples Nacional",
  lucro_presumido: "Lucro Presumido",
  lucro_real: "Lucro Real",
  mei: "MEI",
};

const periodStatusLabels: Record<ClientPeriodStatus, string> = {
  not_started: "Não iniciada",
  waiting_documents: "Aguardando documentos",
  in_progress: "Em execução",
  in_review: "Em revisão",
  delivered: "Entregue",
  closed: "Fechada",
  blocked: "Bloqueada",
};

const periodStatusStyles: Record<ClientPeriodStatus, string> = {
  not_started: "bg-muted text-muted-foreground",
  waiting_documents: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  in_review: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  delivered: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  closed: "bg-gilver text-[hsl(0,0%,9%)]",
  blocked: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

const stepStatusLabels: Record<ClientPeriodStepStatus, string> = {
  pending: "Pendente",
  in_progress: "Em andamento",
  completed: "Concluída",
  blocked: "Bloqueada",
  waived: "Dispensada",
};

const stepStatusStyles: Record<ClientPeriodStepStatus, string> = {
  pending: "bg-muted text-muted-foreground",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  blocked: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  waived: "bg-slate-100 text-slate-700 dark:bg-slate-950 dark:text-slate-300",
};

const checklistStatusLabels: Record<ClientPeriodChecklistStatus, string> = {
  pending: "Pendente",
  in_progress: "Em andamento",
  in_review: "Em revisão",
  completed: "Concluído",
  blocked: "Bloqueado",
  waived: "Dispensado",
};

const checklistStatusStyles: Record<ClientPeriodChecklistStatus, string> = {
  pending: "bg-muted text-muted-foreground",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  in_review: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  blocked: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  waived: "bg-slate-100 text-slate-700 dark:bg-slate-950 dark:text-slate-300",
};

const serviceAreaLabels: Record<string, string> = {
  fiscal: "Fiscal",
  contabil: "Contábil",
  folha: "Folha",
  financeiro_bpo: "Financeiro/BPO",
  societario: "Societário",
};

const serviceAreaOptions: { value: ClientData["serviceAreas"][number]; label: string }[] = [
  { value: "fiscal", label: "Fiscal" },
  { value: "contabil", label: "Contábil" },
  { value: "folha", label: "Folha" },
  { value: "financeiro_bpo", label: "Financeiro/BPO" },
  { value: "societario", label: "Societário" },
];

const brl = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmt = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString("pt-BR") : "—";
const currentPeriod = () => {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
};
const metadataText = (
  metadata: Database["public"]["Tables"]["activity_logs"]["Row"]["metadata"],
  key: string,
) => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const value = metadata[key];
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.filter(Boolean).join(", ");
  return null;
};
const activityDescription = (activity: ClientActivity) => {
  const fields = metadataText(activity.metadata, "changed_fields");
  const oldStatus = metadataText(activity.metadata, "old_status");
  const newStatus = metadataText(activity.metadata, "new_status");
  const label = metadataText(activity.metadata, "label");
  const details = [
    label,
    oldStatus && newStatus && oldStatus !== newStatus
      ? `status: ${oldStatus} -> ${newStatus}`
      : null,
    fields ? `campos: ${fields}` : null,
  ].filter(Boolean);
  return details.length ? details.join(" · ") : "Registro de auditoria";
};
const activityLabel = (activity: ClientActivity) => {
  const action =
    activity.action === "insert"
      ? "criado"
      : activity.action === "created"
        ? "criado"
        : activity.action === "update"
          ? "atualizado"
          : activity.action === "updated"
            ? "atualizado"
            : activity.action === "delete"
              ? "removido"
              : activity.action === "deleted"
                ? "removido"
                : activity.action || "registrado";
  const entity =
    activity.entity === "company"
      ? "Cliente"
      : activity.entity === "task"
        ? "Tarefa"
        : activity.entity === "document"
          ? "Documento"
          : activity.entity === "invoice"
            ? "Fatura"
            : activity.entity === "payment"
              ? "Pagamento"
              : activity.entity === "fiscal_obligation"
                ? "Obrigação fiscal"
                : "Registro";
  return `${entity} ${action}`;
};

type TimelineItem = {
  id: string;
  title: string;
  description: string;
  date: string | null;
  badge: string;
};

const ClientDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    clients,
    updateClient,
    documents,
    tasks,
    invoices,
    payments,
    fiscalObligations,
    clientPeriods,
    clientPeriodSteps,
    clientPeriodChecklistItems,
    documentRequests,
  } = useData();

  const client = clients.find((c) => c.id === id);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<ClientData>>({});
  const [clientActivities, setClientActivities] = useState<ClientActivity[]>(
    [],
  );
  const [activityEntityFilter, setActivityEntityFilter] =
    useState<ActivityEntityFilter>("all");
  const [activityPeriodFilter, setActivityPeriodFilter] =
    useState<ActivityPeriodFilter>("all");

  useEffect(() => {
    if (!client?.id) {
      setClientActivities([]);
      return;
    }

    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("id, entity, action, created_at, user_id, metadata")
        .eq("company_id", client.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (cancelled) return;
      if (error) toast.error("Erro ao carregar atividades: " + error.message);
      setClientActivities((data ?? []) as ClientActivity[]);
    })();

    return () => {
      cancelled = true;
    };
  }, [client?.id]);

  const clientInvoices = useMemo(
    () => invoices.filter((invoice) => invoice.company_id === client?.id),
    [client?.id, invoices],
  );

  const clientPayments = useMemo(
    () => payments.filter((payment) => payment.company_id === client?.id),
    [client?.id, payments],
  );

  const clientDocuments = useMemo(
    () => documents.filter((document) => document.clientId === client?.id),
    [client?.id, documents],
  );

  const clientTasks = useMemo(
    () => tasks.filter((task) => task.clientId === client?.id),
    [client?.id, tasks],
  );

  const clientObligations = useMemo(
    () =>
      fiscalObligations.filter(
        (obligation) => obligation.company_id === client?.id,
      ),
    [client?.id, fiscalObligations],
  );

  const activePeriod = useMemo(() => currentPeriod(), []);
  const clientPeriodHistory = useMemo(
    () =>
      clientPeriods
        .filter((period) => period.companyId === client?.id)
        .sort((a, b) => b.periodYear - a.periodYear || b.periodMonth - a.periodMonth),
    [client?.id, clientPeriods],
  );
  const currentClientPeriod = useMemo(
    () =>
      clientPeriodHistory.find(
        (period) =>
          period.periodMonth === activePeriod.month &&
          period.periodYear === activePeriod.year,
      ) ?? null,
    [activePeriod.month, activePeriod.year, clientPeriodHistory],
  );
  const currentPeriodSteps = useMemo(
    () =>
      currentClientPeriod
        ? clientPeriodSteps
            .filter((step) => step.clientPeriodId === currentClientPeriod.id)
            .sort((a, b) => a.position - b.position)
        : [],
    [clientPeriodSteps, currentClientPeriod],
  );
  const currentPeriodDoneSteps = currentPeriodSteps.filter(
    (step) => step.status === "completed" || step.status === "waived",
  ).length;
  const currentPeriodChecklistItems = useMemo(
    () =>
      currentClientPeriod
        ? clientPeriodChecklistItems
            .filter((item) => item.clientPeriodId === currentClientPeriod.id)
            .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title))
        : [],
    [clientPeriodChecklistItems, currentClientPeriod],
  );
  const currentPeriodDoneChecklistItems = currentPeriodChecklistItems.filter(
    (item) => item.status === "completed" || item.status === "waived",
  ).length;
  const currentPeriodDocumentRequests = useMemo(
    () =>
      currentClientPeriod
        ? documentRequests
            .filter((request) => request.clientPeriodId === currentClientPeriod.id)
            .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
        : [],
    [currentClientPeriod, documentRequests],
  );
  const currentPeriodDoneDocumentRequests = currentPeriodDocumentRequests.filter(
    (request) => request.status === "approved" || request.status === "waived",
  ).length;

  const visibleClientActivities = useMemo(() => {
    const minDate =
      activityPeriodFilter === "all"
        ? null
        : new Date(
            Date.now() - Number(activityPeriodFilter) * 24 * 60 * 60 * 1000,
          );
    return clientActivities.filter((activity) => {
      const entityMatch =
        activityEntityFilter === "all" ||
        (activityEntityFilter === "audit"
          ? true
          : activity.entity === activityEntityFilter);
      const periodMatch =
        !minDate ||
        (activity.created_at && new Date(activity.created_at) >= minDate);
      return entityMatch && periodMatch;
    });
  }, [activityEntityFilter, activityPeriodFilter, clientActivities]);

  const clientTimeline = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = [
      ...clientDocuments.map((doc) => ({
        id: `document-${doc.id}`,
        title: doc.name,
        description: `Documento ${doc.documentType}`,
        date: doc.createdAt,
        badge: "Documento",
      })),
      ...clientTasks.map((task) => ({
        id: `task-${task.id}`,
        title: task.title,
        description: `Tarefa ${task.status === "completed" ? "concluída" : "em aberto"}`,
        date: task.completedAt ?? task.dueDate ?? task.createdAt,
        badge: "Tarefa",
      })),
      ...clientInvoices.map((invoice) => ({
        id: `invoice-${invoice.id}`,
        title: invoice.number || `Fatura ${invoice.id.slice(0, 8)}`,
        description: `${brl(Number(invoice.amount || 0))} · ${invoice.status || "sem status"}`,
        date: invoice.issued_at ?? invoice.created_at ?? invoice.due_date,
        badge: "Fatura",
      })),
      ...clientPayments.map((payment) => ({
        id: `payment-${payment.id}`,
        title: payment.description || "Pagamento sem descrição",
        description: `${brl(Number(payment.amount || 0))} · ${payment.status || "sem status"}`,
        date: payment.paid_at ?? payment.created_at ?? payment.due_date,
        badge: "Pagamento",
      })),
      ...clientObligations.map((obligation) => ({
        id: `obligation-${obligation.id}`,
        title: obligation.name,
        description: `Obrigação fiscal ${obligation.status}`,
        date: obligation.completed_at ?? obligation.due_date,
        badge: "Obrigação",
      })),
      ...visibleClientActivities.map((activity) => ({
        id: `activity-${activity.id}`,
        title: activityLabel(activity),
        description: activityDescription(activity),
        date: activity.created_at,
        badge: "Auditoria",
      })),
    ];

    return items.sort(
      (a, b) =>
        new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime(),
    );
  }, [
    clientDocuments,
    clientInvoices,
    clientObligations,
    clientPayments,
    clientTasks,
    visibleClientActivities,
  ]);

  const financialSummary = useMemo(() => {
    const invoiced = clientInvoices.reduce(
      (sum, invoice) => sum + Number(invoice.amount || 0),
      0,
    );
    const paidInvoices = clientInvoices
      .filter((invoice) => invoice.status === "paid")
      .reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);
    const received = clientPayments
      .filter(
        (payment) =>
          payment.status === "completed" &&
          (payment.direction === "entrada" || payment.direction === "income"),
      )
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const pending = clientInvoices
      .filter(
        (invoice) =>
          invoice.status === "pending" || invoice.status === "overdue",
      )
      .reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);
    const currentMonth = new Date().toISOString().slice(0, 7);
    const currentMonthReceived = clientPayments
      .filter((payment) =>
        payment.status === "completed" &&
        (payment.direction === "entrada" || payment.direction === "income") &&
        (payment.paid_at ?? payment.created_at)?.slice(0, 7) === currentMonth,
      )
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    return { invoiced, paidInvoices, received, pending, currentMonthReceived };
  }, [clientInvoices, clientPayments]);

  if (!client) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Cliente não encontrado</p>
          <Button variant="link" onClick={() => navigate("/clients")}>
            Voltar para Clientes
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const startEditing = () => {
    setEditData({
      name: client.name,
      email: client.email,
      phone: client.phone,
      cnpj: client.cnpj,
      taxRegime: client.taxRegime,
      serviceAreas: client.serviceAreas,
      serviceFee: client.serviceFee,
      city: client.city,
      state: client.state,
    });
    setIsEditing(true);
  };

  const saveEditing = async () => {
    if (!await updateClient(client.id, editData)) return;
    setIsEditing(false);
    toast.success("Cliente atualizado com sucesso!");
  };

  const toggleServiceArea = (service: ClientData["serviceAreas"][number], checked: boolean) => {
    setEditData((current) => {
      const currentAreas = current.serviceAreas ?? client.serviceAreas;
      const next = checked
        ? Array.from(new Set([...currentAreas, service]))
        : currentAreas.filter((item) => item !== service);
      return { ...current, serviceAreas: next.length ? next : currentAreas };
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 animate-fade-in">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Voltar para clientes"
            title="Voltar para clientes"
            onClick={() => navigate("/clients")}
            className="rounded-xl"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-[28px] font-normal tracking-[-0.035em]">
              {client.name}
            </h1>
            <p className="text-muted-foreground">{client.cnpj}</p>
          </div>
          <Badge
            variant={
              client.status === "active"
                ? "default"
                : client.status === "pending"
                  ? "secondary"
                  : "outline"
            }
          >
            {client.status === "active"
              ? "Ativo"
              : client.status === "pending"
                ? "Pendente"
                : "Inativo"}
          </Badge>
          {isEditing ? (
            <div className="flex gap-2">
              <Button onClick={saveEditing} className="rounded-xl gap-2">
                <Save className="h-4 w-4" />
                Salvar
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsEditing(false)}
                className="rounded-xl gap-2"
              >
                <X className="h-4 w-4" />
                Cancelar
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              onClick={startEditing}
              className="rounded-xl gap-2"
            >
              <Edit className="h-4 w-4" />
              Editar
            </Button>
          )}
        </div>

        <Tabs defaultValue="info" className="animate-fade-in">
          <TabsList className="flex flex-wrap h-auto w-full justify-start">
            <TabsTrigger value="info" className="gap-2">
              <Building2 className="h-4 w-4" />
              Cadastro
            </TabsTrigger>
            <TabsTrigger value="period" className="gap-2">
              <CalendarClock className="h-4 w-4" />
              Ciclo do mês
            </TabsTrigger>
            <TabsTrigger value="financial" className="gap-2">
              <Wallet className="h-4 w-4" />
              Financeiro
            </TabsTrigger>
            <TabsTrigger value="documents" className="gap-2">
              <FileText className="h-4 w-4" />
              Documentos
            </TabsTrigger>
            <TabsTrigger value="tasks" className="gap-2">
              <CheckSquare className="h-4 w-4" />
              Tarefas
            </TabsTrigger>
            <TabsTrigger value="obligations" className="gap-2">
              <ScrollText className="h-4 w-4" />
              Obrigações
            </TabsTrigger>
            <TabsTrigger value="messages" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Mensagens
            </TabsTrigger>
            <TabsTrigger value="activities" className="gap-2">
              <Activity className="h-4 w-4" />
              Atividades
            </TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Dados Cadastrais</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <Label>Nome da Empresa</Label>
                    {isEditing ? (
                      <Input
                        value={editData.name || ""}
                        onChange={(e) =>
                          setEditData({ ...editData, name: e.target.value })
                        }
                        className="rounded-xl"
                      />
                    ) : (
                      <p className="text-sm p-2 bg-muted rounded-xl">
                        {client.name}
                      </p>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <Label>CNPJ</Label>
                    {isEditing ? (
                      <Input
                        value={editData.cnpj || ""}
                        onChange={(e) =>
                          setEditData({ ...editData, cnpj: e.target.value })
                        }
                        className="rounded-xl"
                      />
                    ) : (
                      <p className="text-sm p-2 bg-muted rounded-xl">
                        {client.cnpj}
                      </p>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <Label>Regime Tributário</Label>
                    {isEditing ? (
                      <Select
                        value={editData.taxRegime}
                        onValueChange={(v: ClientData["taxRegime"]) =>
                          setEditData({ ...editData, taxRegime: v })
                        }
                      >
                        <SelectTrigger className="rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="simples_nacional">
                            Simples Nacional
                          </SelectItem>
                          <SelectItem value="lucro_presumido">
                            Lucro Presumido
                          </SelectItem>
                          <SelectItem value="lucro_real">Lucro Real</SelectItem>
                          <SelectItem value="mei">MEI</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-sm p-2 bg-muted rounded-xl">
                        {taxRegimeLabels[client.taxRegime]}
                      </p>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <Label>Serviços contratados</Label>
                    {isEditing ? (
                      <div className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-2">
                        {serviceAreaOptions.map((service) => (
                          <label key={service.value} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={(editData.serviceAreas ?? client.serviceAreas).includes(service.value)}
                              onCheckedChange={(value) => toggleServiceArea(service.value, value === true)}
                            />
                            <span>{service.label}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2 rounded-xl bg-muted p-2">
                        {client.serviceAreas.map((service) => (
                          <Badge key={service} variant="secondary">
                            {serviceAreaLabels[service] ?? service}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Contato e Financeiro</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <Label className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      Email
                    </Label>
                    {isEditing ? (
                      <Input
                        value={editData.email || ""}
                        onChange={(e) =>
                          setEditData({ ...editData, email: e.target.value })
                        }
                        className="rounded-xl"
                      />
                    ) : (
                      <p className="text-sm p-2 bg-muted rounded-xl">
                        {client.email}
                      </p>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <Label className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      Telefone
                    </Label>
                    {isEditing ? (
                      <Input
                        value={editData.phone || ""}
                        onChange={(e) =>
                          setEditData({ ...editData, phone: e.target.value })
                        }
                        className="rounded-xl"
                      />
                    ) : (
                      <p className="text-sm p-2 bg-muted rounded-xl">
                        {client.phone}
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        Cidade
                      </Label>
                      {isEditing ? (
                        <Input
                          value={editData.city || ""}
                          onChange={(e) =>
                            setEditData({ ...editData, city: e.target.value })
                          }
                          className="rounded-xl"
                        />
                      ) : (
                        <p className="text-sm p-2 bg-muted rounded-xl">
                          {client.city}
                        </p>
                      )}
                    </div>
                    <div className="grid gap-2">
                      <Label>Estado</Label>
                      {isEditing ? (
                        <Input
                          value={editData.state || ""}
                          onChange={(e) =>
                            setEditData({ ...editData, state: e.target.value })
                          }
                          className="rounded-xl"
                        />
                      ) : (
                        <p className="text-sm p-2 bg-muted rounded-xl">
                          {client.state}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label className="flex items-center gap-1">
                      <CreditCard className="h-3 w-3" />
                      Honorários
                    </Label>
                    {isEditing ? (
                      <Input
                        type="number"
                        value={editData.serviceFee || 0}
                        onChange={(e) =>
                          setEditData({
                            ...editData,
                            serviceFee: parseFloat(e.target.value),
                          })
                        }
                        className="rounded-xl"
                      />
                    ) : (
                      <p className="text-sm p-2 bg-muted rounded-xl">
                        R${" "}
                        {client.serviceFee.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-semibold">
                      {clientDocuments.length}
                    </p>
                    <p className="text-sm text-muted-foreground">Documentos</p>
                  </div>
                  <div>
                    <p className="text-2xl font-semibold">
                      {clientTasks.length}
                    </p>
                    <p className="text-sm text-muted-foreground">Tarefas</p>
                  </div>
                  <div>
                    <p className="text-2xl font-semibold">
                      R${" "}
                      {client.serviceFee.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                      })}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Honorários/mês
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="period" className="mt-6 space-y-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Competência atual</CardTitle>
                </CardHeader>
                <CardContent>
                  {!currentClientPeriod ? (
                    <div className="py-8 text-center">
                      <CalendarClock className="mx-auto mb-3 h-10 w-10 text-muted-foreground opacity-50" />
                      <p className="text-sm text-muted-foreground">
                        Nenhuma competência criada para este cliente no mês atual.
                      </p>
                      <Button
                        variant="outline"
                        className="mt-4 rounded-xl"
                        onClick={() => navigate("/periods")}
                      >
                        Abrir ciclo mensal
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm text-muted-foreground">
                            {String(currentClientPeriod.periodMonth).padStart(2, "0")}/{currentClientPeriod.periodYear}
                          </p>
                          <Badge className={periodStatusStyles[currentClientPeriod.status]}>
                            {periodStatusLabels[currentClientPeriod.status]}
                          </Badge>
                        </div>
                        <Button
                          variant="outline"
                          className="rounded-xl"
                          onClick={() => navigate("/periods")}
                        >
                          Ver operação
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Progresso operacional</span>
                          <span className="font-medium">{currentClientPeriod.progressPercent}%</span>
                        </div>
                        <Progress value={currentClientPeriod.progressPercent} className="h-2" />
                        <p className="text-xs text-muted-foreground">
                          {currentPeriodDoneChecklistItems}/{currentPeriodChecklistItems.length || 0} itens de checklist · {currentPeriodDoneSteps}/{currentPeriodSteps.length || 0} etapas macro
                        </p>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {currentPeriodSteps.map((step) => (
                          <div key={step.id} className="rounded-xl border border-border p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{step.title}</p>
                                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                  {step.description || "Etapa operacional da competência."}
                                </p>
                              </div>
                              <Badge className={stepStatusStyles[step.status]}>
                                {stepStatusLabels[step.status]}
                              </Badge>
                            </div>
                            {step.blockedReason && (
                              <p className="mt-2 text-xs text-red-600">{step.blockedReason}</p>
                            )}
                          </div>
                        ))}
                      </div>
                      {currentPeriodChecklistItems.length > 0 && (
                        <div className="space-y-3 border-t border-border pt-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium">Checklist gerado</p>
                              <p className="text-xs text-muted-foreground">
                                Itens operacionais criados pelo regime tributário do cliente.
                              </p>
                            </div>
                            <Badge variant="outline">
                              {currentPeriodDoneChecklistItems}/{currentPeriodChecklistItems.length}
                            </Badge>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {currentPeriodChecklistItems.slice(0, 8).map((item) => (
                              <div key={item.id} className="rounded-xl border border-border p-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-medium">{item.title}</p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      {serviceAreaLabels[item.serviceArea]} · venc. {item.dueDate ? fmt(`${item.dueDate}T00:00:00`) : "sem prazo"}
                                    </p>
                                  </div>
                                  <Badge className={checklistStatusStyles[item.status]}>
                                    {checklistStatusLabels[item.status]}
                                  </Badge>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {item.requiresReview && <Badge variant="secondary" className="text-[10px]">Revisão</Badge>}
                                  {item.requiresDocument && <Badge variant="secondary" className="text-[10px]">Documento</Badge>}
                                  {item.taskId && <Badge variant="outline" className="text-[10px]">Tarefa vinculada</Badge>}
                                </div>
                              </div>
                            ))}
                          </div>
                          {currentPeriodChecklistItems.length > 8 && (
                            <Button variant="outline" className="rounded-xl" onClick={() => navigate("/periods")}>
                              Ver checklist completo
                            </Button>
                          )}
                        </div>
                      )}
                      {currentPeriodDocumentRequests.length > 0 && (
                        <div className="space-y-3 border-t border-border pt-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium">Documentos solicitados</p>
                              <p className="text-xs text-muted-foreground">
                                Pendências documentais vinculadas à competência.
                              </p>
                            </div>
                            <Badge variant="outline">
                              {currentPeriodDoneDocumentRequests}/{currentPeriodDocumentRequests.length}
                            </Badge>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {currentPeriodDocumentRequests.slice(0, 8).map((request) => {
                              const statusLabel =
                                request.status === "requested"
                                  ? "Solicitado"
                                  : request.status === "uploaded"
                                    ? "Enviado"
                                    : request.status === "approved"
                                      ? "Aprovado"
                                      : request.status === "rejected"
                                        ? "Recusado"
                                        : "Dispensado";
                              const statusClass =
                                request.status === "approved"
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                                  : request.status === "uploaded"
                                    ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                                    : request.status === "rejected"
                                      ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                                      : request.status === "waived"
                                        ? "bg-slate-100 text-slate-700 dark:bg-slate-950 dark:text-slate-300"
                                        : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
                              return (
                                <div key={request.id} className="rounded-xl border border-border p-3">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-medium">{request.title}</p>
                                      <p className="mt-1 text-xs text-muted-foreground">
                                        Venc. {request.dueDate ? fmt(`${request.dueDate}T00:00:00`) : "sem prazo"}
                                      </p>
                                    </div>
                                    <Badge className={statusClass}>{statusLabel}</Badge>
                                  </div>
                                  {request.rejectionReason && <p className="mt-2 text-xs text-red-600">{request.rejectionReason}</p>}
                                  {request.waivedReason && <p className="mt-2 text-xs text-muted-foreground">{request.waivedReason}</p>}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Histórico de competências</CardTitle>
                </CardHeader>
                <CardContent>
                  {clientPeriodHistory.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      Ainda não há competências criadas para este cliente.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {clientPeriodHistory.slice(0, 8).map((period) => (
                        <div key={period.id} className="flex items-center justify-between rounded-xl border border-border p-3">
                          <div>
                            <p className="text-sm font-medium">
                              {String(period.periodMonth).padStart(2, "0")}/{period.periodYear}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Atualizada em {fmt(period.updatedAt)}
                            </p>
                          </div>
                          <div className="text-right">
                            <Badge className={periodStatusStyles[period.status]}>
                              {periodStatusLabels[period.status]}
                            </Badge>
                            <p className="mt-1 text-xs text-muted-foreground">{period.progressPercent}%</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="documents" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Documentos do Cliente</CardTitle>
              </CardHeader>
              <CardContent>
                {clientDocuments.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-sm text-muted-foreground">
                      Nenhum documento encontrado para este cliente
                    </p>
                    <Button
                      variant="outline"
                      className="mt-4 rounded-xl"
                      onClick={() => navigate("/documents")}
                    >
                      Adicionar documento
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {clientDocuments.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-accent/50 transition-colors"
                      >
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{doc.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {doc.date}
                          </p>
                        </div>
                        <Badge variant="secondary">
                          {doc.status === "paid"
                            ? "Pago"
                            : doc.status === "pending"
                              ? "Pendente"
                              : doc.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tasks" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Tarefas do Cliente</CardTitle>
              </CardHeader>
              <CardContent>
                {clientTasks.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-sm text-muted-foreground">
                      Nenhuma tarefa encontrada para este cliente
                    </p>
                    <Button
                      variant="outline"
                      className="mt-4 rounded-xl"
                      onClick={() => navigate("/tasks")}
                    >
                      Criar tarefa
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {clientTasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-accent/50 transition-colors"
                      >
                        <CheckSquare className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{task.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {" "}
                            {task.dueDate}
                          </p>
                        </div>
                        <Badge
                          variant={
                            task.status === "completed"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {task.status === "completed"
                            ? "    Concluído"
                            : task.status === "in_progress"
                              ? "Em Andamento"
                              : "Pendente"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="financial" className="mt-6 space-y-4">
            <BentoStatStrip
              className="animate-fade-in xl:grid-cols-3"
              items={[
                {
                  label: "Honorários mensais",
                  value: brl(client.serviceFee),
                  icon: CreditCard,
                },
                {
                  label: "Saldo estimado",
                  value: brl(Math.max(0, client.serviceFee - financialSummary.currentMonthReceived)),
                  icon: Wallet,
                },
                { label: "Faturado", value: brl(financialSummary.invoiced), icon: FileText },
                {
                  label: "Recebido",
                  value: brl(Math.max(financialSummary.received, financialSummary.paidInvoices)),
                  icon: CheckSquare,
                },
                { label: "Em aberto", value: brl(financialSummary.pending), icon: Activity },
              ]}
            />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Faturas</CardTitle>
                </CardHeader>
                <CardContent>
                  {clientInvoices.length === 0 ? (
                    <div className="py-8 text-center">
                      <p className="text-sm text-muted-foreground">
                        Nenhuma fatura vinculada a este cliente.
                      </p>
                      <Button
                        variant="outline"
                        className="mt-4 rounded-xl"
                        onClick={() => navigate("/invoices")}
                      >
                        Criar fatura
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {clientInvoices.map((invoice) => (
                        <div
                          key={invoice.id}
                          className="flex items-center justify-between p-3 rounded-xl hover:bg-accent/50 transition-colors"
                        >
                          <div>
                            <p className="text-sm font-medium">
                              {invoice.number ||
                                `Fatura ${invoice.id.slice(0, 8)}`}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Venc. {fmt(invoice.due_date)}
                            </p>
                          </div>
                          <div className="text-right">
                            <Badge
                              variant={
                                invoice.status === "paid"
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              {invoice.status === "paid"
                                ? "Paga"
                                : invoice.status === "overdue"
                                  ? "Atrasada"
                                  : "Pendente"}
                            </Badge>
                            <p className="text-sm font-semibold mt-1">
                              {brl(Number(invoice.amount))}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Pagamentos</CardTitle>
                </CardHeader>
                <CardContent>
                  {clientPayments.length === 0 ? (
                    <div className="py-8 text-center">
                      <p className="text-sm text-muted-foreground">
                        Nenhum pagamento vinculado a este cliente.
                      </p>
                      <Button
                        variant="outline"
                        className="mt-4 rounded-xl"
                        onClick={() => navigate("/payments")}
                      >
                        Registrar pagamento
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {clientPayments.map((payment) => (
                        <div
                          key={payment.id}
                          className="flex items-center justify-between p-3 rounded-xl hover:bg-accent/50 transition-colors"
                        >
                          <div>
                            <p className="text-sm font-medium">
                              {payment.description || "Pagamento sem descrição"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {payment.category || "Sem categoria"} ·{" "}
                              {fmt(
                                payment.paid_at ??
                                  payment.due_date ??
                                  payment.created_at,
                              )}
                            </p>
                          </div>
                          <div className="text-right">
                            <Badge
                              variant={
                                payment.status === "completed"
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              {payment.status === "completed"
                                ? "Concluído"
                                : "Pendente"}
                            </Badge>
                            <p className="text-sm font-semibold mt-1">
                              {payment.direction === "saida" ? "-" : "+"}
                              {brl(Number(payment.amount))}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="obligations" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Obrigações fiscais</CardTitle>
              </CardHeader>
              <CardContent>
                {clientObligations.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <ScrollText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">
                      Nenhuma obrigação fiscal cadastrada para este cliente.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {clientObligations.map((obligation) => (
                      <div
                        key={obligation.id}
                        className="flex items-center justify-between p-3 rounded-xl hover:bg-accent/50 transition-colors"
                      >
                        <div>
                          <p className="text-sm font-medium">
                            {obligation.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Venc. {fmt(obligation.due_date)} ·{" "}
                            {obligation.recurrence}
                          </p>
                        </div>
                        <Badge
                          variant={
                            obligation.status === "completed"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {obligation.status === "completed"
                            ? "Entregue"
                            : obligation.status === "in_progress"
                              ? "Em andamento"
                              : obligation.status === "overdue"
                                ? "Atrasada"
                                : "Pendente"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="messages" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Mensagens com o cliente</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Histórico de conversas com {client.name} aparecerá aqui.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activities" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle>Timeline do cliente</CardTitle>
                  <div className="filter-toolbar flex flex-wrap gap-2">
                    <Select
                      value={activityEntityFilter}
                      onValueChange={(value: ActivityEntityFilter) =>
                        setActivityEntityFilter(value)
                      }
                    >
                      <SelectTrigger className="h-9 w-[170px] rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas entidades</SelectItem>
                        <SelectItem value="document">Documentos</SelectItem>
                        <SelectItem value="task">Tarefas</SelectItem>
                        <SelectItem value="invoice">Faturas</SelectItem>
                        <SelectItem value="payment">Pagamentos</SelectItem>
                        <SelectItem value="fiscal_obligation">
                          Obrigações
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={activityPeriodFilter}
                      onValueChange={(value: ActivityPeriodFilter) =>
                        setActivityPeriodFilter(value)
                      }
                    >
                      <SelectTrigger className="h-9 w-[140px] rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todo período</SelectItem>
                        <SelectItem value="7">7 dias</SelectItem>
                        <SelectItem value="30">30 dias</SelectItem>
                        <SelectItem value="90">90 dias</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {clientTimeline.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">
                      Nenhuma movimentação registrada para este cliente ainda.
                    </p>
                  </div>
                ) : (
                  <div className="relative space-y-3">
                    {clientTimeline.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start gap-3 p-3 rounded-xl border border-border"
                      >
                        <Activity className="h-4 w-4 mt-0.5 text-muted-foreground" />
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium">{item.title}</p>
                            <Badge variant="outline" className="text-[10px]">
                              {item.badge}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {item.description} · {fmt(item.date)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default ClientDetail;
