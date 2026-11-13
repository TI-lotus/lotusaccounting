import { useState, useRef, useEffect, useMemo } from "react";
import {
  Search,
  Bell,
  FileText,
  Users,
  MessageSquare,
  BarChart3,
  CheckSquare,
  Plug,
  X,
  Sparkles,
  CalendarClock,
  Bot,
  CreditCard,
  Settings,
  Crown,
  LogOut,
  Check,
  UserRound,
  Building2,
  Palette,
  ShieldCheck,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useViewMode } from "@/contexts/ViewModeContext";
import { useUserProfile } from "@/contexts/UserProfileContext";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { SettingsContent, type SettingsSection } from "@/pages/Settings";
import { useData } from "@/contexts/DataContext";
import { integrationCatalog } from "@/lib/integrationCatalog";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { getTenantSubscription, type TenantSubscription } from "@/services/commercialMvp";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface SearchResult {
  category: string;
  icon: React.ElementType;
  items: { label: string; href: string }[];
}

// AI assistant trigger keywords
const aiKeywords = [
  "ia",
  "assistente",
  "ajuda",
  "lótus ia",
  "lotus ia",
  "perguntar",
  "pergunta",
];

const lotusPlanPrices: Record<string, string> = {
  starter: "R$ 220",
  business: "R$ 450",
  enterprise: "R$ 630",
};

const settingsSections: Array<{ id: SettingsSection | "billing"; label: string; description: string; icon: React.ElementType }> = [
  { id: "profile", label: "Perfil", description: "Nome, foto e e-mail", icon: UserRound },
  { id: "organization", label: "Organização", description: "Escritório e dados fiscais", icon: Building2 },
  { id: "preferences", label: "Preferências", description: "Tema, avisos e automações", icon: Palette },
  { id: "security", label: "Segurança", description: "Senha e autenticação", icon: ShieldCheck },
  { id: "billing", label: "Plano e cobrança", description: "Plano atual e assinatura", icon: CreditCard },
];

interface TopBarProps {
  className?: string;
  onOpenAI?: (message?: string) => void;
}

interface NotificationItem {
  id: string;
  label: string;
  href: string;
  category: string;
  categoryLabel: string;
  icon: React.ElementType;
  createdAt: number; // unix ms
  read: boolean;
  persistent?: boolean;
}

type UserNotificationRow = Database["public"]["Tables"]["user_notifications"]["Row"];

type PersistentNotificationMeta = {
  categoryLabel: string;
  icon: React.ElementType;
  href?: string;
};

const persistentNotificationMeta = (kind: string): PersistentNotificationMeta => {
  const map: Record<
    string,
    PersistentNotificationMeta
  > = {
    message: { categoryLabel: "Mensagens", icon: MessageSquare, href: "/messages" },
    document_request_overdue: { categoryLabel: "Documentos", icon: FileText, href: "/documents" },
    document_request_uploaded: { categoryLabel: "Documentos", icon: FileText, href: "/documents" },
    document_request_rejected: { categoryLabel: "Documentos", icon: FileText, href: "/documents" },
    fiscal_obligation_due: { categoryLabel: "Vencimentos", icon: CalendarClock, href: "/reports" },
    task_overdue: { categoryLabel: "Tarefas", icon: CheckSquare, href: "/work-queue" },
    task_review_rejected: { categoryLabel: "Revisões", icon: CheckSquare, href: "/work-queue" },
    client_period_blocked: { categoryLabel: "Ciclo mensal", icon: CalendarClock, href: "/periods" },
    client_period_stale: { categoryLabel: "Ciclo mensal", icon: CalendarClock, href: "/periods" },
    invoice_overdue: { categoryLabel: "Faturas", icon: CreditCard, href: "/invoices" },
  };
  return map[kind] ?? { categoryLabel: "Sistema", icon: Bell };
};

