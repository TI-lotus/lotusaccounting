import { createServiceClient, createUserClient } from "./supabase.ts";
import type { AppRole } from "./types.ts";

export type AuthContext = {
  userId: string;
  tenantId: string;
  companyId: string | null;
  role: AppRole;
};

export const requireAuthContext = async (request: Request): Promise<AuthContext> => {
  const authorization = request.headers.get("Authorization");
  if (!authorization) throw new Error("missing_authorization");

  const supabase = createUserClient(authorization);
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error("invalid_authorization");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("tenant_id, company_id, account_type, status")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (profileError || !profile?.tenant_id) throw new Error("profile_not_found");
  if (profile.status !== "active") throw new Error("forbidden");

  return {
    userId: userData.user.id,
    tenantId: profile.tenant_id,
    companyId: profile.company_id ?? null,
    role: profile.account_type as AppRole,
  };
};

export const requireWorkspaceManager = (context: AuthContext) => {
  if (context.role !== "admin" && context.role !== "collaborator") {
    throw new Error("forbidden");
  }
};

/**
 * Checks the workspace permission that is also enforced by the database RLS
 * policies. Edge Functions use the service role after authentication, so they
 * must perform this check explicitly before mutating tenant data.
 */
export const requireWorkspacePermission = async (
  context: AuthContext,
  resource: string,
  action: string,
) => {
  if (context.role === "admin") return;
  if (context.role !== "collaborator") throw new Error("forbidden");

  const { data, error } = await createServiceClient()
    .from("workspace_member_permissions")
    .select("permissions")
    .eq("tenant_id", context.tenantId)
    .eq("user_id", context.userId)
    .maybeSingle();

  if (error) throw error;

  const permissions = data?.permissions;
  const allowed =
    permissions && typeof permissions === "object" && !Array.isArray(permissions)
      ? (permissions as Record<string, unknown>)[resource]
      : null;
  const value =
    allowed && typeof allowed === "object" && !Array.isArray(allowed)
      ? (allowed as Record<string, unknown>)[action]
      : false;

  if (value !== true) throw new Error("forbidden");
};
