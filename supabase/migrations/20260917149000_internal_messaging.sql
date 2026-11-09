BEGIN;

-- Internal conversations have two explicit participants. Legacy shared threads
-- are intentionally excluded from the new private messaging flow.
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS recipient_id uuid REFERENCES public.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS conversations_internal_participants_idx
  ON public.conversations (tenant_id, created_by, recipient_id)
  WHERE channel = 'internal';

CREATE UNIQUE INDEX IF NOT EXISTS conversations_internal_pair_unique
  ON public.conversations (
    tenant_id,
    LEAST(created_by, recipient_id),
    GREATEST(created_by, recipient_id)
  )
  WHERE channel = 'internal' AND created_by IS NOT NULL AND recipient_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.guard_internal_conversation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender_profile public.profiles%ROWTYPE;
  recipient_profile public.profiles%ROWTYPE;
  responsible_user_id uuid;
BEGIN
  IF NEW.channel IS DISTINCT FROM 'internal' THEN
    RETURN NEW;
  END IF;

  IF NEW.created_by IS NULL OR NEW.recipient_id IS NULL OR NEW.created_by = NEW.recipient_id THEN
    RAISE EXCEPTION 'Internal conversations require two different participants' USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'UPDATE' AND (NEW.created_by, NEW.recipient_id, NEW.tenant_id, NEW.company_id)
    IS DISTINCT FROM (OLD.created_by, OLD.recipient_id, OLD.tenant_id, OLD.company_id) THEN
    RAISE EXCEPTION 'Conversation participants and scope cannot be changed' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO sender_profile
  FROM public.profiles
  WHERE user_id = NEW.created_by AND tenant_id = NEW.tenant_id AND status = 'active';
  SELECT * INTO recipient_profile
  FROM public.profiles
  WHERE user_id = NEW.recipient_id AND tenant_id = NEW.tenant_id AND status = 'active';

  IF sender_profile.user_id IS NULL OR recipient_profile.user_id IS NULL THEN
    RAISE EXCEPTION 'Conversation participants must be active in this workspace' USING ERRCODE = '23514';
  END IF;

  IF sender_profile.account_type = 'client' THEN
    IF NEW.company_id IS DISTINCT FROM sender_profile.company_id
      OR recipient_profile.account_type NOT IN ('admin', 'collaborator') THEN
      RAISE EXCEPTION 'Clients may only message their assigned responsible collaborator' USING ERRCODE = '42501';
    END IF;
    SELECT company.responsible_user_id INTO responsible_user_id
    FROM public.companies company
    WHERE id = sender_profile.company_id AND tenant_id = NEW.tenant_id;
    IF responsible_user_id IS DISTINCT FROM NEW.recipient_id THEN
      RAISE EXCEPTION 'Clients may only message their assigned responsible collaborator' USING ERRCODE = '42501';
    END IF;
  ELSIF sender_profile.account_type IN ('admin', 'collaborator') THEN
    IF NEW.company_id IS NOT NULL OR recipient_profile.account_type NOT IN ('admin', 'collaborator') THEN
      RAISE EXCEPTION 'Office users may only message active workspace collaborators' USING ERRCODE = '42501';
    END IF;
  ELSE
    RAISE EXCEPTION 'Unsupported messaging role' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_internal_conversation ON public.conversations;
CREATE TRIGGER guard_internal_conversation
BEFORE INSERT OR UPDATE ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.guard_internal_conversation();

CREATE OR REPLACE FUNCTION public.is_internal_conversation_participant(conversation_row public.conversations)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT conversation_row.channel = 'internal'
    AND auth.uid() IN (conversation_row.created_by, conversation_row.recipient_id)
$$;

DROP POLICY IF EXISTS internal_conversation_participant_guard ON public.conversations;
CREATE POLICY internal_conversation_participant_guard ON public.conversations
AS RESTRICTIVE FOR ALL TO authenticated
USING (public.is_internal_conversation_participant(conversations))
WITH CHECK (
  channel = 'internal'
  AND created_by = auth.uid()
  AND public.is_internal_conversation_participant(conversations)
);

