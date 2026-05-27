import { useLocation, Link } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  FileText,
  BarChart3,
  Plug,
  MessageSquare,
  Search,
  Gift,
  Bot,
  CheckSquare,
  UserCog,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useViewMode } from "@/contexts/ViewModeContext";

const officeNavItems = [
  { title: "Dashboard", icon: LayoutDashboard, href: "/" },
  { title: "Clientes", icon: Users, href: "/clients" },
  { title: "Colaboradores", icon: UserCog, href: "/staff" },
  { title: "Pagamentos", icon: CreditCard, href: "/payments" },
  { title: "Documentos", icon: FileText, href: "/documents" },
  { title: "Relatórios", icon: BarChart3, href: "/reports" },
  { title: "Consulta CNPJ", icon: Search, href: "/search-cnpj" },
  { title: "Agentes", icon: Bot, href: "/agents" },
  { title: "Afiliados", icon: Gift, href: "/affiliation" },
  { title: "Integrações", icon: Plug, href: "/integrations" },
  { title: "Mensagens", icon: MessageSquare, href: "/messages", badge: 3 },
];

const clientNavItems = [
  { title: "Dashboard", icon: LayoutDashboard, href: "/" },
  { title: "Tarefas", icon: CheckSquare, href: "/tasks" },
  { title: "Pagamentos", icon: CreditCard, href: "/payments" },
  { title: "Documentos", icon: FileText, href: "/documents" },
  { title: "Relatórios", icon: BarChart3, href: "/reports" },
  { title: "Mensagens", icon: MessageSquare, href: "/messages", badge: 2 },
];

export const AppSidebar = () => {
  const { viewMode } = useViewMode();
  const location = useLocation();
  const navItems = viewMode === "office" ? officeNavItems : clientNavItems;

  return (
    <nav
      className="sticky top-16 z-30 w-full bg-sidebar border-b border-sidebar-border"
    >
      <div className="flex items-center gap-1 overflow-x-auto px-4 py-2 custom-scroll">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "relative flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.title}</span>
              {item.badge && (
                <span className="ml-1 bg-gilver text-sidebar-primary-foreground text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
