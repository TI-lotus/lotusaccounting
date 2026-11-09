import { createContext, useCallback, useContext, useEffect, useMemo, useState, useRef } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Profile = {
  id?: string;
  user_id: string;
  full_name: string | null;
  phone: string | null;
  job_title: string | null;
  account_type: "admin" | "collaborator" | "client" | string;
  tenant_id: string | null;
  company_id: string | null;
  status: string;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  mfaRequired: boolean;
  profileError: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithProvider: (provider: "google" | "facebook") => Promise<void>;
  signUp: (params: { email: string; password: string; fullName: string; accountType: string; workspaceName?: string; inviteToken?: string; clientClaim?: boolean; cpf?: string }) => Promise<{ emailConfirmationRequired: boolean; sessionAvailable: boolean; accessToken?: string }>;
  signOut: () => Promise<void>;
  refreshMfaState: () => Promise<boolean>;
  refreshProfile: () => Promise<Profile | null>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const authRevision = useRef(0);

  const getMfaRequired = useCallback(async () => {
    const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
    if (factorsError) throw factorsError;

    if (!factors.totp.some((factor) => factor.status === "verified")) {
      return false;
    }

    const { data: assurance, error: assuranceError } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assuranceError) throw assuranceError;
    return assurance.currentLevel !== assurance.nextLevel;
  }, []);

  const loadProfileForSession = useCallback(async (targetSession: Session) => {
    const selectProfile = () => supabase.from("profiles").select("*")
      .eq("user_id", targetSession.user.id).maybeSingle();

    const [{ data, error }, needsMfa] = await Promise.all([
      selectProfile(),
      getMfaRequired(),
    ]);
    if (error) throw error;

    let nextProfile = data as Profile | null;
    const isClientClaim = targetSession.user.user_metadata?.client_claim === true
      || targetSession.user.user_metadata?.account_type === "client";

    if (!nextProfile && isClientClaim) {
      const { error: claimError } = await supabase.functions.invoke("claim-client-access", {
        headers: { Authorization: `Bearer ${targetSession.access_token}` },
      });
      if (claimError) throw claimError;
      const { data: claimedProfile, error: claimedError } = await selectProfile();
      if (claimedError) throw claimedError;
      nextProfile = claimedProfile as Profile | null;
    }

    if (!nextProfile) throw new Error("Seu perfil ainda não está disponível. Tente entrar novamente.");
    setProfile(nextProfile);
    setMfaRequired(needsMfa);
    setProfileError(null);
    return nextProfile;
  }, [getMfaRequired]);

  useEffect(() => {
    let disposed = false;

    const acceptSession = (nextSession: Session | null) => {
      const revision = ++authRevision.current;
      setSession(nextSession);
      setProfile(null);
      setProfileError(null);
      setMfaRequired(false);
      setLoading(Boolean(nextSession?.user));
      if (!nextSession?.user) return;
      // Run outside the auth callback to avoid locking the auth client.
      setTimeout(() => {
        void (async () => {
          try {
            const data = await loadProfileForSession(nextSession);
            if (!disposed && revision === authRevision.current) {
              setProfile(data);
            }
          } catch (error) {
            if (!disposed && revision === authRevision.current) {
              setProfileError(error instanceof Error ? error.message : "Não foi possível carregar seu perfil.");
            }
          } finally {
            if (!disposed && revision === authRevision.current) setLoading(false);
          }
        })();
      }, 0);
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, nextSession) => {
      if (!disposed) acceptSession(nextSession);
    });

    const initialRevision = authRevision.current;
    supabase.auth.getSession().then(({ data, error }) => {
      if (disposed || initialRevision !== authRevision.current) return;
      if (error) {
        setProfileError(error.message);
        setLoading(false);
        return;
      }
      acceptSession(data.session);
    });
    return () => { disposed = true; subscription.unsubscribe(); };
  }, [loadProfileForSession]);

  const refreshMfaState = async () => {
    if (!session) {
      setMfaRequired(false);
      return false;
    }
    try {
      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) throw factorsError;
      if (!factors.totp.some((factor) => factor.status === "verified")) {
        setMfaRequired(false);
        return false;
      }
      const { data: assurance, error: assuranceError } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assuranceError) throw assuranceError;
      const required = assurance.currentLevel !== assurance.nextLevel;
      setMfaRequired(required);
      return required;
    } catch {
      // A disabled MFA provider must not block an otherwise valid session.
      setMfaRequired(false);
      return false;
    }
  };

  const refreshProfile = useCallback(async () => {
    if (!session) {
      setProfile(null);
      return null;
    }
    setLoading(true);
    try {
      return await loadProfileForSession(session);
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Não foi possível carregar seu perfil.");
      return null;
    } finally {
      setLoading(false);
    }
  }, [loadProfileForSession, session]);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user: session?.user ?? null,
    profile,
    loading,
    mfaRequired,
    profileError,
    signIn: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    signInWithProvider: async (provider) => {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
    },
    signUp: async ({ email, password, fullName, accountType, workspaceName, inviteToken, clientClaim }) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            full_name: fullName,
            account_type: accountType,
            workspace_name: workspaceName,
            invite_token: inviteToken,
            client_claim: clientClaim || undefined,
          },
        },
      });
      if (error) throw error;
      // Tenant, profile and admin role are created automatically by the
      // handle_new_user database trigger.
      return {
        emailConfirmationRequired: !data.session,
        sessionAvailable: Boolean(data.session),
        accessToken: data.session?.access_token,
      };
    },
    signOut: async () => {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    },
    refreshMfaState,
    refreshProfile,
  }), [loading, mfaRequired, profile, profileError, refreshProfile, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
};
