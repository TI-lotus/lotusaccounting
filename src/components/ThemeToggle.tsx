import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface ThemeToggleProps {
  className?: string;
}

export const ThemeToggle = ({ className }: ThemeToggleProps) => {
  const { theme, toggleTheme } = useTheme();

  const label = theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label={label}
          title={label}
          className={cn(
            "relative h-8 w-8 rounded-full border-0 transition-[background-color,color,transform] duration-200",
            "hover:bg-accent",
            className,
          )}
        >
          <Sun className={cn(
            "h-4 w-4 transition-[opacity,transform] duration-200",
            theme === "dark" ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100",
          )} aria-hidden="true" />
          <Moon className={cn(
            "absolute h-4 w-4 transition-[opacity,transform] duration-200",
            theme === "dark" ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0",
          )} aria-hidden="true" />
          <span className="sr-only">{label}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={8} className="judex-floating sidebar-tooltip">
        {label}
      </TooltipContent>
    </Tooltip>
  );
};
