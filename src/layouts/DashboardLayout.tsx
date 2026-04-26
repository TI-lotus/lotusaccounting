import { ReactNode, useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";
import { AIAgentButton } from "@/components/AIAgentButton";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: ReactNode;
  className?: string;
}

export const DashboardLayout = ({ children, className }: DashboardLayoutProps) => {
  const [aiOpen, setAiOpen] = useState(false);
  const [aiInitialMessage, setAiInitialMessage] = useState<string | undefined>();

  const handleOpenAI = (message?: string) => {
    setAiInitialMessage(message);
    setAiOpen(true);
  };

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        <TopBar onOpenAI={handleOpenAI} />
        <main className={cn("flex-1 p-6", className)}>
          {children}
        </main>
      </div>
      <AIAgentButton externalOpen={aiOpen} onExternalClose={() => setAiOpen(false)} initialMessage={aiInitialMessage} onInitialMessageHandled={() => setAiInitialMessage(undefined)} />
    </div>
  );
};
