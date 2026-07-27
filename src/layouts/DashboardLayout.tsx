import { ReactNode, useEffect, useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";
import { ChatBox, ChatPanelState } from "@/components/ChatBox";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: ReactNode;
  className?: string;
}

const STORAGE_KEY = "lia-chat-panel-state";

export const DashboardLayout = ({ children, className }: DashboardLayoutProps) => {
  const [chatState, setChatState] = useState<ChatPanelState>(() => {
    if (typeof window === "undefined") return "closed";
    const saved = window.localStorage.getItem(STORAGE_KEY) as ChatPanelState | null;
    return saved ?? "closed";
  });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, chatState);
  }, [chatState]);

  return (
    <div className="min-h-screen flex flex-col w-full bg-background">
      <TopBar />
      <AppSidebar />
      <main
        className={cn(
          "flex-1 p-6 transition-[padding] duration-200",
          chatState === "open" && "lg:pr-[396px]",
          chatState === "minimized" && "lg:pr-14",
          className
        )}
      >
        {children}
      </main>
      <ChatBox state={chatState} onStateChange={setChatState} />
    </div>
  );
};
