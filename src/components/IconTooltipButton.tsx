import { LucideIcon } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface IconTooltipButtonProps extends Omit<ButtonProps, "children"> {
  icon: LucideIcon;
  label: string;
}

/** Botão icon-only com o mesmo tooltip visual usado na sidebar recolhida. */
export const IconTooltipButton = ({
  icon: Icon,
  label,
  className,
  ...props
}: IconTooltipButtonProps) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        {...props}
        type={props.type ?? "button"}
        size="icon"
        aria-label={label}
        title={label}
        className={cn("rounded-full", className)}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </Button>
    </TooltipTrigger>
    <TooltipContent side="bottom" sideOffset={8} className="judex-floating sidebar-tooltip">
      {label}
    </TooltipContent>
  </Tooltip>
);
