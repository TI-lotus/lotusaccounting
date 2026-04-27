import { createContext, useContext, useEffect, useMemo, useState } from "react";

type UserProfileState = {
  firstName: string;
  lastName: string;
  email: string;
  cpf: string;
  companyName: string;
  cnpj: string;
};

type UserProfileContextValue = UserProfileState & {
  fullName: string;
  initials: string;
  updateProfile: (updates: Partial<UserProfileState>) => void;
};

const defaultProfile: UserProfileState = {
  firstName: "John",
  lastName: "Doe",
  email: "john@lotus.com",
  cpf: "123.456.789-00",
  companyName: "Lotus Serviços Financeiros",
  cnpj: "12.345.678/0001-90",
};

const UserProfileContext = createContext<UserProfileContextValue | undefined>(undefined);

export const UserProfileProvider = ({ children }: { children: React.ReactNode }) => {
  const [profile, setProfile] = useState<UserProfileState>(() => {
    if (typeof window === "undefined") return defaultProfile;
    const stored = localStorage.getItem("lotus-user-profile");
    return stored ? { ...defaultProfile, ...JSON.parse(stored) } : defaultProfile;
  });

  useEffect(() => {
    localStorage.setItem("lotus-user-profile", JSON.stringify(profile));
  }, [profile]);

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