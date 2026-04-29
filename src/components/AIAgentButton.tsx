import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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

  useEffect(() => {
    if (document.querySelector('script[src="https://unpkg.com/@elevenlabs/convai-widget-embed"]')) return;
    const script = document.createElement("script");
    script.src = "https://unpkg.com/@elevenlabs/convai-widget-embed";
    script.async = true;
    script.type = "text/javascript";
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    if (isOpen && initialMessage?.trim()) onInitialMessageHandled?.();
  }, [isOpen, initialMessage, onInitialMessageHandled]);

  const handleClose = () => {
    setChatOpen(false);
    onExternalClose?.();
  };

  return (
    <>
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 animate-fade-in">
          {/* @ts-expect-error custom element provided by ElevenLabs widget script */}
          <elevenlabs-convai agent-id="agent_5801kqb432rmerkv08jnn0f60ypt" />
        </div>
      )}
      <Button
        onClick={() => (isOpen ? handleClose() : setChatOpen(true))}
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
        <img src={liaIconImage} alt="Lia" className="h-full w-full rounded-full object-cover" />
      </Button>
    </>
  );
};
