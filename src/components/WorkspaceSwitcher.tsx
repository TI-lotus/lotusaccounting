import { useMemo, useState } from "react";
import { Building2, Check, ChevronDown, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface WorkspaceSwitcherProps {
  compact?: boolean;
}

export const WorkspaceSwitcher = ({ compact = false }: WorkspaceSwitcherProps) => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { clients, workspaceSettings } = useData();
  const [inlineOpen, setInlineOpen] = useState(false);
  const workspaceName = useMemo(() => {
    if (profile?.account_type === "client") {
      return clients.find((client) => client.id === profile.company_id)?.name ?? "Minha empresa";
    }
    return workspaceSettings?.office_name || "Meu escritório";
  }, [clients, profile?.account_type, profile?.company_id, workspaceSettings?.office_name]);
  const initials = workspaceName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

  const workspaceButton = (
    <button
      type="button"
      aria-label={`Workspace ${workspaceName}`}
      aria-expanded={compact ? undefined : inlineOpen}
      title={compact ? workspaceName : undefined}
      onClick={compact ? undefined : () => setInlineOpen((open) => !open)}
      className={cn(
        "flex w-full items-center gap-2 rounded-xl border-0 bg-transparent p-2 text-left text-white transition-colors hover:bg-white/[0.07]",
        compact ? "justify-center lg:h-11 lg:w-11 lg:rounded-full lg:p-0" : "",
      )}
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 text-[11px] font-medium text-white">
        {initials || <Building2 className="h-4 w-4" />}
      </span>
      {!compact && (
        <span className="min-w-0 flex-1">
          <strong className="block truncate text-xs font-medium">{workspaceName}</strong>
          <small className="mt-0.5 block truncate text-[10px] text-white/45">
            {profile?.account_type === "client" ? "Portal do cliente" : "Workspace contábil"}
          </small>
        </span>
      )}
      {!compact && <ChevronDown className={cn("h-4 w-4 shrink-0 text-white/55 transition-transform", inlineOpen && "rotate-180")} />}
    </button>
  );

  if (!compact) {
    return (
      <div className="w-full">
        {workspaceButton}
        {inlineOpen && (
          <div className="mt-1 rounded-xl border border-white/10 bg-white/[0.05] p-1.5">
            <div className="rounded-lg px-2.5 py-2">
              <span className="block text-[10px] uppercase tracking-[0.14em] text-white/45">Workspace atual</span>
              <span className="mt-1 block truncate text-xs font-medium text-white">{workspaceName}</span>
            </div>
            <div className="my-1 h-px bg-white/10" />
            <div className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-white/70">
              <Check className="h-4 w-4 shrink-0 text-gilver" />
              <span>Ambiente ativo</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setInlineOpen(false);
                navigate("/settings");
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              <Settings className="h-4 w-4 shrink-0" />
              Gerenciar workspace
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{workspaceButton}</DropdownMenuTrigger>
      <DropdownMenuContent
        side={compact ? "right" : "bottom"}
        align={compact ? "start" : "center"}
        sideOffset={compact ? 12 : 8}
        className="w-64"
      >
        <DropdownMenuLabel className="px-2.5 py-2">
          <span className="block text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Workspace atual</span>
          <span className="mt-1 block truncate text-sm font-medium">{workspaceName}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-default gap-2 focus:bg-transparent">
          <Check className="h-4 w-4 text-gilver" />
          <span className="text-xs">Ambiente ativo</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate("/settings")} className="cursor-pointer gap-2">
          <Settings className="h-4 w-4" />
          Gerenciar workspace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
