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
  ChevronDown,
  Building2,
  User,
  Settings,
  Crown,
  LogOut,
} from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { LotusLogo } from "./LotusLogo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
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
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useViewMode } from "@/contexts/ViewModeContext";
import { useUserProfile } from "@/contexts/UserProfileContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SettingsContent } from "@/pages/Settings";
import { useData } from "@/contexts/DataContext";
import { integrationCatalog } from "@/lib/integrationCatalog";

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
}

export const TopBar = ({ className, onOpenAI }: TopBarProps) => {
  const [query, setQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();
  const { viewMode, setViewMode, canSwitchViewMode, role } = useViewMode();
  const profile = useUserProfile();
  const { signOut } = useAuth();
  const {
    clients,
    documents,
    tasks,
    invoices,
    payments,
    fiscalObligations,
    notifications: dataNotifications,
  } = useData();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [readNotificationIds, setReadNotificationIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [notifSort, setNotifSort] = useState<"newest" | "oldest">("newest");
  const [notifCategory, setNotifCategory] = useState<string>("all");
  const [notifRead, setNotifRead] = useState<"all" | "unread" | "read">("all");

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth", { replace: true });
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
    const overdue = (value?: string | null) =>
      !!value && new Date(value).getTime() < now;
    const items: NotificationItem[] = [
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
      ...tasks
        .filter((task) => task.status === "overdue")
        .slice(0, 4)
        .map((task) => ({
          id: `task-${task.id}`,
          label: `Tarefa atrasada: ${task.title}`,
          href: "/tasks",
          category: "due",
          categoryLabel: "Vencimentos",
          icon: CheckSquare,
          createdAt: new Date(task.dueDate).getTime(),
          read: readNotificationIds.has(`task-${task.id}`),
        })),
      ...invoices
        .filter(
          (invoice) =>
            invoice.status === "overdue" || dueSoon(invoice.due_date),
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
      ...fiscalObligations
        .filter(
          (obligation) =>
            obligation.status !== "completed" && overdue(obligation.due_date),
        )
        .slice(0, 4)
        .map((obligation) => ({
          id: `obligation-${obligation.id}`,
          label: `Obrigação fiscal vencida: ${obligation.name}`,
          href: "/reports",
          category: "due",
          categoryLabel: "Vencimentos",
          icon: CalendarClock,
          createdAt: new Date(`${obligation.due_date}T00:00:00`).getTime(),
          read: readNotificationIds.has(`obligation-${obligation.id}`),
        })),
    ];
    return items
      .filter((item) => Number.isFinite(item.createdAt))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 20);
  }, [
    dataNotifications,
    documents,
    fiscalObligations,
    invoices,
    payments,
    readNotificationIds,
    tasks,
  ]);

  const categories = Array.from(
    new Map(notifications.map((n) => [n.category, n.categoryLabel])).entries(),
  );
  const filteredNotifications = notifications
    .filter((n) => notifCategory === "all" || n.category === notifCategory)
    .filter(
      (n) => notifRead === "all" || (notifRead === "unread" ? !n.read : n.read),
    )
    .sort((a, b) =>
      notifSort === "newest"
        ? b.createdAt - a.createdAt
        : a.createdAt - b.createdAt,
    );
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
    const handleScroll = () => setScrolled(window.scrollY > 24);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  const handleSelect = (href: string) => {
    navigate(href);
    setQuery("");
    setShowResults(false);
  };

  const handleAIOpen = () => {
    const message = query.trim().startsWith("/")
      ? query.trim().slice(1).trim()
      : query.trim();
    setQuery("");
    setShowResults(false);
    onOpenAI?.(message || undefined);
  };

  const isDropdownVisible = showResults && query.trim().length > 0;
  const dense =
    scrolled || isDropdownVisible || notificationOpen || settingsOpen;

  return (
    <>
      {(isDropdownVisible || notificationOpen) && (
        <div
          className="search-backdrop"
          onClick={() => {
            setShowResults(false);
            setNotificationOpen(false);
          }}
        />
      )}
      <header
        className={cn(
          "h-16 text-white transition-all duration-500",
          "flex items-center justify-between px-3 md:px-6 gap-2 md:gap-4 sticky top-0",
          dense
            ? "border-b border-white/10 bg-black/55 shadow-[0_18px_50px_rgba(0,0,0,0.18)] backdrop-blur-[22px] backdrop-saturate-150"
            : "border-b border-white/5 bg-black/20 backdrop-blur-md backdrop-saturate-150",
          isDropdownVisible ? "z-50" : "z-40",
          className,
        )}
      >
        <div className="flex items-center shrink-0">
          <LotusLogo size="lg" />
        </div>
        <div
          className="flex items-center gap-2 md:gap-4 flex-1 max-w-md relative"
          ref={wrapperRef}
        >
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60" />
            <Input
              placeholder="Digite / para começar uma conversa com a Lia"
              className="pl-10 h-10 rounded-2xl border-white/15 bg-white/10 text-white placeholder:text-white/50 backdrop-blur-md focus-visible:ring-1 focus-visible:ring-gilver"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowResults(true);
              }}
              onFocus={() => query.trim() && setShowResults(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && query.trim().startsWith("/")) {
                  e.preventDefault();
                  handleAIOpen();
                }
              }}
            />
            {query && (
              <button
                onClick={() => {
                  setQuery("");
                  setShowResults(false);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}

            {isDropdownVisible && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-popover border border-border rounded-xl shadow-lg overflow-hidden z-[99999] max-h-[400px] overflow-y-auto custom-scroll">
                {/* AI suggestion */}
                {isAIQuery && (
                  <button
                    className="w-full text-left px-4 py-3 text-sm hover:bg-accent transition-colors flex items-center gap-3 border-b border-border"
                    onClick={handleAIOpen}
                  >
                    <div className="p-1.5 rounded-lg bg-gilver/15 text-gilver">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium">Conversar com a Lia</p>
                      <p className="text-xs text-muted-foreground">"{query}"</p>
                    </div>
                  </button>
                )}

                {filteredResults.length > 0 &&
                  filteredResults.map((group) => {
                    const Icon = group.icon;
                    return (
                      <div key={group.category}>
                        <div className="px-3 py-2 text-xs font-semibold text-muted-foreground bg-muted/50 flex items-center gap-2">
                          <Icon className="h-3.5 w-3.5" />
                          {group.category}
                        </div>
                        {group.items.map((item) => (
                          <button
                            key={item.label}
                            className="w-full text-left px-4 py-2.5 text-sm hover:bg-accent transition-colors"
                            onClick={() => handleSelect(item.href)}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    );
                  })}

                {filteredResults.length === 0 && !isAIQuery && (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    <p>Nenhum resultado encontrado para "{query}"</p>
                    <button
                      className="mt-2 text-xs text-gilver hover:underline flex items-center gap-1 mx-auto"
                      onClick={handleAIOpen}
                    >
                      <Sparkles className="h-3 w-3" />
                      Conversar com a Lia
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 md:gap-2 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-xl text-white hover:bg-white/15 hover:text-white"
            onClick={() => navigate("/messages")}
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
          <Popover open={notificationOpen} onOpenChange={setNotificationOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative h-9 w-9 rounded-xl text-white hover:bg-white/15 hover:text-white"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full" />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-[400px] rounded-2xl p-0 overflow-hidden z-[99999]"
            >
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-sm">Notificações</h3>
                  <p className="text-xs text-muted-foreground">
                    {unreadCount} não lidas
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs rounded-lg"
                  onClick={() =>
                    setReadNotificationIds(
                      new Set(notifications.map((n) => n.id)),
                    )
                  }
                >
                  Marcar todas
                </Button>
              </div>
              <div className="p-3 border-b border-border flex flex-wrap gap-2">
                <select
                  value={notifSort}
                  onChange={(e) =>
                    setNotifSort(e.target.value as "newest" | "oldest")
                  }
                  className="text-xs rounded-lg border border-border bg-background px-2 py-1"
                >
                  <option value="newest">Mais recentes</option>
                  <option value="oldest">Mais antigas</option>
                </select>
                <select
                  value={notifCategory}
                  onChange={(e) => setNotifCategory(e.target.value)}
                  className="text-xs rounded-lg border border-border bg-background px-2 py-1"
                >
                  <option value="all">Todas categorias</option>
                  {categories.map(([cat, label]) => (
                    <option key={cat} value={cat}>
                      {label}
                    </option>
                  ))}
                </select>
                <select
                  value={notifRead}
                  onChange={(e) =>
                    setNotifRead(e.target.value as "all" | "unread" | "read")
                  }
                  className="text-xs rounded-lg border border-border bg-background px-2 py-1"
                >
                  <option value="all">Todas</option>
                  <option value="unread">Não lidas</option>
                  <option value="read">Lidas</option>
                </select>
              </div>
              <div className="max-h-[420px] overflow-y-auto custom-scroll divide-y divide-border">
                {filteredNotifications.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-8">
                    Nenhuma notificação
                  </p>
                )}
                {filteredNotifications.map((n) => {
                  const Icon = n.icon;
                  return (
                    <button
                      key={n.id}
                      onClick={() => {
                        setReadNotificationIds((prev) =>
                          new Set(prev).add(n.id),
                        );
                        navigate(n.href);
                        setNotificationOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-accent transition-colors",
                        !n.read && "bg-primary/5",
                      )}
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
            </PopoverContent>
          </Popover>
          <ThemeToggle className="text-white hover:bg-white/15 hover:text-white" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl text-white transition-colors hover:bg-white/15">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={profile.avatarUrl} />
                  <AvatarFallback className="bg-gilver text-white font-medium text-xs">
                    {profile.initials}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden md:block text-left leading-tight">
                  <p className="text-xs font-medium truncate max-w-[140px] text-white">
                    {profile.fullName || profile.email || "Usuário"}
                  </p>
                  <p className="text-[10px] text-white/60 truncate max-w-[140px]">
                    {profile.email}
                  </p>
                </div>
                <ChevronDown className="h-4 w-4 text-white/70" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 z-[99999]">
              <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                {canSwitchViewMode ? "Alternar Visualização" : "Perfil"}
              </DropdownMenuLabel>
              {canSwitchViewMode ? (
                <DropdownMenuRadioGroup
                  value={viewMode}
                  onValueChange={(v) => setViewMode(v as "office" | "client")}
                >
                  <DropdownMenuRadioItem
                    value="office"
                    className="cursor-pointer"
                  >
                    <Building2 className="h-4 w-4 mr-2" />
                    Escritório
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem
                    value="client"
                    className="cursor-pointer"
                  >
                    <User className="h-4 w-4 mr-2" />
                    Cliente
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              ) : (
                <DropdownMenuItem disabled>
                  <User className="h-4 w-4 mr-2" />
                  {role === "client" ? "Cliente" : "Carregando perfil"}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setSettingsOpen(true);
                }}
              >
                <Settings className="h-4 w-4 mr-2" />
                Configurações
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/upgrade")}>
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
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto custom-scroll rounded-2xl">
          <DialogHeader>
            <DialogTitle>Configurações</DialogTitle>
          </DialogHeader>
          <SettingsContent showHeader={false} />
        </DialogContent>
      </Dialog>
    </>
  );
};
