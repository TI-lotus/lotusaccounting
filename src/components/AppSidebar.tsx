import { useState } from "react";
import { useLocation, Link } from "react-router-dom";
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

const mainNavItems = [
  { title: "Dashboard", icon: LayoutDashboard, href: "/" },
  { title: "Clientes", icon: Users, href: "/clients" },
  { title: "Pagamentos", icon: CreditCard, href: "/payments" },
  { title: "Documentos", icon: FileText, href: "/documents" },
  { title: "Relatórios", icon: BarChart3, href: "/reports" },
  { title: "Consulta CNPJ", icon: Search, href: "/search-cnpj" },
  { title: "Afiliados", icon: Gift, href: "/affiliation" },
  { title: "Integrações", icon: Plug, href: "/integrations" },
  { title: "Mensagens", icon: MessageSquare, href: "/messages", badge: 3 },
];

const bottomNavItems = [
  { title: "Configurações", icon: Settings, href: "/settings" },
];

export const AppSidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  const NavItem = ({ item }: { item: typeof mainNavItems[0] }) => {
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
            collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
          )}
        >
          {item.title}
        </span>
        {item.badge && !collapsed && (
          <span className="ml-auto bg-primary text-primary-foreground text-xs font-medium px-2 py-0.5 rounded-full">
            {item.badge}
          </span>
        )}
        {item.badge && collapsed && (
          <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs font-medium w-4 h-4 flex items-center justify-center rounded-full">
            {item.badge}
          </span>
        )}
      </Link>
    );

    if (collapsed) {
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
        collapsed ? "w-[72px]" : "w-[260px]"
      )}
    >
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border">
        <LotusLogo size="sm" showText={!collapsed} />
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "h-7 w-7 rounded-lg flex items-center justify-center",
            "text-muted-foreground hover:text-foreground hover:bg-accent",
            "transition-all duration-200",
            collapsed && "mx-auto"
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {mainNavItems.map((item) => (
          <NavItem key={item.href} item={item} />
        ))}
      </nav>

      <Separator className="mx-3" />

      {/* Bottom Navigation */}
      <nav className="p-3 space-y-1">
        {bottomNavItems.map((item) => (
          <NavItem key={item.href} item={item} />
        ))}
      </nav>

      {/* User Profile */}
      <div className={cn(
        "p-3 border-t border-sidebar-border",
        collapsed ? "flex justify-center" : ""
      )}>
        <div className={cn(
          "flex items-center gap-3 p-2 rounded-xl",
          "hover:bg-accent transition-colors cursor-pointer"
        )}>
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarImage src="" />
            <AvatarFallback className="bg-primary/10 text-primary font-medium text-sm">
              JD
            </AvatarFallback>
          </Avatar>
          <div className={cn(
            "flex-1 min-w-0 transition-all duration-300",
            collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
          )}>
            <p className="text-sm font-medium truncate">John Doe</p>
            <p className="text-xs text-muted-foreground truncate">john@lotus.com</p>
          </div>
          {!collapsed && (
            <LogOut className="h-4 w-4 text-muted-foreground hover:text-foreground shrink-0" />
          )}
        </div>
      </div>
    </aside>
  );
};
