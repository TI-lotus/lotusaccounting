import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AIAgentChat } from "./AIAgentChat";
import liaIconImage from "@/assets/lia-assistant.png";

interface AIAgentButtonProps {
  className?: string;
  externalOpen?: boolean;
  onExternalClose?: () => void;
  initialMessage?: string;
  onInitialMessageHandled?: () => void;
}

export const AIAgentButton = ({ className, externalOpen, onExternalClose, initialMessage, onInitialMessageHandled }: AIAgentButtonProps) => {
  const [chatOpen, setChatOpen] = useState(false);

  const isOpen = externalOpen || chatOpen;

  const handleClose = () => {
    setChatOpen(false);
    onExternalClose?.();
  };

  return (
    <>
      <AIAgentChat open={isOpen} onClose={handleClose} initialMessage={initialMessage} onInitialMessageHandled={onInitialMessageHandled} />
      <Button
        onClick={() => setChatOpen(!chatOpen)}
        className={cn(
          "fixed bottom-6 right-6 z-50",
          "h-14 w-14 rounded-full p-0",
          "bg-gilver hover:bg-gilver-dark text-sidebar-primary-foreground",
          "shadow-lg hover:shadow-xl",
          "transition-all duration-200 hover:scale-105",
          isOpen && "bg-gilver-dark",
          className
        )}
      >
        <img src={liaIconImage} alt="Lia" className="h-6 w-6" />
      </Button>
    </>
  );
};
