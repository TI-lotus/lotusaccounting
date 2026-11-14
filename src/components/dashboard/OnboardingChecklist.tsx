import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  CalendarClock,
  Check,
  CircleDot,
  FileText,
  ListChecks,
  ReceiptText,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { cn } from "@/lib/utils";

type OnboardingStep = {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: typeof Building2;
  completed: boolean;
};

const getDismissedKey = (userId: string | undefined) =>
  userId ? `lotus-onboarding-dismissed:${userId}` : null;

/**
 * Workspace onboarding based on persisted data, not demo fixtures.
 * It is intentionally limited to admins because the setup actions belong to
 * the workspace owner; collaborators and clients get their own focused views.
 */
export const OnboardingChecklist = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const {
    clients,
    clientPeriods,
    tasks,
    documents,
    documentRequests,
    invoices,
    payments,
    workspaceSettings,
  } = useData();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const key = getDismissedKey(user?.id);
    setDismissed(key ? window.localStorage.getItem(key) === "true" : false);
  }, [user?.id]);

  const steps = useMemo<OnboardingStep[]>(
    () => [
      {
        id: "workspace",
        title: "Configurar o escritório",
        description: "Revise nome, CNPJ, perfil e preferências da operação.",
        href: "/settings",
        icon: Building2,
        completed: Boolean(
          workspaceSettings?.office_name &&
            workspaceSettings.office_name !== "Lotus Accounting" &&
            workspaceSettings.cnpj,
        ),
      },
      {
        id: "client",
        title: "Cadastrar o primeiro cliente",
        description: "A carteira é a base para competências, tarefas e documentos.",
        href: "/clients",
        icon: Users,
        completed: clients.length > 0,
      },
      {
        id: "templates",
        title: "Preparar o checklist operacional",
        description: "Defina as etapas e obrigações que serão usadas no mês.",
        href: "/settings/templates",
        icon: ListChecks,
        completed: clientPeriods.length > 0,
      },
      {
        id: "period",
        title: "Abrir uma competência",
        description: "Acompanhe o ciclo mensal de cada cliente em um só lugar.",
        href: "/periods",
        icon: CalendarClock,
        completed: clientPeriods.length > 0,
      },
      {
        id: "operation",
        title: "Iniciar a operação",
        description: "Crie tarefas ou solicite documentos para começar o fluxo.",
        href: tasks.length > 0 ? "/tasks" : "/documents",
        icon: FileText,
        completed: tasks.length > 0 || documents.length > 0 || documentRequests.length > 0,
      },
      {
        id: "financial",
        title: "Registrar o financeiro interno",
        description: "Controle honorários, faturas e recebimentos manualmente.",
        href: invoices.length > 0 ? "/invoices" : "/payments",
        icon: ReceiptText,
        completed: invoices.length > 0 || payments.length > 0,
      },
    ],
    [
      clientPeriods.length,
      clients.length,
      documentRequests.length,
      documents.length,
      invoices.length,
      payments.length,
      tasks.length,
      workspaceSettings?.cnpj,
      workspaceSettings?.office_name,
    ],
  );

  if (profile?.account_type !== "admin" || dismissed) return null;

  const completedCount = steps.filter((step) => step.completed).length;
  const progress = Math.round((completedCount / steps.length) * 100);

  const dismiss = () => {
    const key = getDismissedKey(user?.id);
    if (key) window.localStorage.setItem(key, "true");
    setDismissed(true);
  };

  return (
    <section
      aria-labelledby="onboarding-title"
      className="glass animate-fade-in rounded-2xl border border-border/80 p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <CircleDot className="h-4 w-4 text-primary" aria-hidden="true" />
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Primeiros passos
            </p>
          </div>
          <h2 id="onboarding-title" className="mt-2 text-xl font-semibold tracking-tight">
            Deixe o Lotus pronto para a rotina do escritório
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            O checklist acompanha o que já foi salvo no workspace e mostra o próximo passo recomendado.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
            {completedCount}/{steps.length} concluídos · {progress}%
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full"
            aria-label="Ocultar primeiros passos"
            onClick={dismiss}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div className="mt-5 grid gap-2 md:grid-cols-2 xl:grid-cols-3" role="list">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <button
              key={step.id}
              type="button"
              role="listitem"
              className={cn(
                "group flex min-h-[104px] items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                step.completed
                  ? "border-emerald-200/80 bg-emerald-50/50 dark:border-emerald-900/70 dark:bg-emerald-950/20"
                  : "border-border bg-card/45 hover:bg-accent/40",
              )}
              onClick={() => navigate(step.href)}
            >
              <span
                className={cn(
                  "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
                  step.completed
                    ? "border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    : "border-border bg-background text-muted-foreground",
                )}
              >
                {step.completed ? (
                  <Check className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Icon className="h-4 w-4" aria-hidden="true" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{step.title}</span>
                  <ArrowRight
                    className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  {step.completed ? "Concluído" : step.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
};
