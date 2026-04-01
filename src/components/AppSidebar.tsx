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
  UserCog,
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
          isCollapsed && "justify-center px-0",
          isActive && "active"
        )}
      >
        <Icon className={cn("h-5 w-5 shrink-0", isActive && "text-sidebar-primary-foreground")} />
        <span
          className={cn(
            "transition-all duration-300 whitespace-nowrap",
            isCollapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
          )}
        >
          {item.title}
        </span>
        {item.badge && !isCollapsed && (
          <span className="ml-auto bg-gilver text-sidebar-primary-foreground text-xs font-medium px-2 py-0.5 rounded-full">
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
          <TooltipContent side="right" className="font-medium z-[99999]">
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
        "h-screen sticky top-0 flex flex-col relative",
        "bg-[hsl(0,0%,7%)] border-r border-[hsl(0,0%,15%)]",
        "transition-all duration-300 ease-out",
        isCollapsed ? "w-[72px]" : "w-[260px]"
      )}
    >
      {/* Collapse/Expand arrow between sidebar and main */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={cn(
          "absolute -right-3 top-7 h-6 w-6 rounded-full flex items-center justify-center",
          "bg-gilver text-[hsl(0,0%,9%)] shadow-md",
          "transition-all duration-200 hover:scale-110 z-[99999]"
        )}
      >
        {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </button>

      {/* Header - dark like sidebar */}
      <div className="h-20 flex items-center justify-center px-4 border-b border-[hsl(0,0%,15%)] bg-[hsl(0,0%,5%)]">
        <div className={cn(
          "transition-all duration-300 overflow-hidden",
          isCollapsed ? "w-0 opacity-0 hidden" : "w-auto opacity-100"
        )}>
          <LotusLogo size="lg" showText={!isCollapsed} />
        </div>
        {isCollapsed && (
          <div className="mx-auto">
            <LotusLogo size="md" iconOnly />
          </div>
        )}
      </div>

      {/* View Mode Indicator */}
      {!isCollapsed && (
        <div className="px-3 pt-3">
          <div className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium",
            viewMode === "office" 
              ? "bg-[hsl(0,0%,15%)] text-[hsl(40,45%,57%)]" 
              : "bg-[hsl(40,20%,18%)] text-[hsl(40,45%,75%)]"
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

      <Separator className="mx-3 bg-[hsl(0,0%,15%)]" />

      {/* User Profile with Dropdown */}
      <div className={cn(
        "p-3 border-t border-[hsl(0,0%,15%)]",
        isCollapsed ? "flex justify-center" : ""
      )}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn(
              "w-full flex items-center gap-3 p-2 rounded-xl",
              "hover:bg-[hsl(0,0%,15%)] transition-colors cursor-pointer text-left",
              isCollapsed && "justify-center"
            )}>
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarImage src="" />
                <AvatarFallback className="bg-gilver text-[hsl(0,0%,9%)] font-medium text-sm">
                  {viewMode === "office" ? "JD" : "CK"}
                </AvatarFallback>
              </Avatar>
              <div className={cn(
                "flex-1 min-w-0 transition-all duration-300",
                isCollapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
              )}>
                <p className="text-sm font-medium truncate text-[hsl(0,0%,90%)]">
                  {viewMode === "office" ? "John Doe" : "Claison Kepler"}
                </p>
                <p className="text-xs text-[hsl(0,0%,55%)] truncate">
                  {viewMode === "office" ? "john@lotus.com" : "claison@empresa.com"}
                </p>
              </div>
              {!isCollapsed && (
                <ChevronDown className="h-4 w-4 text-[hsl(0,0%,55%)] shrink-0" />
              )}
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