DROP POLICY IF EXISTS internal_message_participant_guard ON public.messages;
CREATE POLICY internal_message_participant_guard ON public.messages
AS RESTRICTIVE FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.conversations conversation
    WHERE conversation.id = messages.conversation_id
      AND conversation.tenant_id = messages.tenant_id
      AND conversation.company_id IS NOT DISTINCT FROM messages.company_id
      AND public.is_internal_conversation_participant(conversation)
  )
)
WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.conversations conversation
    WHERE conversation.id = messages.conversation_id
      AND conversation.tenant_id = messages.tenant_id
      AND conversation.company_id IS NOT DISTINCT FROM messages.company_id
      AND public.is_internal_conversation_participant(conversation)
  )
);

-- Prevent an internal staff record from becoming a client account through
-- the generic profile editor. Client access continues to be created by invite.
CREATE OR REPLACE FUNCTION public.guard_internal_member_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'authenticated'
    AND OLD.account_type IN ('admin', 'collaborator')
    AND NEW.account_type = 'client' THEN
    RAISE EXCEPTION 'A collaborator can only be a collaborator or administrator' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_internal_member_role ON public.profiles;
CREATE TRIGGER guard_internal_member_role
BEFORE UPDATE OF account_type ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_internal_member_role();

CREATE TABLE IF NOT EXISTS public.user_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'message',
  title text NOT NULL,
  body text,
  href text NOT NULL DEFAULT '/messages',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_notifications_inbox_idx
  ON public.user_notifications (user_id, read_at, created_at DESC);

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;
GRANT SELECT, UPDATE ON public.user_notifications TO authenticated;

DROP POLICY IF EXISTS user_notifications_owner_access ON public.user_notifications;
CREATE POLICY user_notifications_owner_access ON public.user_notifications
FOR ALL TO authenticated
USING (user_id = auth.uid() AND tenant_id = public.current_user_tenant_id())
WITH CHECK (user_id = auth.uid() AND tenant_id = public.current_user_tenant_id());

CREATE OR REPLACE FUNCTION public.notify_internal_message_recipient()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conversation_row public.conversations%ROWTYPE;
  recipient uuid;
  sender_name text;
BEGIN
  SELECT * INTO conversation_row FROM public.conversations WHERE id = NEW.conversation_id;
  IF conversation_row.id IS NULL OR conversation_row.channel IS DISTINCT FROM 'internal' THEN
    RETURN NEW;
  END IF;

  recipient := CASE
    WHEN NEW.sender_id = conversation_row.created_by THEN conversation_row.recipient_id
    WHEN NEW.sender_id = conversation_row.recipient_id THEN conversation_row.created_by
    ELSE NULL
  END;
  IF recipient IS NULL THEN RETURN NEW; END IF;

  SELECT COALESCE(NULLIF(full_name, ''), 'Um membro da equipe') INTO sender_name
  FROM public.profiles WHERE user_id = NEW.sender_id AND tenant_id = NEW.tenant_id;

  INSERT INTO public.user_notifications (tenant_id, user_id, kind, title, body, href, metadata)
  VALUES (
    NEW.tenant_id,
    recipient,
    'message',
    COALESCE(sender_name, 'Nova mensagem'),
    left(COALESCE(NEW.message, ''), 180),
    '/messages',
    jsonb_build_object('conversation_id', NEW.conversation_id, 'message_id', NEW.id)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_internal_message_recipient ON public.messages;
CREATE TRIGGER notify_internal_message_recipient
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.notify_internal_message_recipient();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_publication WHERE pubname = 'supabase_realtime') AND NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_publication WHERE pubname = 'supabase_realtime') AND NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'user_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notifications;
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.guard_internal_conversation(), public.is_internal_conversation_participant(public.conversations), public.guard_internal_member_role(), public.notify_internal_message_recipient() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_internal_conversation_participant(public.conversations) TO authenticated;

COMMIT;
