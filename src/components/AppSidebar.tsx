import { useLocation, Link, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  FileText,
  BarChart3,
  Plug,
  MessageSquare,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Search,
  Gift,
  Crown,
  ChevronDown,
  Bot,
  Building2,
  User,
  CheckSquare,
} from "lucide-react";
import { LotusLogo } from "./LotusLogo";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import { useViewMode } from "@/contexts/ViewModeContext";
import { CompanySelector } from "./CompanySelector";

const officeNavItems = [
  { title: "Dashboard", icon: LayoutDashboard, href: "/" },
  { title: "Clientes", icon: Users, href: "/clients" },
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
  { title: "Documentos", icon: FileText, href: "/documents" },
  { title: "Relatórios", icon: BarChart3, href: "/reports" },
  { title: "Mensagens", icon: MessageSquare, href: "/messages", badge: 2 },
];

export const AppSidebar = () => {
  const { viewMode, setViewMode, isCollapsed, setIsCollapsed } = useViewMode();
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = viewMode === "office" ? officeNavItems : clientNavItems;

  const NavItem = ({ item }: { item: typeof officeNavItems[0] }) => {
    const isActive = location.pathname === item.href;
    const Icon = item.icon;

    const content = (
      <Link
        to={item.href}
        className={cn(
          "nav-link group relative",
          isActive && "active"
        )}
      >
        <Icon className={cn("h-5 w-5 shrink-0", isActive && "text-primary-foreground")} />
        <span
          className={cn(
            "transition-all duration-300 whitespace-nowrap",
            isCollapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
          )}
        >
          {item.title}
        </span>
        {item.badge && !isCollapsed && (
          <span className="ml-auto bg-primary text-primary-foreground text-xs font-medium px-2 py-0.5 rounded-full">
            {item.badge}
          </span>
        )}
        {item.badge && isCollapsed && (
          <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs font-medium w-4 h-4 flex items-center justify-center rounded-full">
            {item.badge}
          </span>
        )}
      </Link>
    );

    if (isCollapsed) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent side="right" className="font-medium">
            {item.title}
          </TooltipContent>
        </Tooltip>
      );
    }

    return content;
  };

  return (
    <aside
      className={cn(
        "h-screen sticky top-0 flex flex-col",
        "bg-sidebar border-r border-sidebar-border",
        "transition-all duration-300 ease-out",
        isCollapsed ? "w-[72px]" : "w-[260px]"
      )}
    >
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border bg-gilver dark:bg-gilver/20">
        <div className={cn(
          "transition-all duration-300 overflow-hidden",
          isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100"
        )}>
          <LotusLogo size="sm" showText={!isCollapsed} />
        </div>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            "h-7 w-7 rounded-lg flex items-center justify-center",
            "text-foreground/70 hover:text-foreground hover:bg-background/50",
            "transition-all duration-200",
            isCollapsed && "mx-auto"
          )}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* View Mode Indicator */}
      {!isCollapsed && (
        <div className="px-3 pt-3">
          <div className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium",
            viewMode === "office" 
              ? "bg-primary/10 text-primary" 
              : "bg-gilver/50 dark:bg-gilver/20 text-foreground"
          )}>
            {viewMode === "office" ? (
              <>
                <Building2 className="h-3.5 w-3.5" />
                Modo Escritório
              </>
            ) : (
              <>
                <User className="h-3.5 w-3.5" />
                Modo Cliente
              </>
            )}
          </div>
        </div>
      )}

      {/* Company Selector for Client Mode */}
      {viewMode === "client" && !isCollapsed && (
        <div className="px-3 pt-2">
          <CompanySelector />
        </div>
      )}

      {/* Main Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto sidebar-scroll">
        {navItems.map((item) => (
          <NavItem key={item.href} item={item} />
        ))}
      </nav>

      <Separator className="mx-3" />

      {/* User Profile with Dropdown */}
      <div className={cn(
        "p-3 border-t border-sidebar-border",
        isCollapsed ? "flex justify-center" : ""
      )}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn(
              "w-full flex items-center gap-3 p-2 rounded-xl",
              "hover:bg-accent transition-colors cursor-pointer text-left"
            )}>
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarImage src="" />
                <AvatarFallback className="bg-gilver text-foreground font-medium text-sm">
                  {viewMode === "office" ? "JD" : "CK"}
                </AvatarFallback>
              </Avatar>
              <div className={cn(
                "flex-1 min-w-0 transition-all duration-300",
                isCollapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
              )}>
                <p className="text-sm font-medium truncate">
                  {viewMode === "office" ? "John Doe" : "Claison Kepler"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {viewMode === "office" ? "john@lotus.com" : "claison@empresa.com"}
                </p>
              </div>
              {!isCollapsed && (
                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
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
            <DropdownMenuItem className="text-destructive focus:text-destructive">
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
};
