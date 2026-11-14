import { ReactNode, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";
import { ChatBox, ChatPanelState } from "@/components/ChatBox";
import { cn } from "@/lib/utils";
import { useViewMode } from "@/contexts/ViewModeContext";
import { AlertTriangle, RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useData } from "@/contexts/DataContext";

interface DashboardLayoutProps {
  children: ReactNode;
  className?: string;
}

const STORAGE_KEY = "lia-chat-panel-state";

export const DashboardLayout = ({ children, className }: DashboardLayoutProps) => {
  const location = useLocation();
  const { isCollapsed, setIsCollapsed } = useViewMode();
  const { dataError, refresh } = useData();
  const isMessagesPage = location.pathname === "/messages";
  const isLiaPage = location.pathname === "/lia";
  const [chatState, setChatState] = useState<ChatPanelState>(() => {
    if (typeof window === "undefined") return "closed";
    const saved = window.localStorage.getItem(STORAGE_KEY) as ChatPanelState | null;
    return saved ?? "closed";
  });
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

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

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

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
        {!isMessagesPage && dataError && (
          <div
            role="alert"
            className="mx-auto mb-4 flex w-full max-w-[1440px] flex-wrap items-center gap-3 rounded-2xl border border-gilver/30 bg-gilver/10 px-4 py-3 text-sm text-foreground"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 text-gilver" aria-hidden="true" />
            <p className="min-w-0 flex-1">{dataError}</p>
            <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => void refresh()}>
              <RefreshCw className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
              Atualizar dados
            </Button>
          </div>
        )}
        <div className="page-frame mx-auto h-full min-h-0 w-full min-w-0 max-w-[1440px]">
          {children}
        </div>
      </main>
      {!isOnline && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed bottom-4 left-1/2 z-[90] flex -translate-x-1/2 items-center gap-2 rounded-full border border-border/80 bg-card/95 px-4 py-2 text-xs font-medium text-foreground shadow-lg backdrop-blur-md"
        >
          <WifiOff className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          Sem conexão. As alterações serão retomadas quando a rede voltar.
        </div>
      )}
      {!isMessagesPage && <ChatBox state={isLiaPage ? chatState : "closed"} onStateChange={setChatState} />}
    </div>
  );
};
