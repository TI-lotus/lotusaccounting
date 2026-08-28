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
  const [isCollapsed, setIsCollapsed] = useState(false);
  const canSwitchViewMode = role === "admin" || role === "collaborator";

  useEffect(() => {
    if (role === "client") setViewMode("client");
  }, [role]);

  const value = useMemo(
    () => ({
      viewMode,
      setViewMode: (mode: ViewMode) => {
        if (role === "client") {
          setViewMode("client");
          return;
        }
        setViewMode(mode);
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
