import { supabase } from "@/integrations/supabase/client";
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
  if (!params.connectionId) throw new Error("Salve a integração antes de testar.");
  const { data, error } = await supabase.functions.invoke("enqueue-integration-job", {
    body: { connectionId: params.connectionId },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error.message ?? "Falha ao enfileirar teste.");
  return data?.job as IntegrationJob | null;
};

export const enqueueIntegrationJobRequest = async (params: {
  connectionId?: string | null;
  jobType: "health_check" | "sync" | "statement_import" | "cnpj_lookup";
  cnpj?: string;
  from?: string;
  to?: string;
}) => {
  const { data, error } = await supabase.functions.invoke("enqueue-integration-job", {
    body: params,
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error.message ?? "Falha ao enfileirar job.");
  return data?.job as IntegrationJob | null;
};
