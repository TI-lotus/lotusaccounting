-- Persist user-facing conversation list preferences for the internal inbox.
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS conversations_internal_preferences_idx
  ON public.conversations (tenant_id, is_archived, is_pinned, created_at DESC)
  WHERE channel = 'internal';

-- Participants can manage their own inbox state. Conversation membership and
-- scope remain protected by the existing trigger and tenant restrictions.
DROP POLICY IF EXISTS internal_conversation_participant_guard ON public.conversations;

CREATE POLICY internal_conversation_participant_select_guard ON public.conversations
AS RESTRICTIVE FOR SELECT TO authenticated
USING (public.is_internal_conversation_participant(conversations));

CREATE POLICY internal_conversation_participant_insert_guard ON public.conversations
AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (
  channel = 'internal'
  AND created_by = auth.uid()
  AND public.is_internal_conversation_participant(conversations)
);

CREATE POLICY internal_conversation_participant_update_guard ON public.conversations
AS RESTRICTIVE FOR UPDATE TO authenticated
USING (public.is_internal_conversation_participant(conversations))
WITH CHECK (
  channel = 'internal'
  AND public.is_internal_conversation_participant(conversations)
);

CREATE POLICY internal_conversation_participant_delete_guard ON public.conversations
AS RESTRICTIVE FOR DELETE TO authenticated
USING (public.is_internal_conversation_participant(conversations));
