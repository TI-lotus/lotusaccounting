import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { IntegrationJob } from "./types";

export const listIntegrationJobs = async (connectionId?: string) => {
  let query = supabase
    .from("integration_jobs")
    .select("*")
    .order("scheduled_for", { ascending: true })
    .limit(100);

  if (connectionId) query = query.eq("connection_id", connectionId);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as IntegrationJob[];
};

export const enqueueHealthCheckJob = async (params: {
  tenantId: string;
  connectionId?: string | null;
  provider: string;
}) => {
  const { data, error } = await supabase
    .from("integration_jobs")
    .insert({
      tenant_id: params.tenantId,
      connection_id: params.connectionId ?? null,
      job_type: "health_check",
      payload: { provider: params.provider } as Json,
      priority: 10,
    })
    .select("*")
    .maybeSingle();

  if (error) throw error;
  return data as IntegrationJob | null;
};
