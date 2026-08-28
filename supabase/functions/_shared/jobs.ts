import { createServiceClient } from "./supabase.ts";

type JobPayload = Record<string, unknown>;

export const enqueueIntegrationJob = async (params: {
  tenantId: string;
  connectionId?: string | null;
  jobType: string;
  payload?: JobPayload;
  priority?: number;
  scheduledFor?: string;
  maxAttempts?: number;
}) => {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("integration_jobs")
    .insert({
      tenant_id: params.tenantId,
      connection_id: params.connectionId ?? null,
      job_type: params.jobType,
      payload: params.payload ?? {},
      priority: params.priority ?? 100,
      scheduled_for: params.scheduledFor ?? new Date().toISOString(),
      max_attempts: params.maxAttempts ?? 3,
    })
    .select("*")
    .maybeSingle();

  if (error) throw error;
  return data;
};

export const claimNextIntegrationJob = async (workerId: string) => {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("claim_next_integration_job", {
    worker_id: workerId,
  });

  if (error) throw error;
  return Array.isArray(data) ? (data[0] ?? null) : null;
};

export const completeIntegrationJob = async (jobId: string) => {
  const supabase = createServiceClient();
  const { error } = await supabase.rpc("complete_integration_job", {
    job_id: jobId,
  });

  if (error) throw error;
};

export const failIntegrationJob = async (
  jobId: string,
  errorMessage: string,
) => {
  const supabase = createServiceClient();
  const { error } = await supabase.rpc("fail_integration_job", {
    job_id: jobId,
    error_message: errorMessage,
  });

  if (error) throw error;
};
