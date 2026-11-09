import { ReactNode, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";
import { ChatBox, ChatPanelState } from "@/components/ChatBox";
import { cn } from "@/lib/utils";
import { useViewMode } from "@/contexts/ViewModeContext";

interface DashboardLayoutProps {
  children: ReactNode;
  className?: string;
}

const STORAGE_KEY = "lia-chat-panel-state";

export const DashboardLayout = ({ children, className }: DashboardLayoutProps) => {
  const location = useLocation();
  const { isCollapsed } = useViewMode();
  const [chatState, setChatState] = useState<ChatPanelState>(() => {
    if (typeof window === "undefined") return "closed";
    const saved = window.localStorage.getItem(STORAGE_KEY) as ChatPanelState | null;
    return saved ?? "closed";
  });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, chatState);
  }, [chatState]);

  useEffect(() => {
    if (location.pathname === "/lia") setChatState("open");
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col w-full bg-background">
      <TopBar />
      <AppSidebar />
      <main
        className={cn(
          "flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:pr-8 lg:transition-[padding] lg:duration-300",
          isCollapsed ? "lg:pl-[5.5rem]" : "lg:pl-[17rem]",
          chatState === "open" && "lg:pr-[396px]",
          chatState === "minimized" && "lg:pr-20",
          className
        )}
      >
        {children}
      </main>
      <ChatBox state={chatState} onStateChange={setChatState} />
    </div>
  );
};
