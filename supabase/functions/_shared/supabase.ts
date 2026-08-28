import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

export const createUserClient = (authorization: string | null) =>
  createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    {
      global: {
        headers: authorization ? { Authorization: authorization } : {},
      },
    },
  );

export const createServiceClient = () =>
  createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );
