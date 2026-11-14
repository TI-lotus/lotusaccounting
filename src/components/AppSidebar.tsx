import { useEffect, useMemo, useState, type ReactElement } from "react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import {
  Home,
  LayoutDashboard,
  Users,
  UserCog,
  CheckSquare,
  ListTodo,
  Calendar,
  CalendarClock,
  FileText,
  Wallet,
  CreditCard,
  Receipt,
  Scale,
  TrendingUp,
  Bot,
  Sparkles,
  Workflow,
  Plug,
  BarChart3,
  Settings,
  ChevronDown,
  SlidersHorizontal,
  CircleHelp,
  ArrowUpRight,
  LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useViewMode } from "@/contexts/ViewModeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspacePermission } from "@/hooks/useWorkspacePermission";
import { LotusLogo } from "@/components/LotusLogo";
import { WorkspaceSwitcher } from "@/components/WorkspaceSwitcher";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NavItem = { title: string; icon: LucideIcon; href: string };
type NavGroup = { label: string; icon: LucideIcon; items: NavItem[] };

const officeGroups: NavGroup[] = [
  { label: "Início", icon: Home, items: [{ title: "Dashboard", icon: LayoutDashboard, href: "/" }] },
  {
    label: "Relacionamento", icon: Users,
    items: [
      { title: "Clientes", icon: Users, href: "/clients" },
      { title: "Colaboradores", icon: UserCog, href: "/staff" },
    ],
  },
  {
    label: "Operação", icon: CheckSquare,
    items: [
      { title: "Minha fila", icon: ListTodo, href: "/work-queue" },
      { title: "Tarefas", icon: CheckSquare, href: "/tasks" },
      { title: "Ciclo mensal", icon: CalendarClock, href: "/periods" },
      { title: "Agenda", icon: Calendar, href: "/agenda" },
      { title: "Documentos", icon: FileText, href: "/documents" },
    ],
  },
  {
    label: "Financeiro", icon: Wallet,
    items: [
      { title: "Visão geral", icon: Wallet, href: "/finance" },
      { title: "Pagamentos", icon: CreditCard, href: "/payments" },
      { title: "Faturas", icon: Receipt, href: "/invoices" },
      { title: "Conciliação", icon: Scale, href: "/reconciliation" },
    ],
  },
  {
    label: "Automação", icon: Bot,
    items: [
      { title: "Lia", icon: Sparkles, href: "/lia" },
      { title: "Agentes", icon: Bot, href: "/agents" },
      { title: "Workflows", icon: Workflow, href: "/workflows" },
      { title: "Integrações", icon: Plug, href: "/integrations" },
    ],
  },
  { label: "Crescimento", icon: TrendingUp, items: [{ title: "Relatórios", icon: BarChart3, href: "/reports" }] },
  { label: "Administração", icon: Settings, items: [{ title: "Configurações", icon: Settings, href: "/settings" }, { title: "Templates", icon: SlidersHorizontal, href: "/settings/templates" }] },
];

const clientGroups: NavGroup[] = [
  { label: "Início", icon: Home, items: [{ title: "Dashboard", icon: LayoutDashboard, href: "/" }] },
  {
    label: "Operação", icon: CheckSquare,
    items: [
      { title: "Tarefas", icon: CheckSquare, href: "/tasks" },
      { title: "Ciclo mensal", icon: CalendarClock, href: "/periods" },
      { title: "Agenda", icon: Calendar, href: "/agenda" },
      { title: "Documentos", icon: FileText, href: "/documents" },
    ],
  },
  { label: "Financeiro", icon: Wallet, items: [{ title: "Pagamentos", icon: CreditCard, href: "/payments" }, { title: "Faturas", icon: Receipt, href: "/invoices" }] },
  { label: "Crescimento", icon: TrendingUp, items: [{ title: "Relatórios", icon: BarChart3, href: "/reports" }] },
];

const groupHasPath = (group: NavGroup, pathname: string) =>
  group.items.some((item) => item.href === pathname || pathname.startsWith(`${item.href}/`));

const SidebarHint = ({
  children,
  label,
  show,
}: {
  children: ReactElement;
  label: string;
  show: boolean;
}) => (
  <Tooltip>
    <TooltipTrigger asChild>{children}</TooltipTrigger>
    {show && (
      <TooltipContent side="right" sideOffset={12} className="judex-floating sidebar-tooltip">
        {label}
      </TooltipContent>
    )}
  </Tooltip>
);

