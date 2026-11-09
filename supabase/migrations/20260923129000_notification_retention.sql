BEGIN;

CREATE TABLE IF NOT EXISTS public.archived_user_notifications (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL,
  body text,
  href text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_archived_user_notifications_user_created
ON public.archived_user_notifications(user_id, created_at DESC);

ALTER TABLE public.archived_user_notifications ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.archived_user_notifications TO authenticated;

DROP POLICY IF EXISTS archived_user_notifications_select_own ON public.archived_user_notifications;
CREATE POLICY archived_user_notifications_select_own ON public.archived_user_notifications
FOR SELECT TO authenticated
USING (
  tenant_id = public.current_user_tenant_id()
  AND user_id = auth.uid()
);

CREATE OR REPLACE FUNCTION public.archive_old_user_notifications(retention_days integer DEFAULT 180)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  archived_count integer := 0;
BEGIN
  IF retention_days < 7 THEN
    RAISE EXCEPTION 'Notification retention must be at least 7 days';
  END IF;

  WITH moved AS (
    DELETE FROM public.user_notifications
    WHERE read_at IS NOT NULL
      AND read_at < now() - (retention_days * interval '1 day')
    RETURNING id, tenant_id, user_id, kind, title, body, href, metadata, read_at, created_at
  ),
  archived AS (
    INSERT INTO public.archived_user_notifications (
      id,
      tenant_id,
      user_id,
      kind,
      title,
      body,
      href,
      metadata,
      read_at,
      created_at
    )
    SELECT id, tenant_id, user_id, kind, title, body, href, metadata, read_at, created_at
    FROM moved
    ON CONFLICT (id) DO NOTHING
    RETURNING id
  )
  SELECT count(*) INTO archived_count FROM archived;

  RETURN archived_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.run_operational_notification_maintenance()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  synced_count integer;
  archived_count integer;
BEGIN
  SELECT public.sync_operational_alerts() INTO synced_count;
  SELECT public.archive_old_user_notifications(180) INTO archived_count;

  RETURN jsonb_build_object(
    'synced_alerts', synced_count,
    'archived_notifications', archived_count,
    'retention_days', 180,
    'ran_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.archive_old_user_notifications(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.run_operational_notification_maintenance() FROM PUBLIC, anon, authenticated;

COMMIT;
