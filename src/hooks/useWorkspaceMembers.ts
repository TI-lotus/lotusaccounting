import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useData } from "@/contexts/DataContext";

export type WorkspaceMemberDirectory = {
  userId: string;
  fullName: string;
  accountType: string;
  avatarUrl: string | null;
};

export const useWorkspaceMembers = () => {
  const { tenantId } = useData();
  const [members, setMembers] = useState<WorkspaceMemberDirectory[]>([]);

  const refresh = useCallback(async () => {
    if (!tenantId) {
      setMembers([]);
      return;
    }
    const { data, error } = await supabase.rpc("list_workspace_member_directory");
    if (error) {
      console.error("Could not load workspace member directory", error);
      return;
    }
    setMembers((data ?? []).map((member) => ({
      userId: member.user_id,
      fullName: member.full_name || "Membro da equipe",
      accountType: member.account_type,
      avatarUrl: member.avatar_url,
    })));
  }, [tenantId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const byUserId = useMemo(
    () => new Map(members.map((member) => [member.userId, member])),
    [members],
  );

  return { members, byUserId, refresh };
};
