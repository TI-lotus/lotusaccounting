BEGIN;

-- Legacy RLS policies still call has_role(auth.uid(), ...). The helper had
-- been revoked from authenticated users, which made otherwise valid reads
-- fail with "permission denied for function has_role". Keep the function
-- callable by authenticated users, but never let it answer about another ID.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = _user_id
        AND role = _role
    )
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- Let already signed-in staff receive company and office-setting changes from
-- their own workspace. These tables remain protected by their existing RLS.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.companies;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;

    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_settings;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
EXCEPTION WHEN undefined_table OR feature_not_supported THEN
  -- The focused PGlite security fixture has no logical replication support.
  NULL;
END;
$$;

COMMIT;
