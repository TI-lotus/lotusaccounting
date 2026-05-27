import { useState, useRef, useEffect } from "react";
import { Search, Bell, FileText, Users, MessageSquare, BarChart3, CheckSquare, Plug, X, Sparkles, CalendarClock, MailCheck, Bot, UserPlus, CreditCard, ChevronDown, Building2, User, Settings, Crown, LogOut } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { LotusLogo } from "./LotusLogo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useViewMode } from "@/contexts/ViewModeContext";
import { useUserProfile } from "@/contexts/UserProfileContext";
import { useAuth } from "@/contexts/AuthContext";

interface SearchResult {
  category: string;
  icon: React.ElementType;
  items: { label: string; href: string }[];
}

const officeSearchData: SearchResult[] = [
  {
    category: "Clientes",
    icon: Users,
    items: [
      { label: "Acme Corporation", href: "/clients" },
      { label: "TechStart Inc", href: "/clients" },
      { label: "Global Finance Ltd", href: "/clients" },
      { label: "DataFlow Systems", href: "/clients" },
      { label: "Verde Soluções", href: "/clients" },
      { label: "Nexus Tecnologia", href: "/clients" },
    ],
  },
  {
    category: "Documentos",
    icon: FileText,
    items: [
      { label: "Fatura #1234", href: "/documents" },
      { label: "Fatura #1231", href: "/documents" },
      { label: "Relatório Financeiro Q4", href: "/documents" },
      { label: "Contrato de Serviços", href: "/documents" },
    ],
  },
  {
    category: "Relatórios",
    icon: BarChart3,
    items: [
      { label: "DRE Mensal - Janeiro 2026", href: "/reports" },
      { label: "Análise de Fluxo de Caixa", href: "/reports" },
      { label: "Contas a Receber", href: "/reports" },
      { label: "Resumo Fiscal Anual", href: "/reports" },
    ],
  },
  {
    category: "Mensagens",
    icon: MessageSquare,
    items: [
      { label: "Sarah Johnson - Relatório trimestral", href: "/messages" },
      { label: "Mike Chen - Previsão orçamentária", href: "/messages" },
      { label: "Roberto Santos - Auditoria Q3", href: "/messages" },
    ],
  },
  {
    category: "Integrações",
    icon: Plug,
    items: [
      { label: "Receita Federal", href: "/integrations" },
      { label: "SERPRO", href: "/integrations" },
      { label: "NFSe Municipal", href: "/integrations" },
    ],
  },
];

const clientSearchData: SearchResult[] = [
  {
    category: "Tarefas",
    icon: CheckSquare,
    items: [
      { label: "Enviar documentos fiscais", href: "/tasks" },
      { label: "Revisar relatório mensal", href: "/tasks" },
      { label: "Aprovar fatura pendente", href: "/tasks" },
    ],
  },
  {
    category: "Documentos",
    icon: FileText,
    items: [
      { label: "Balancete Mensal", href: "/documents" },
      { label: "DAS - Janeiro", href: "/documents" },
      { label: "Nota Fiscal #892", href: "/documents" },
    ],
  },
  {
    category: "Relatórios",
    icon: BarChart3,
    items: [
      { label: "Relatório Financeiro", href: "/reports" },
      { label: "Fluxo de Caixa", href: "/reports" },
    ],
  },
  {
    category: "Mensagens",
    icon: MessageSquare,
    items: [
      { label: "Lotus Contabilidade", href: "/messages" },
      { label: "Claison Kepler", href: "/messages" },
    ],
  },
];

// AI assistant trigger keywords
const aiKeywords = ["ia", "assistente", "ajuda", "lótus ia", "lotus ia", "perguntar", "pergunta"];

interface TopBarProps {
  className?: string;
  onOpenAI?: (message?: string) => void;
}

const notificationGroups = [
  { label: "Documentos recebidos", icon: FileText, items: [{ label: "NF-e de Acme Corporation recebida", href: "/documents" }, { label: "DAS de TechStart pronto para revisão", href: "/documents" }] },
  { label: "Vencimentos", icon: CalendarClock, items: [{ label: "Guia DAS vence em 20 Abr", href: "/tasks" }, { label: "Fatura #1231 vence esta semana", href: "/payments" }] },
  { label: "Relatórios", icon: MailCheck, items: [{ label: "DRE mensal gerado para Março", href: "/reports" }] },
  { label: "Agentes", icon: Bot, items: [{ label: "Lia aguardando revisão de classificação", href: "/agents" }] },
  { label: "Pagamentos Recebidos", icon: CreditCard, items: [{ label: "Pagamento de R$ 12.500,00 conciliado", href: "/payments" }] },
  { label: "Solicitações de acesso", icon: UserPlus, items: [] },
];

export const TopBar = ({ className, onOpenAI }: TopBarProps) => {
  const [query, setQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const navigate = useNavigate();
  const { viewMode, setViewMode } = useViewMode();
  const profile = useUserProfile();
  const { signOut } = useAuth();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };

  const searchData = viewMode === "office" ? officeSearchData : clientSearchData;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isAIQuery = query.trim().startsWith("/") || aiKeywords.some(k => query.toLowerCase().includes(k));

  const filteredResults = query.trim()
    ? searchData
        .map((group) => ({
          ...group,
          items: group.items.filter((item) =>
            item.label.toLowerCase().includes(query.toLowerCase())
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
    const message = query.trim().startsWith("/") ? query.trim().slice(1).trim() : query.trim();
    setQuery("");
    setShowResults(false);
    onOpenAI?.(message || undefined);
  };

  const isDropdownVisible = showResults && query.trim().length > 0;

  return (
    <>
      {(isDropdownVisible || notificationOpen) && (
        <div
          className="search-backdrop"
          onClick={() => { setShowResults(false); setNotificationOpen(false); }}
        />
      )}
      <header
        className={cn(
          "h-16 border-b border-sidebar-border bg-sidebar text-sidebar-foreground",
          "flex items-center justify-between px-6 sticky top-0",
          isDropdownVisible ? "z-50" : "z-40",
          className
        )}
      >
        <div className="flex items-center gap-6 mr-4">
          <LotusLogo size="md" />
        </div>
        <div className="flex items-center gap-4 flex-1 max-w-md relative" ref={wrapperRef}>
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-sidebar-foreground/60" />
            <Input
              placeholder="Digite / para começar uma conversa com a Lia"
              className="pl-10 h-10 bg-sidebar-accent/60 border-sidebar-border text-sidebar-foreground placeholder:text-sidebar-foreground/50 focus-visible:ring-1 focus-visible:ring-sidebar-ring rounded-2xl"
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
                onClick={() => { setQuery(""); setShowResults(false); }}
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

                {filteredResults.length > 0 && filteredResults.map((group) => {
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
                    <button className="mt-2 text-xs text-gilver hover:underline flex items-center gap-1 mx-auto" onClick={handleAIOpen}>
                      <Sparkles className="h-3 w-3" />
                      Conversar com a Lia
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Popover open={notificationOpen} onOpenChange={setNotificationOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-xl text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground">
                <Bell className="h-4 w-4" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-96 rounded-2xl p-0 overflow-hidden z-[99999]">
              <div className="p-4 border-b border-border">
                <h3 className="font-semibold text-sm">Notificações</h3>
                <p className="text-xs text-muted-foreground">Avisos separados por área</p>
              </div>
              <div className="max-h-[420px] overflow-y-auto custom-scroll px-2 pb-2">
                <Accordion type="multiple" className="space-y-1">
                {notificationGroups.map((item) => {
                  const Icon = item.icon;
                  return (
                    <AccordionItem key={item.label} value={item.label} className="border-0">
                      <AccordionTrigger className="rounded-xl px-3 py-3 hover:bg-accent hover:no-underline">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="rounded-xl bg-muted p-2 text-muted-foreground">
                            <Icon className="h-4 w-4" />
                          </div>
                          <p className="text-sm font-medium truncate">{item.label}</p>
                          <Badge variant="secondary" className="rounded-full">{item.items.length}</Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-3 pb-3">
                        {item.items.length ? (
                          <div className="space-y-2">
                            {item.items.map((notification) => (
                              <button key={notification.label} className="w-full rounded-xl bg-muted/50 px-3 py-2 text-left text-sm transition-colors hover:bg-accent" onClick={() => { navigate(notification.href); setNotificationOpen(false); }}>
                                {notification.label}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
                </Accordion>
              </div>
            </PopoverContent>
          </Popover>
          <ThemeToggle />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl hover:bg-sidebar-accent transition-colors">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={profile.avatarUrl} />
                  <AvatarFallback className="bg-gilver text-sidebar-primary-foreground font-medium text-xs">
                    {profile.initials}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden md:block text-left leading-tight">
                  <p className="text-xs font-medium truncate max-w-[140px] text-sidebar-foreground">{profile.fullName}</p>
                  <p className="text-[10px] text-sidebar-foreground/60 truncate max-w-[140px]">{profile.email}</p>
                </div>
                <ChevronDown className="h-4 w-4 text-sidebar-foreground/70" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 z-[99999]">
              <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                Alternar Visualização
              </DropdownMenuLabel>
              <DropdownMenuRadioGroup value={viewMode} onValueChange={(v) => setViewMode(v as "office" | "client")}>
                <DropdownMenuRadioItem value="office" className="cursor-pointer">
                  <Building2 className="h-4 w-4 mr-2" />
                  Escritório
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="client" className="cursor-pointer">
                  <User className="h-4 w-4 mr-2" />
                  Cliente
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/settings")}>
                <Settings className="h-4 w-4 mr-2" />
                Configurações
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/upgrade")}>
                <Crown className="h-4 w-4 mr-2" />
                Upgrade
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
    </>
  );
};
