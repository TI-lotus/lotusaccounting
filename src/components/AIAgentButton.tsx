import { useState } from "react";
import { MessageCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AIAgentChat } from "./AIAgentChat";

interface AIAgentButtonProps {
  className?: string;
}

export const AIAgentButton = ({ className }: AIAgentButtonProps) => {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <>
      <AIAgentChat open={chatOpen} onClose={() => setChatOpen(false)} />
      <Button
        onClick={() => setChatOpen(!chatOpen)}
        className={cn(
          "fixed bottom-6 right-6 z-50",
          "h-14 px-5 rounded-full",
          "bg-primary hover:bg-primary/90",
          "text-primary-foreground font-medium",
          "shadow-lg hover:shadow-xl",
          "transition-all duration-200",
          "flex items-center gap-2.5",
          chatOpen && "bg-accent text-accent-foreground hover:bg-accent/90",
          className
        )}
      >
        <div className="relative">
          <MessageCircle className="h-5 w-5" />
          <Sparkles className="absolute -top-1 -right-1 h-3 w-3 opacity-80" />
        </div>
        <span>{chatOpen ? "Fechar" : "Falar com IA"}</span>
      </Button>
    </>
  );
};