export const AppSidebar = () => {
  const { viewMode, isCollapsed, setIsCollapsed } = useViewMode();
  const { user, profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const canReadIntegrations = useWorkspacePermission({
    tenantId: profile?.tenant_id ?? null,
    userId: user?.id,
    accountType: profile?.account_type,
    resource: "integrations",
    action: "read",
  });
  const groups = useMemo(() => {
    const source = viewMode === "office" ? officeGroups : clientGroups;
    if (viewMode !== "office" || canReadIntegrations) return source;
    return source
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => item.href !== "/integrations"),
      }))
      .filter((group) => group.items.length > 0);
  }, [canReadIntegrations, viewMode]);
  const activeGroup = groups.find((group) => groupHasPath(group, location.pathname))?.label ?? groups[0]?.label;
  const [openGroup, setOpenGroup] = useState<string | undefined>(activeGroup);
  const [helpOpen, setHelpOpen] = useState(false);
  const hasExpandedGroup = !isCollapsed && groups.some(
    (group) => group.items.length > 1 && openGroup === group.label,
  );

  useEffect(() => {
    if (activeGroup) setOpenGroup(activeGroup);
  }, [activeGroup]);

  useEffect(() => {
    const handleSidebarShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        setIsCollapsed(!isCollapsed);
      }
    };
    window.addEventListener("keydown", handleSidebarShortcut);
    return () => window.removeEventListener("keydown", handleSidebarShortcut);
  }, [isCollapsed, setIsCollapsed]);

  const renderItem = (item: NavItem) => {
    const Icon = item.icon;
    const active = location.pathname === item.href || location.pathname.startsWith(`${item.href}/`);
    return (
      <Link
        key={item.href}
        to={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors duration-200",
          isCollapsed && "lg:mx-auto lg:h-10 lg:w-10 lg:justify-center lg:rounded-full lg:px-0",
          active
            ? "bg-white/10 font-medium text-white"
            : "text-white/65 hover:bg-white/10 hover:text-white",
        )}
      >
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{item.title}</span>
      </Link>
    );
  };

  return (
    <nav className={cn(
      "sticky top-14 z-30 flex w-full shrink-0 flex-col border-b border-white/10 bg-black text-white lg:fixed lg:inset-y-0 lg:left-0 lg:border-b-0 lg:border-r lg:border-white/10 lg:transition-[width] lg:duration-300",
      isCollapsed ? "lg:w-[3.75rem]" : "lg:w-64",
    )}>
      <div className="hidden h-14 items-center justify-center px-3 lg:flex lg:h-[4.25rem]">
        <LotusLogo
          size="lg"
          iconOnly={isCollapsed}
          className={isCollapsed ? "[&_img]:h-10" : "[&_img]:h-14"}
        />
      </div>

      <div className={cn(
        "sidebar-nav-scroll flex items-center gap-1 overflow-x-auto px-3 py-2 custom-scroll lg:min-h-0 lg:flex-1 lg:flex-col lg:items-stretch lg:gap-1.5 lg:overflow-x-hidden lg:px-3 lg:py-5",
        hasExpandedGroup ? "lg:overflow-y-auto" : "lg:overflow-y-hidden",
        isCollapsed ? "lg:items-center lg:px-1.5" : "",
      )}>
        <div className={cn("shrink-0 lg:w-full", isCollapsed ? "lg:flex lg:items-center lg:justify-center" : "w-[220px]") }>
          <WorkspaceSwitcher compact={isCollapsed} />
        </div>
        {groups.map((group) => {
          const GroupIcon = group.icon;
          const isActive = groupHasPath(group, location.pathname);
          const isOpen = openGroup === group.label;

          if (group.items.length === 1) {
            const item = group.items[0];
            return (
              <SidebarHint key={group.label} show={isCollapsed} label={group.label}>
                <Link
                  to={item.href}
                  aria-label={isCollapsed ? group.label : undefined}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors duration-200 lg:w-full",
                    isCollapsed ? "lg:mx-auto lg:h-10 lg:w-10 lg:justify-center lg:rounded-full lg:px-0" : "lg:justify-start",
                    isActive
                      ? "bg-white/10 text-white"
                      : "text-white/65 hover:bg-white/10 hover:text-white",
                  )}
                >
                  <GroupIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className={cn(isCollapsed && "lg:hidden")}>{group.label}</span>
                </Link>
              </SidebarHint>
            );
          }

          if (isCollapsed) {
            return (
              <DropdownMenu key={group.label}>
                <SidebarHint show label={group.label}>
                  <DropdownMenuTrigger asChild>
                    <button
                      aria-label={group.label}
                      className={cn(
                        "flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium whitespace-nowrap outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black lg:mx-auto lg:h-10 lg:w-10 lg:justify-center lg:rounded-full lg:px-0",
                        isActive ? "bg-white/12 text-white" : "text-white/65 hover:bg-white/10 hover:text-white",
                      )}
                    >
                      <GroupIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="lg:hidden">{group.label}</span>
                      <ChevronDown className="h-3.5 w-3.5 opacity-70 lg:hidden" aria-hidden="true" />
                    </button>
                  </DropdownMenuTrigger>
                </SidebarHint>
                <DropdownMenuContent side="right" align="start" sideOffset={10} className="min-w-[220px]">
                  {group.items.map((item) => {
                    const active = location.pathname === item.href || location.pathname.startsWith(`${item.href}/`);
                    const Icon = item.icon;
                    return (
                      <DropdownMenuItem
                        key={item.href}
                        onSelect={() => navigate(item.href)}
                        className={cn("cursor-pointer gap-2", active && "bg-accent font-medium text-accent-foreground")}
                      >
                        <Icon className="h-4 w-4" aria-hidden="true" />
                        <span>{item.title}</span>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          }

          return (
            <div key={group.label} className="w-full">
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpenGroup(isOpen ? undefined : group.label)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium whitespace-nowrap outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black",
                  isActive ? "bg-white/12 text-white" : "text-white/65 hover:bg-white/10 hover:text-white",
                )}
              >
                <GroupIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{group.label}</span>
                <ChevronDown className={cn("ml-auto h-3.5 w-3.5 opacity-70 transition-transform", isOpen && "rotate-180")} aria-hidden="true" />
              </button>
              <div className={cn("grid transition-[grid-template-rows,opacity] duration-200", isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
                <div className="min-h-0 overflow-hidden pl-3 pt-1">
                  <div className="space-y-1 border-l border-white/10 pl-2">
                    {group.items.map(renderItem)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className={cn("shrink-0 border-t border-white/10 px-3 py-3", isCollapsed ? "lg:px-2" : "")}>
        <SidebarHint show={isCollapsed} label="Ajuda e atalhos">
          <button
            type="button"
            aria-label="Ajuda e atalhos"
            onClick={() => setHelpOpen(true)}
            className={cn(
              "flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-white/65 outline-none transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black",
              isCollapsed && "lg:mx-auto lg:h-10 lg:w-10 lg:justify-center lg:rounded-full lg:px-0",
            )}
          >
            <CircleHelp className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className={cn(isCollapsed && "lg:hidden")}>Ajuda e atalhos</span>
            <ArrowUpRight className={cn("ml-auto h-3.5 w-3.5", isCollapsed && "lg:hidden")} aria-hidden="true" />
          </button>
        </SidebarHint>
      </div>
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="dialog-window sidebar-help-dialog">
          <DialogHeader className="dialog-header">
            <DialogTitle>Um pouco mais de espaço para o seu trabalho.</DialogTitle>
            <DialogDescription>Atalhos e orientações da Lotus.</DialogDescription>
          </DialogHeader>
          <div className="dialog-body help-dialog-body custom-scroll">
            <div className="help-shortcuts">
              <p>
                Busca global <kbd>Ctrl / ⌘ K</kbd>
              </p>
              <p>
                Expandir ou recolher menu <kbd>Ctrl / ⌘ B</kbd>
              </p>
              <p>
                Enviar uma mensagem para a Lia <kbd>Enter</kbd>
              </p>
              <p>
                Quebrar linha no chat <kbd>Shift Enter</kbd>
              </p>
            </div>
            <p className="help-dialog-note">
              Use a busca para encontrar clientes, tarefas e documentos rapidamente. A Lia também pode ajudar você a navegar e organizar a rotina do escritório.
            </p>
          </div>
          <DialogFooter className="dialog-footer">
            <Button onClick={() => setHelpOpen(false)}>Entendi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </nav>
  );
};
