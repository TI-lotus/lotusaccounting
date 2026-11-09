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
  saveProfile: () => Promise<{ ok: boolean; emailConfirmationRequired: boolean }>;
  uploadAvatar: (file: File) => Promise<boolean>;
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

const UserProfileContext = createContext<UserProfileContextValue | undefined>(undefined);

export const UserProfileProvider = ({ children }: { children: React.ReactNode }) => {
  const { user, profile: authProfile } = useAuth();
  const [profile, setProfile] = useState<UserProfileState>(defaultProfile);

  useEffect(() => {
    setProfile(defaultProfile);
    if (!user || !authProfile?.tenant_id) return;

    let cancelled = false;
    const load = async () => {
      const [profileResult, workspaceResult] = await Promise.all([
        supabase.from("profiles").select("full_name, cpf, avatar_url").eq("user_id", user.id).maybeSingle(),
        supabase.from("workspace_settings").select("office_name, cnpj").eq("tenant_id", authProfile.tenant_id).maybeSingle(),
      ]);
      if (cancelled) return;

      const fullName = profileResult.data?.full_name ?? authProfile.full_name ?? "";
      const [firstName = "", ...rest] = fullName.split(" ");
      setProfile({
        firstName,
        lastName: rest.join(" "),
        email: user.email ?? "",
        cpf: profileResult.data?.cpf ?? "",
        avatarUrl: profileResult.data?.avatar_url ?? "",
        companyName: workspaceResult.data?.office_name ?? "",
        cnpj: workspaceResult.data?.cnpj ?? "",
      });
    };

    void load();
    const channel = supabase
      .channel(`workspace-profile-${authProfile.tenant_id}-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "workspace_settings", filter: `tenant_id=eq.${authProfile.tenant_id}` },
        (payload) => {
          const settings = payload.new as { office_name?: string | null; cnpj?: string | null };
          setProfile((current) => ({
            ...current,
            companyName: settings.office_name ?? current.companyName,
            cnpj: settings.cnpj ?? current.cnpj,
          }));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [authProfile?.full_name, authProfile?.tenant_id, user]);

  const value = useMemo<UserProfileContextValue>(() => {
    const fullName = `${profile.firstName} ${profile.lastName}`.trim();
    return {
      ...profile,
      fullName,
      initials: fullName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "LT",
      updateProfile: (updates) => setProfile((current) => ({ ...current, ...updates })),
      saveProfile: async () => {
        if (!user || !authProfile?.tenant_id) return { ok: false, emailConfirmationRequired: false };

        const cpf = profile.cpf.replace(/\D/g, "");
        if (cpf && cpf.length !== 11) return { ok: false, emailConfirmationRequired: false };

        const { error: profileError } = await supabase
          .from("profiles")
          .update({ full_name: fullName || null, cpf: cpf || null, avatar_url: profile.avatarUrl || null })
          .eq("user_id", user.id)
          .eq("tenant_id", authProfile.tenant_id);
        if (profileError) return { ok: false, emailConfirmationRequired: false };

        const nextEmail = profile.email.trim().toLowerCase();
        if (nextEmail && nextEmail !== user.email?.toLowerCase()) {
          const { error: emailError } = await supabase.auth.updateUser({ email: nextEmail });
          if (emailError) return { ok: false, emailConfirmationRequired: false };
          return { ok: true, emailConfirmationRequired: true };
        }
        return { ok: true, emailConfirmationRequired: false };
      },
      uploadAvatar: async (file) => {
        if (!user || !authProfile?.tenant_id || authProfile.status !== "active") return false;
        if (!file.type.match(/^image\/(jpeg|png|webp)$/) || file.size > 2 * 1024 * 1024) return false;
        const extension = file.type.split("/")[1] === "jpeg" ? "jpg" : file.type.split("/")[1];
        const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
        if (uploadError) return false;
        const { data: publicUrl } = supabase.storage.from("avatars").getPublicUrl(path);
        const { error: profileError } = await supabase.rpc("update_own_avatar", {
          next_avatar_url: publicUrl.publicUrl,
        });
        if (profileError) return false;
        setProfile((current) => ({ ...current, avatarUrl: publicUrl.publicUrl }));
        return true;
      },
    };
  }, [authProfile?.status, authProfile?.tenant_id, profile, user]);

  return <UserProfileContext.Provider value={value}>{children}</UserProfileContext.Provider>;
};

export const useUserProfile = () => {
  const context = useContext(UserProfileContext);
  if (!context) throw new Error("useUserProfile must be used inside UserProfileProvider");
  return context;
};
