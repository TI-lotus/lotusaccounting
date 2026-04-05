import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AIAgentChat } from "./AIAgentChat";
import liaIconImage from "@/assets/lia-icon.png";

interface AIAgentButtonProps {
  className?: string;
  externalOpen?: boolean;
  onExternalClose?: () => void;
}

export const AIAgentButton = ({ className, externalOpen, onExternalClose }: AIAgentButtonProps) => {
  const [chatOpen, setChatOpen] = useState(false);

  const isOpen = externalOpen || chatOpen;

  const handleClose = () => {
    setChatOpen(false);
    onExternalClose?.();
  };

  return (
    <>
      <AIAgentChat open={isOpen} onClose={handleClose} />
      <Button
        onClick={() => setChatOpen(!chatOpen)}
        className={cn(
          "fixed bottom-6 right-6 z-50",
          "h-14 w-14 rounded-full p-0",
          "bg-[hsl(40,45%,57%)] hover:bg-[hsl(40,45%,50%)]",
          "text-[hsl(0,0%,9%)]",
          "shadow-lg hover:shadow-xl",
          "transition-all duration-200 hover:scale-105",
          isOpen && "bg-[hsl(40,45%,50%)]",
          className
        )}
      >
        <img src={liaIconImage} alt="Lia" className="h-6 w-6" />
      </Button>
    </>
  );
};
