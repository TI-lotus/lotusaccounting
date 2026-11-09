BEGIN;

-- A persisted delivery time means the message was accepted and routed by the
-- workspace backend. Read receipts are only written by the recipient through
-- the guarded RPC below.
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS read_at timestamptz;

UPDATE public.messages
SET delivered_at = COALESCE(delivered_at, created_at, now())
WHERE delivered_at IS NULL;

CREATE INDEX IF NOT EXISTS messages_conversation_read_idx
  ON public.messages (conversation_id, sender_id, read_at)
  WHERE read_at IS NULL;

CREATE OR REPLACE FUNCTION public.mark_internal_conversation_read(target_conversation_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  marked_count integer;
BEGIN
  IF target_conversation_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.conversations conversation
    WHERE conversation.id = target_conversation_id
      AND conversation.tenant_id = public.current_user_tenant_id()
      AND public.is_internal_conversation_participant(conversation)
  ) THEN
    RAISE EXCEPTION 'Conversation is not available to this user' USING ERRCODE = '42501';
  END IF;

  UPDATE public.messages
  SET read_at = now()
  WHERE conversation_id = target_conversation_id
    AND tenant_id = public.current_user_tenant_id()
    AND sender_id IS DISTINCT FROM auth.uid()
    AND read_at IS NULL;
  GET DIAGNOSTICS marked_count = ROW_COUNT;

  UPDATE public.user_notifications
  SET read_at = now()
  WHERE user_id = auth.uid()
    AND tenant_id = public.current_user_tenant_id()
    AND kind = 'message'
    AND read_at IS NULL
    AND metadata ->> 'conversation_id' = target_conversation_id::text;

  RETURN marked_count;
END;
$$;

-- Return only the directory fields needed for avatars and direct messaging.
-- This lets a client see the assigned responsible person's public profile
-- without exposing CPF, phone, or the full profiles table.
CREATE OR REPLACE FUNCTION public.list_workspace_member_directory()
RETURNS TABLE (
  user_id uuid,
  full_name text,
  account_type text,
  avatar_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.full_name, p.account_type, p.avatar_url
  FROM public.profiles p
  WHERE p.tenant_id = public.current_user_tenant_id()
    AND p.status = 'active'
    AND (
      (
        public.current_user_account_type() IN ('admin', 'collaborator')
        AND p.account_type IN ('admin', 'collaborator', 'client')
      )
      OR (
        public.current_user_account_type() = 'client'
        AND p.user_id = (
          SELECT c.responsible_user_id
          FROM public.companies c
          WHERE c.id = public.current_user_company_id()
            AND c.tenant_id = public.current_user_tenant_id()
        )
      )
    )
  ORDER BY p.full_name NULLS LAST;
$$;

-- A photo is a cosmetic profile field. Every active user may update only the
-- URL of their own photo; identity fields remain administrator-controlled.
CREATE OR REPLACE FUNCTION public.update_own_avatar(next_avatar_url text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_url text;
BEGIN
  IF public.current_user_tenant_id() IS NULL THEN
    RAISE EXCEPTION 'Active workspace membership is required' USING ERRCODE = '42501';
  END IF;

  IF next_avatar_url IS NOT NULL
    AND next_avatar_url !~ '^https://[^/]+/storage/v1/object/public/avatars/' THEN
    RAISE EXCEPTION 'Invalid avatar URL' USING ERRCODE = '22023';
  END IF;

  UPDATE public.profiles
  SET avatar_url = NULLIF(next_avatar_url, '')
  WHERE user_id = auth.uid()
    AND tenant_id = public.current_user_tenant_id()
  RETURNING avatar_url INTO updated_url;

  RETURN updated_url;
END;
$$;

DROP POLICY IF EXISTS avatars_admin_upload ON storage.objects;
DROP POLICY IF EXISTS avatars_admin_update ON storage.objects;
DROP POLICY IF EXISTS avatars_admin_delete ON storage.objects;

CREATE POLICY avatars_owner_upload ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND split_part(name, '/', 1) = auth.uid()::text
  AND public.current_user_tenant_id() IS NOT NULL
);

CREATE POLICY avatars_owner_update ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'avatars'
  AND split_part(name, '/', 1) = auth.uid()::text
  AND public.current_user_tenant_id() IS NOT NULL
)
WITH CHECK (
  bucket_id = 'avatars'
  AND split_part(name, '/', 1) = auth.uid()::text
  AND public.current_user_tenant_id() IS NOT NULL
);

CREATE POLICY avatars_owner_delete ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'avatars'
  AND split_part(name, '/', 1) = auth.uid()::text
  AND public.current_user_tenant_id() IS NOT NULL
);

REVOKE ALL ON FUNCTION public.mark_internal_conversation_read(uuid), public.list_workspace_member_directory(), public.update_own_avatar(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_internal_conversation_read(uuid), public.list_workspace_member_directory(), public.update_own_avatar(text) TO authenticated;

COMMIT;
