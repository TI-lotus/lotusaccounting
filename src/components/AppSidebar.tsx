import { useLocation, Link, useNavigate } from "react-router-dom";
import {
  Home,
  LayoutDashboard,
  Users,
  UserCog,
  MessageSquare,
  CheckSquare,
  Calendar,
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
  Gift,
  Settings,
  Crown,
  ChevronDown,
  LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useViewMode } from "@/contexts/ViewModeContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NavItem = { title: string; icon: LucideIcon; href: string };
type NavGroup = { label: string; icon: LucideIcon; items: NavItem[] };

const officeGroups: NavGroup[] = [
  {
    label: "Início",
    icon: Home,
    items: [{ title: "Dashboard", icon: LayoutDashboard, href: "/" }],
  },
  {
    label: "Relacionamento",
    icon: Users,
    items: [
      { title: "Clientes", icon: Users, href: "/clients" },
      { title: "Colaboradores", icon: UserCog, href: "/staff" },
      { title: "Mensagens", icon: MessageSquare, href: "/messages" },
    ],
  },
  {
    label: "Operação",
    icon: CheckSquare,
    items: [
      { title: "Tarefas", icon: CheckSquare, href: "/tasks" },
      { title: "Agenda", icon: Calendar, href: "/agenda" },
      { title: "Documentos", icon: FileText, href: "/documents" },
    ],
  },
  {
    label: "Financeiro",
    icon: Wallet,
    items: [
      { title: "Visão geral", icon: Wallet, href: "/finance" },
      { title: "Pagamentos", icon: CreditCard, href: "/payments" },
      { title: "Faturas", icon: Receipt, href: "/invoices" },
      { title: "Conciliação", icon: Scale, href: "/reconciliation" },
    ],
  },
  {
    label: "Automação",
    icon: Bot,
    items: [
      { title: "Lia", icon: Sparkles, href: "/lia" },
      { title: "Agentes", icon: Bot, href: "/agents" },
      { title: "Workflows", icon: Workflow, href: "/workflows" },
      { title: "Integrações", icon: Plug, href: "/integrations" },
    ],
  },
  {
    label: "Crescimento",
    icon: TrendingUp,
    items: [
      { title: "Relatórios", icon: BarChart3, href: "/reports" },
      { title: "Afiliados", icon: Gift, href: "/affiliation" },
    ],
  },
  {
    label: "Administração",
    icon: Settings,
    items: [
      { title: "Configurações", icon: Settings, href: "/settings" },
      { title: "Upgrade", icon: Crown, href: "/upgrade" },
    ],
  },
];

const clientGroups: NavGroup[] = [
  {
    label: "Início",
    icon: Home,
    items: [{ title: "Dashboard", icon: LayoutDashboard, href: "/" }],
  },
  {
    label: "Operação",
    icon: CheckSquare,
    items: [
      { title: "Tarefas", icon: CheckSquare, href: "/tasks" },
      { title: "Agenda", icon: Calendar, href: "/agenda" },
      { title: "Documentos", icon: FileText, href: "/documents" },
    ],
  },
  {
    label: "Financeiro",
    icon: Wallet,
    items: [
      { title: "Pagamentos", icon: CreditCard, href: "/payments" },
      { title: "Faturas", icon: Receipt, href: "/invoices" },
    ],
  },
  {
    label: "Crescimento",
    icon: TrendingUp,
    items: [{ title: "Relatórios", icon: BarChart3, href: "/reports" }],
  },
];

export const AppSidebar = () => {
  const { viewMode } = useViewMode();
  const location = useLocation();
  const navigate = useNavigate();
  const groups = viewMode === "office" ? officeGroups : clientGroups;

  return (
    <nav className="sticky top-16 z-30 w-full bg-sidebar border-b border-sidebar-border">
      <div className="flex items-center gap-1 overflow-x-auto px-4 py-2 custom-scroll">
        {groups.map((group) => {
          const GroupIcon = group.icon;
          const isActive = group.items.some((i) => i.href === location.pathname);

          // Single-item group renders as a direct link
          if (group.items.length === 1) {
            const item = group.items[0];
            return (
              <Link
                key={group.label}
                to={item.href}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )}
              >
                <GroupIcon className="h-4 w-4 shrink-0" />
                <span>{group.label}</span>
              </Link>
            );
          }

          return (
            <DropdownMenu key={group.label}>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors outline-none",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  )}
                >
                  <GroupIcon className="h-4 w-4 shrink-0" />
                  <span>{group.label}</span>
                  <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[220px] rounded-xl">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = location.pathname === item.href;
                  return (
                    <DropdownMenuItem
                      key={item.href}
                      onSelect={() => navigate(item.href)}
                      className={cn(
                        "gap-2 rounded-lg cursor-pointer",
                        active && "bg-accent text-accent-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        })}
      </div>
    </nav>
  );
};
