import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type PermissionResource = "clients" | "tasks" | "payments" | "documents" | "reports" | "integrations";
type PermissionAction = "read" | "create" | "update" | "delete";
type PermissionMap = Partial<Record<PermissionResource, Partial<Record<PermissionAction, boolean>>>>;

type UseWorkspacePermissionParams = {
  tenantId: string | null;
  userId: string | undefined;
  accountType: string | undefined;
  resource: PermissionResource;
  action: PermissionAction;
};

export const useWorkspacePermission = ({
  tenantId,
  userId,
  accountType,
  resource,
  action,
}: UseWorkspacePermissionParams) => {
  const [allowed, setAllowed] = useState(accountType === "admin");

  useEffect(() => {
    let active = true;

    if (accountType === "admin") {
      setAllowed(true);
      return () => { active = false; };
    }

    if (accountType !== "collaborator" || !tenantId || !userId) {
      setAllowed(false);
      return () => { active = false; };
    }

    setAllowed(false);
    void supabase
      .from("workspace_member_permissions")
      .select("permissions")
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        const permissions = data?.permissions as PermissionMap | null | undefined;
        setAllowed(permissions?.[resource]?.[action] === true);
      });

    return () => { active = false; };
  }, [accountType, action, resource, tenantId, userId]);

  return allowed;
};
