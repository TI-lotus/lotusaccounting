import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AIAgentChat } from "./AIAgentChat";

interface AIAgentButtonProps {
  className?: string;
}

const SparkleIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {/* Large four-point star */}
    <path d="M12 2L13.5 8.5L20 10L13.5 11.5L12 18L10.5 11.5L4 10L10.5 8.5L12 2Z" />
    {/* Small four-point star */}
    <path d="M19 15L19.75 17.25L22 18L19.75 18.75L19 21L18.25 18.75L16 18L18.25 17.25L19 15Z" />
  </svg>
);

export const AIAgentButton = ({ className }: AIAgentButtonProps) => {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <>
      <AIAgentChat open={chatOpen} onClose={() => setChatOpen(false)} />
      <Button
        onClick={() => setChatOpen(!chatOpen)}
        className={cn(
          "fixed bottom-6 right-6 z-50",
          "h-14 w-14 rounded-full p-0",
          "bg-primary hover:bg-primary/90",
          "text-primary-foreground",
          "shadow-lg hover:shadow-xl",
          "transition-all duration-200 hover:scale-105",
          chatOpen && "bg-accent text-accent-foreground hover:bg-accent/90",
          className
        )}
      >
        <SparkleIcon />
      </Button>
    </>
  );
};
