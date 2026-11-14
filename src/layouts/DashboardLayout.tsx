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
  const { isCollapsed, setIsCollapsed } = useViewMode();
  const isMessagesPage = location.pathname === "/messages";
  const isLiaPage = location.pathname === "/lia";
  const [chatState, setChatState] = useState<ChatPanelState>(() => {
    if (typeof window === "undefined") return "closed";
    const saved = window.localStorage.getItem(STORAGE_KEY) as ChatPanelState | null;
    return saved ?? "closed";
  });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, chatState);
  }, [chatState]);

  useEffect(() => {
    // The Lia panel is intentionally scoped to its own route. This prevents a
    // persisted open state from covering the fixed workspace messaging panes.
    setChatState(isLiaPage ? "open" : "closed");
  }, [isLiaPage]);

  useEffect(() => {
    if (isMessagesPage) setIsCollapsed(true);
  }, [isMessagesPage, setIsCollapsed]);

  return (
    <div className={cn(
      "flex min-h-screen w-full flex-col bg-background",
      isMessagesPage && "h-[100dvh] min-h-0 overflow-hidden",
    )}>
      <a
        href="#main-content"
        className="sr-only fixed left-3 top-3 z-[100] rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background focus:not-sr-only focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        Pular para o conteúdo principal
      </a>
      <TopBar />
      <AppSidebar />
      <main
        id="main-content"
        tabIndex={-1}
        aria-label="Conteúdo principal"
        className={cn(
          "min-h-0 min-w-0 flex-1 overflow-x-hidden px-4 py-5 sm:px-6 sm:py-6 lg:pr-8 lg:transition-[padding] lg:duration-300",
          isCollapsed ? "lg:pl-[5.5rem]" : "lg:pl-[17rem]",
          isLiaPage && chatState === "open" && "lg:pr-[396px]",
          isLiaPage && chatState === "minimized" && "lg:pr-20",
          className
        )}
      >
        <div className="page-frame mx-auto h-full min-h-0 w-full min-w-0 max-w-[1440px]">
          {children}
        </div>
      </main>
      {!isMessagesPage && <ChatBox state={isLiaPage ? chatState : "closed"} onStateChange={setChatState} />}
    </div>
  );
};
