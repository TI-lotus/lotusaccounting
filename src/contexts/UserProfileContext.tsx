import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

type UserProfileState = {
  firstName: string;
  lastName: string;
  email: string;
  cpf: string;
  avatarUrl: string;
  companyName: string;
  cnpj: string;
};

type UserProfileContextValue = UserProfileState & {
  fullName: string;
  initials: string;
  updateProfile: (updates: Partial<UserProfileState>) => void;
};

const defaultProfile: UserProfileState = {
  firstName: "",
  lastName: "",
  email: "",
  cpf: "",
  avatarUrl: "",
  companyName: "",
  cnpj: "",
};

// Only these non-sensitive fields are persisted to localStorage.
// Sensitive identifiers (cpf, cnpj, email) are loaded from the backend on demand.
const PERSISTED_KEYS = ["firstName", "lastName", "avatarUrl", "companyName"] as const;
const STORAGE_KEY = "lotus-user-profile";

const UserProfileContext = createContext<UserProfileContextValue | undefined>(undefined);

export const UserProfileProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfileState>(() => {
    if (typeof window === "undefined") return defaultProfile;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? { ...defaultProfile, ...JSON.parse(stored) } : defaultProfile;
    } catch {
      return defaultProfile;
    }
  });

  // Persist only non-sensitive fields
  useEffect(() => {
    const safe: Partial<UserProfileState> = {};
    for (const key of PERSISTED_KEYS) safe[key] = profile[key];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
  }, [profile]);

  // Load sensitive identifiers from backend after auth
  useEffect(() => {
    if (!user) {
      setProfile((current) => ({ ...current, email: "", cpf: "", cnpj: "" }));
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles" as never)
        .select("full_name, company_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const full = (data as { full_name?: string } | null)?.full_name ?? "";
      const [firstName = "", ...rest] = full.split(" ");
      setProfile((current) => ({
        ...current,
        email: user.email ?? "",
        firstName: current.firstName || firstName,
        lastName: current.lastName || rest.join(" "),
      }));
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const value = useMemo<UserProfileContextValue>(() => {
    const fullName = `${profile.firstName} ${profile.lastName}`.trim();
    return {
      ...profile,
      fullName,
      initials: fullName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "LT",
      updateProfile: (updates) => setProfile((current) => ({ ...current, ...updates })),
    };
  }, [profile]);

  return <UserProfileContext.Provider value={value}>{children}</UserProfileContext.Provider>;
};

export const useUserProfile = () => {
  const context = useContext(UserProfileContext);
  if (!context) throw new Error("useUserProfile must be used inside UserProfileProvider");
  return context;
};
