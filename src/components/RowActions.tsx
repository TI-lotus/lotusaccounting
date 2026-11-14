import { LucideIcon, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconTooltipButton } from "@/components/IconTooltipButton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface RowActionItem {
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
  separatorBefore?: boolean;
}

interface RowActionsProps {
  primaryLabel: string;
  primaryIcon: LucideIcon;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  menuLabel?: string;
  menuItems?: RowActionItem[];
}

/** Ação principal visível + ações secundárias organizadas no menu de três pontos. */
export const RowActions = ({
  primaryLabel,
  primaryIcon,
  onPrimary,
  primaryDisabled = false,
  menuLabel = "Mais ações",
  menuItems = [],
}: RowActionsProps) => (
  <div className="flex items-center justify-end gap-1">
    <IconTooltipButton
      icon={primaryIcon}
      label={primaryLabel}
      variant="ghost"
      className="h-8 w-8 border-0 text-muted-foreground hover:bg-accent hover:text-foreground"
      disabled={primaryDisabled}
      onClick={onPrimary}
    />
    {menuItems.length > 0 && (
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={menuLabel}
                title={menuLabel}
                className="h-8 w-8 rounded-full border-0 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={8} className="judex-floating sidebar-tooltip">{menuLabel}</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="judex-floating min-w-[190px] p-1.5">
          {menuItems.flatMap((item) => {
            const Icon = item.icon;
            return [
              ...(item.separatorBefore ? [<DropdownMenuSeparator key={`${item.label}-separator`} />] : []),
              <DropdownMenuItem
                key={item.label}
                disabled={item.disabled}
                className={cn("gap-2", item.destructive && "text-destructive focus:text-destructive")}
                onSelect={item.onSelect}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
              </DropdownMenuItem>,
            ];
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    )}
  </div>
);
