import { MessageCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AIAgentButtonProps {
  className?: string;
  onClick?: () => void;
}

export const AIAgentButton = ({ className, onClick }: AIAgentButtonProps) => {
  return (
    <Button
      onClick={onClick}
      className={cn(
        "fixed bottom-6 right-6 z-50",
        "h-14 px-5 rounded-full",
        "bg-primary hover:bg-primary/90",
        "text-primary-foreground font-medium",
        "shadow-lg hover:shadow-xl",
        "transition-all duration-200",
        "flex items-center gap-2.5",
        className
      )}
    >
      <div className="relative">
        <MessageCircle className="h-5 w-5" />
        <Sparkles className="absolute -top-1 -right-1 h-3 w-3 text-primary-foreground/80" />
      </div>
      <span>Falar com IA</span>
    </Button>
  );
};
