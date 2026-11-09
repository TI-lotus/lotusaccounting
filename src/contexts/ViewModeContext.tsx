import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";

export type ViewMode = "office" | "client";

interface ViewModeContextType {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  role: string | null;
  canSwitchViewMode: boolean;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
}

const ViewModeContext = createContext<ViewModeContextType | undefined>(undefined);

export const ViewModeProvider = ({ children }: { children: ReactNode }) => {
  const { profile } = useAuth();
  const role = profile?.account_type ?? null;
  const [viewMode, setViewMode] = useState<ViewMode>("office");
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("lotus-sidebar-collapsed") === "1";
  });
  const canSwitchViewMode = false;

  useEffect(() => {
    setViewMode(role === "client" ? "client" : "office");
  }, [role]);

  useEffect(() => {
    window.localStorage.setItem("lotus-sidebar-collapsed", isCollapsed ? "1" : "0");
  }, [isCollapsed]);

  const value = useMemo(
    () => ({
      viewMode,
      setViewMode: (mode: ViewMode) => {
        // Perspective is determined by the account type, never by a toggle.
        setViewMode(role === "client" ? "client" : "office");
      },
      role,
      canSwitchViewMode,
      isCollapsed,
      setIsCollapsed,
    }),
    [canSwitchViewMode, isCollapsed, role, viewMode],
  );

  return (
    <ViewModeContext.Provider value={value}>
      {children}
    </ViewModeContext.Provider>
  );
};

export const useViewMode = () => {
  const context = useContext(ViewModeContext);
  if (context === undefined) {
    throw new Error("useViewMode must be used within a ViewModeProvider");
  }
  return context;
};