export const TopBar = ({ className, onOpenAI }: TopBarProps) => {
  const [query, setQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSection | "billing">("profile");
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [subscription, setSubscription] = useState<TenantSubscription | null>(null);
  const navigate = useNavigate();
  const { viewMode, role, isCollapsed, setIsCollapsed } = useViewMode();
  const { theme } = useTheme();
  const profile = useUserProfile();
  const { signOut, user, profile: authProfile } = useAuth();
  const {
    clients,
    documents,
    tasks,
    invoices,
    payments,
    notifications: dataNotifications,
    workspaceSettings,
  } = useData();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const organizationName = useMemo(() => {
    if (role === "client") {
      return clients.find((client) => client.id === authProfile?.company_id)?.name ?? "Minha empresa";
    }
    return workspaceSettings?.office_name || profile.companyName || "Meu escritório";
  }, [authProfile?.company_id, clients, profile.companyName, role, workspaceSettings?.office_name]);
  const [readNotificationIds, setReadNotificationIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [persistentNotifications, setPersistentNotifications] = useState<UserNotificationRow[]>([]);

  const handleSignOut = async () => {
    setProfileMenuOpen(false);
    await signOut();
    navigate("/auth?logged_out=1", { replace: true });
  };

  useEffect(() => {
    if (!user) {
      setPersistentNotifications([]);
      return;
    }

    const loadPersistentNotifications = async () => {
      const { data } = await supabase
        .from("user_notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      setPersistentNotifications((data ?? []) as UserNotificationRow[]);
    };
    void loadPersistentNotifications();

    const channel = supabase
      .channel(`inbox:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setPersistentNotifications((current) => current.filter((item) => item.id !== payload.old.id));
            return;
          }
          setPersistentNotifications((current) => [payload.new as UserNotificationRow, ...current.filter((item) => item.id !== payload.new.id)]
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 20));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user]);

  const markNotificationRead = (notification: NotificationItem) => {
    setReadNotificationIds((current) => new Set(current).add(notification.id));
    if (notification.persistent) {
      setPersistentNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item));
      void supabase.from("user_notifications").update({ read_at: new Date().toISOString() }).eq("id", notification.id);
    }
  };

  const searchData = useMemo<SearchResult[]>(() => {
    const groups: SearchResult[] = [
      {
        category: "Tarefas",
        icon: CheckSquare,
        items: tasks.slice(0, 8).map((task) => ({
          label: task.title,
          href: "/tasks",
        })),
      },
      {
        category: "Documentos",
        icon: FileText,
        items: documents.slice(0, 8).map((document) => ({
          label: document.name,
          href: "/documents",
        })),
      },
      {
        category: "Relatórios",
        icon: BarChart3,
        items: [
          { label: "Relatórios financeiros", href: "/reports" },
          { label: "Resumo fiscal", href: "/reports" },
          { label: "Agenda de vencimentos", href: "/agenda" },
        ],
      },
      {
        category: "Mensagens",
        icon: MessageSquare,
        items: [{ label: "Mensagens do workspace", href: "/messages" }],
      },
    ];

    if (viewMode === "office") {
      groups.unshift({
        category: "Clientes",
        icon: Users,
        items: clients.slice(0, 8).map((client) => ({
          label: client.name,
          href: `/clients/${client.id}`,
        })),
      });
      groups.push({
        category: "Integrações",
        icon: Plug,
        items: integrationCatalog.slice(0, 8).map((integration) => ({
          label: integration.name,
          href: `/integrations/${integration.id}`,
        })),
      });
    }

    return groups.filter((group) => group.items.length > 0);
  }, [clients, documents, tasks, viewMode]);

  const notifications = useMemo<NotificationItem[]>(() => {
    const now = Date.now();
    const dueSoon = (value?: string | null) => {
      if (!value) return false;
      const time = new Date(value).getTime();
      return time >= now && time <= now + 1000 * 60 * 60 * 24 * 7;
    };
    const items: NotificationItem[] = [
      ...persistentNotifications.map((notification) => {
        const meta = persistentNotificationMeta(notification.kind);
        return {
          id: notification.id,
          label: notification.title,
          href: notification.href || meta.href || "/",
          category: notification.kind,
          categoryLabel: meta.categoryLabel,
          icon: meta.icon,
          createdAt: new Date(notification.created_at).getTime(),
          read: !!notification.read_at,
          persistent: true,
        };
      }),
      ...dataNotifications.map((notification) => ({
        id: `ctx-${notification.id}`,
        label: notification.title,
        href:
          notification.relatedEntityType === "task"
            ? "/tasks"
            : notification.relatedEntityType === "document"
              ? "/documents"
              : "/clients",
        category: notification.channel,
        categoryLabel: "Sistema",
        icon: Bell,
        createdAt: new Date(notification.createdAt).getTime(),
        read:
          notification.read ||
          readNotificationIds.has(`ctx-${notification.id}`),
      })),
      ...invoices
        .filter(
          (invoice) =>
            invoice.status !== "overdue" && dueSoon(invoice.due_date),
        )
        .slice(0, 4)
        .map((invoice) => ({
          id: `invoice-${invoice.id}`,
          label: `${invoice.status === "overdue" ? "Fatura vencida" : "Fatura próxima do vencimento"}: ${invoice.number ?? invoice.id.slice(0, 8)}`,
          href: "/invoices",
          category: "payments",
          categoryLabel: "Faturas",
          icon: CreditCard,
          createdAt: new Date(
            invoice.due_date ?? invoice.created_at ?? now,
          ).getTime(),
          read: readNotificationIds.has(`invoice-${invoice.id}`),
        })),
      ...payments
        .filter(
          (payment) =>
            payment.status === "pending" && dueSoon(payment.due_date),
        )
        .slice(0, 4)
        .map((payment) => ({
          id: `payment-${payment.id}`,
          label: `Pagamento próximo do vencimento: ${payment.description ?? payment.id.slice(0, 8)}`,
          href: "/payments",
          category: "payments",
          categoryLabel: "Pagamentos",
          icon: CreditCard,
          createdAt: new Date(
            payment.due_date ?? payment.created_at ?? now,
          ).getTime(),
          read: readNotificationIds.has(`payment-${payment.id}`),
        })),
      ...documents
        .filter(
          (document) => document.status === "unread" || !document.clientId,
        )
        .slice(0, 4)
        .map((document) => ({
          id: `document-${document.id}`,
          label: `${document.clientId ? "Documento não lido" : "Documento sem cliente"}: ${document.name}`,
          href: "/documents",
          category: "documents",
          categoryLabel: "Documentos",
          icon: FileText,
          createdAt: new Date(document.createdAt).getTime(),
          read: readNotificationIds.has(`document-${document.id}`),
        })),
    ];
    return items
      .filter((item) => Number.isFinite(item.createdAt))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 20);
  }, [
    dataNotifications,
    documents,
    invoices,
    payments,
    persistentNotifications,
    readNotificationIds,
  ]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const formatRelative = (ts: number) => {
    const diff = Date.now() - ts;
    const m = Math.round(diff / 60000);
    if (m < 60) return `${m} min`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h}h`;
    return `${Math.round(h / 24)}d`;
  };

  useEffect(() => {
    const handleSearchShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        const input = wrapperRef.current?.querySelector("input");
        input?.focus();
        setShowResults(true);
      }
    };
    window.addEventListener("keydown", handleSearchShortcut);
    return () => window.removeEventListener("keydown", handleSearchShortcut);
  }, [query]);

  useEffect(() => {
    if (settingsOpen || upgradeOpen) setProfileMenuOpen(false);
  }, [settingsOpen, upgradeOpen]);

  useEffect(() => {
    if (!upgradeOpen) return;
    void getTenantSubscription()
      .then(setSubscription)
      .catch(() => setSubscription(null));
  }, [upgradeOpen]);

  const isAIQuery =
    query.trim().startsWith("/") ||
    aiKeywords.some((k) => query.toLowerCase().includes(k));

  const filteredResults = query.trim()
    ? searchData
        .map((group) => ({
          ...group,
          items: group.items.filter((item) =>
            item.label.toLowerCase().includes(query.toLowerCase()),
          ),
        }))
        .filter((group) => group.items.length > 0)
    : [];
  const searchEntries = filteredResults.flatMap((group) => group.items);
  const searchEntryCount = searchEntries.length + (isAIQuery ? 1 : 0);

  const handleSelect = (href: string) => {
    navigate(href);
    setQuery("");
    setActiveSearchIndex(0);
    setShowResults(false);
  };

  const handleAIOpen = () => {
    const message = query.trim().startsWith("/")
      ? query.trim().slice(1).trim()
      : query.trim();
    setQuery("");
    setActiveSearchIndex(0);
    setShowResults(false);
    onOpenAI?.(message || undefined);
  };

  const isDropdownVisible = showResults;
  return (
    <>
      <header
        data-theme={theme}
        className={cn(
          "topbar-shell h-12 transition-[background-color,border-color,margin] duration-300 lg:h-14",
          "flex items-center justify-between px-2.5 md:px-6 gap-2 md:gap-5 sticky top-0 lg:transition-[margin] lg:duration-300",
          isCollapsed ? "lg:ml-[3.75rem]" : "lg:ml-64",
          "isolate border-b backdrop-blur-[28px] backdrop-saturate-150",
          isDropdownVisible ? "z-50" : "z-40",
          className,
        )}
      >
        <div className="flex min-w-0 shrink-0 items-center gap-2">
          <button
            type="button"
            aria-label={isCollapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
            title={isCollapsed ? "Expandir menu" : "Recolher menu"}
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={cn(
              "rounded-full p-2 transition-[background-color,color]",
              theme === "dark" ? "text-white/60 hover:bg-white/10 hover:text-white" : "text-muted-foreground hover:bg-black/5 hover:text-foreground",
            )}
          >
            {isCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>
        <div
          className="topbar-search relative mx-auto flex w-full max-w-[440px] flex-1 items-center gap-2 md:gap-4"
          ref={wrapperRef}
        >
          <Popover open={showResults} onOpenChange={setShowResults}>
            <PopoverAnchor asChild>
              <div className={cn("topbar-search-field", showResults && "is-open")}>
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                <Input
                  placeholder="Busque clientes, tarefas ou use / para conversar…"
                  className={cn(
                    "topbar-search-input h-auto min-w-0 flex-1 rounded-none border-0 bg-transparent p-0 text-xs shadow-none focus-visible:border-transparent focus-visible:ring-0 md:text-xs",
                    theme === "dark"
                      ? "text-white placeholder:text-white/50"
                      : "text-foreground placeholder:text-muted-foreground",
                  )}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActiveSearchIndex(0);
                    setShowResults(true);
                  }}
                  onFocus={() => setShowResults(true)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                      e.preventDefault();
                      if (!searchEntryCount) return;
                      setShowResults(true);
                      setActiveSearchIndex((current) =>
                        (current + (e.key === "ArrowDown" ? 1 : -1) + searchEntryCount) % searchEntryCount,
                      );
                      return;
                    }
                    if (e.key === "Enter" && (query.trim().startsWith("/") || isAIQuery && activeSearchIndex === 0)) {
                      e.preventDefault();
                      handleAIOpen();
                      return;
                    }
                    if (e.key === "Enter" && searchEntryCount > 0) {
                      e.preventDefault();
                      const resultIndex = activeSearchIndex - (isAIQuery ? 1 : 0);
                      const result = searchEntries[resultIndex];
                      if (result) handleSelect(result.href);
                    }
                  }}
                />
                {!query && (
                  <span className={cn(
                    "pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border px-1.5 py-0.5 text-[10px] sm:block",
                    theme === "dark" ? "border-white/15 text-white/45" : "border-black/10 text-muted-foreground",
                  )}>
                    Ctrl K
                  </span>
                )}
                {query && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setShowResults(false);
                    }}
                    aria-label="Limpar busca"
                    title="Limpar busca"
                    className="topbar-search-clear text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </PopoverAnchor>
            {isDropdownVisible && (
              <PopoverContent
                align="center"
                side="bottom"
                sideOffset={10}
                collisionPadding={16}
                className="global-search-dropdown judex-floating z-[99999] w-auto max-h-[420px] overflow-hidden p-0"
                onOpenAutoFocus={(event) => event.preventDefault()}
                onCloseAutoFocus={(event) => event.preventDefault()}
              >
                <div className="search-dropdown-label">
                  {isAIQuery ? "NOVA CONVERSA" : "RESULTADOS DA BUSCA"}
                </div>
                <div className="command-results custom-scroll">
                  {isAIQuery && (
                    <button
                      type="button"
                      aria-selected={activeSearchIndex === 0}
                      className={cn("search-chat-option", activeSearchIndex === 0 && "is-selected")}
                      onClick={handleAIOpen}
                    >
                      <div className="p-1.5 rounded-lg bg-gilver/15 text-gilver">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <span>
                        <strong className="font-medium">Conversar com a Lia</strong>
                        <small>"{query}"</small>
                      </span>
                      <span className="ml-auto text-muted-foreground">↵</span>
                    </button>
                  )}

                  {filteredResults.length > 0 &&
                    filteredResults.map((group) => {
                      const Icon = group.icon;
                      return (
                        <div key={group.category}>
                          <div className="search-category-label flex items-center gap-2">
                            <Icon className="h-3.5 w-3.5" />
                            {group.category}
                          </div>
                          {group.items.map((item, itemIndex) => {
                            const resultIndex = (isAIQuery ? 1 : 0) + filteredResults.slice(0, filteredResults.indexOf(group)).reduce((total, current) => total + current.items.length, 0) + itemIndex;
                            return (
                              <button
                                type="button"
                                key={item.label}
                                aria-selected={activeSearchIndex === resultIndex}
                                className={cn("search-record-option", activeSearchIndex === resultIndex && "is-selected")}
                                onMouseEnter={() => setActiveSearchIndex(resultIndex)}
                                onClick={() => handleSelect(item.href)}
                              >
                                <span>
                                  {item.label}
                                  <small>{group.category}</small>
                                </span>
                                <span className="ml-auto text-muted-foreground">↵</span>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}

                  {filteredResults.length === 0 && !isAIQuery && (
                    <div className="empty-search">
                      <p>{query.trim() ? `Nenhum resultado encontrado para "${query}". Tente outro termo.` : "Digite para encontrar documentos, clientes, casos, processos, contratos, referências jurídicas e agentes."}</p>
                    </div>
                  )}
                </div>
                <div className="search-dropdown-footer">
                  <span><kbd>↑</kbd><kbd>↓</kbd> selecionar <kbd>↵</kbd> prévia</span>
                  <span><kbd>/</kbd> conversar</span>
                </div>
              </PopoverContent>
            )}
          </Popover>
        </div>
        <div className="flex items-center gap-1 md:gap-2 shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Mensagens"
                title="Mensagens"
                className={cn("h-8 w-8 rounded-full border-0", theme === "dark" ? "text-white hover:bg-white/15 hover:text-white" : "text-foreground hover:bg-black/5")}
                onClick={() => navigate("/messages")}
              >
                <MessageSquare className="h-4 w-4" aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={8} className="judex-floating sidebar-tooltip">Mensagens</TooltipContent>
          </Tooltip>
          <Popover open={notificationOpen} onOpenChange={setNotificationOpen}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Notificações"
                    title="Notificações"
                    className={cn("relative h-8 w-8 rounded-full border-0", theme === "dark" ? "text-white hover:bg-white/15 hover:text-white" : "text-foreground hover:bg-black/5")}
                  >
                    <Bell className="h-4 w-4" aria-hidden="true" />
                    {unreadCount > 0 && (
                      <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
                    )}
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={8} className="judex-floating sidebar-tooltip">Notificações</TooltipContent>
            </Tooltip>
            <PopoverContent
              align="end"
              className="legal-notifications judex-floating z-[99999] w-[400px] overflow-hidden p-0"
            >
              <header>
                <div>
                  <h2>Notificações</h2>
                  <span>
                    {unreadCount} pendentes
                  </span>
                </div>
              </header>
              <div className="legal-notifications-body custom-scroll">
                {notifications.length === 0 && (
                  <div className="notifications-empty">
                    <Bell />
                    <strong>Tudo em dia.</strong>
                    <p>Novos lembretes aparecerão conforme as datas e preferências cadastradas.</p>
                  </div>
                )}
                {notifications.map((n) => {
                  const Icon = n.icon;
                  return (
                    <button
                      key={n.id}
                      onClick={() => {
                        markNotificationRead(n);
                        navigate(n.href);
                        setNotificationOpen(false);
                      }}
                       className={cn("legal-notification-item", !n.read && "is-unread")}
                    >
                      <div className="rounded-xl bg-muted p-2 text-muted-foreground shrink-0">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            "text-sm leading-snug",
                            !n.read && "font-medium",
                          )}
                        >
                          {n.label}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge
                            variant="outline"
                            className="text-[10px] py-0 px-1.5 rounded-md"
                          >
                            {n.categoryLabel}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {formatRelative(n.createdAt)} atrás
                          </span>
                        </div>
                      </div>
                      {!n.read && (
                        <span className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
              <footer>
                <button type="button" onClick={() => { setNotificationOpen(false); navigate("/notifications"); }}>
                  Abrir central de notificações <span aria-hidden="true">↗</span>
                </button>
                <span>Lembretes na plataforma · atualização a cada 30 segundos</span>
              </footer>
            </PopoverContent>
          </Popover>
          <ThemeToggle className={theme === "dark" ? "text-white hover:bg-white/15 hover:text-white" : "text-foreground hover:bg-black/5"} />

          <DropdownMenu open={profileMenuOpen} onOpenChange={setProfileMenuOpen}>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="Menu do usuário"
                title={profile.fullName || profile.email || "Usuário"}
                className={cn("rounded-full p-0.5 transition-colors", theme === "dark" ? "hover:bg-white/15" : "hover:bg-black/5")}
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={profile.avatarUrl} />
                  <AvatarFallback className="bg-gilver text-white font-medium text-xs">
                    {profile.initials}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={12} className="account-dropdown z-[99999]">
              <DropdownMenuLabel className="account-identity">
                <strong>{profile.fullName || profile.email || "Usuário"}</strong>
                <span>{organizationName}</span>
                <small>
                  {role === "client" ? "Portal do cliente" : role === "collaborator" ? "Colaborador" : "Administrador"}
                </small>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setProfileMenuOpen(false);
                  setSettingsOpen(true);
                }}
              >
                <Settings className="h-4 w-4 mr-2" />
                Configurações
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setProfileMenuOpen(false);
                  setUpgradeOpen(true);
                }}
              >
                <Crown className="h-4 w-4 mr-2" />
                Upgrade
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={handleSignOut}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="dialog-window account-settings-dialog">
          <DialogHeader className="dialog-header">
            <DialogTitle>Configurações</DialogTitle>
            <DialogDescription>Seu espaço, do seu jeito.</DialogDescription>
          </DialogHeader>
          <div className="dialog-body account-settings-body settings-modal-body">
            <div className="settings-modal-layout">
              <nav className="settings-modal-nav" aria-label="Seções das configurações">
                {settingsSections.map((item) => {
                  const Icon = item.icon;
                  const active = settingsSection === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSettingsSection(item.id)}
                      className={cn("settings-modal-nav-item", active && "is-active")}
                      aria-current={active ? "page" : undefined}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="min-w-0 text-left">
                        <strong>{item.label}</strong>
                        <small>{item.description}</small>
                      </span>
                    </button>
                  );
                })}
              </nav>
              <div className="settings-modal-content custom-scroll">
                {settingsSection === "billing" ? (
                  <div className="space-y-5">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Plano e cobrança</p>
                      <h3 className="mt-2 text-xl font-medium tracking-tight">Sua assinatura Lotus</h3>
                      <p className="mt-1 text-sm text-muted-foreground">Veja o plano ativo e escolha a estrutura certa para o seu escritório.</p>
                    </div>
                    <div className="rounded-2xl border border-border bg-card p-5">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Plano atual</p>
                          <p className="mt-2 text-2xl font-medium capitalize">{subscription?.plan_id || "Nenhum plano ativo"}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{subscription?.plan_id ? `${lotusPlanPrices[subscription.plan_id]}/mês · ${subscription.status === "active" ? "Assinatura ativa" : "Configuração comercial"}` : "Escolha um plano para ativar a cobrança."}</p>
                        </div>
                        <Button onClick={() => { setSettingsOpen(false); setUpgradeOpen(true); }}>Ver planos</Button>
                      </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {Object.entries(lotusPlanPrices).map(([id, price]) => {
                        const selected = subscription?.plan_id === id;
                        return (
                          <div key={id} className={cn("rounded-xl border p-3", selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card")}>
                            <p className="text-sm font-medium capitalize">{id}</p>
                            <p className={cn("mt-1 text-xs", selected ? "text-primary-foreground/75" : "text-muted-foreground")}>{price}/mês</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <SettingsContent showHeader={false} section={settingsSection} />
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="dialog-footer">
            <span className="settings-saved">Preferências salvas automaticamente</span>
            <Button onClick={() => setSettingsOpen(false)}>Concluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={upgradeOpen} onOpenChange={setUpgradeOpen}>
        <DialogContent className="dialog-window account-upgrade-dialog">
          <DialogHeader className="dialog-header">
              <DialogTitle>Escolha o próximo nível da Lotus</DialogTitle>
              <DialogDescription>Planos pensados para acompanhar o crescimento do seu escritório.</DialogDescription>
          </DialogHeader>
          <div className="dialog-body custom-scroll">
            <div className="judex-plans">
            {[
              { id: "starter", name: "Starter", description: "Para organizar a rotina essencial.", features: ["Clientes e equipe", "Tarefas e documentos", "Relatórios básicos"] },
              { id: "business", name: "Business", description: "Para operar com mais automação.", features: ["Tudo do Starter", "Integrações externas", "Mais limites e controles"], featured: true },
              { id: "enterprise", name: "Enterprise", description: "Para escritórios com operação ampliada.", features: ["Tudo do Business", "Suporte dedicado", "Condições personalizadas"] },
            ].map((plan) => (
              (() => {
                const current = subscription?.plan_id === plan.id;
                return <article key={plan.name} className={cn("judex-plan", plan.featured && "featured", current && "current !border-primary !bg-primary !text-primary-foreground")}>
                <span className="plan-eyebrow">{current ? "LOTUS · PLANO ATUAL" : plan.featured ? "LOTUS · MAIS POSSIBILIDADES" : "LOTUS"}</span>
                <h3>{plan.name}</h3>
                <p className={cn(current && "!text-primary-foreground/80")}>{plan.description}</p>
                <strong className="plan-price">{lotusPlanPrices[plan.id]}</strong>
                <small className={cn(current && "!text-primary-foreground/70")}>por mês</small>
                <div className="plan-features-label">Recursos previstos</div>
                <ul>
                  {plan.features.map((feature) => (
                    <li key={feature}><Check className="h-3.5 w-3.5" />{feature}</li>
                  ))}
                </ul>
                <Button
                  variant={current || plan.featured ? "default" : "outline"}
                  disabled={current}
                  className={cn("w-full", (current || plan.featured) && "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-100", current && "!bg-primary-foreground !text-primary")}
                  onClick={() => {
                    setUpgradeOpen(false);
                    navigate("/upgrade");
                  }}
                >
                  {current ? "Plano atual" : "Ver detalhes"}
                </Button>
              </article>;
              })()
            ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
