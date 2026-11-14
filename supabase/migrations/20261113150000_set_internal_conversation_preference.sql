-- Update only the inbox preferences of an internal conversation.
-- This avoids exposing the conversation mutation through a generic client-side
-- UPDATE while keeping participant and workspace checks in one place.
CREATE OR REPLACE FUNCTION public.set_internal_conversation_preference(
  target_conversation_id uuid,
  next_is_pinned boolean DEFAULT NULL,
  next_is_archived boolean DEFAULT NULL
)
RETURNS public.conversations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conversation_row public.conversations%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT conversation.*
  INTO conversation_row
  FROM public.conversations conversation
  WHERE conversation.id = target_conversation_id
    AND conversation.tenant_id = public.current_user_tenant_id()
    AND public.is_internal_conversation_participant(conversation);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversation not found or access denied' USING ERRCODE = '42501';
  END IF;

  UPDATE public.conversations
  SET
    is_pinned = COALESCE(next_is_pinned, is_pinned),
    is_archived = COALESCE(next_is_archived, is_archived)
  WHERE id = target_conversation_id
  RETURNING * INTO conversation_row;

  RETURN conversation_row;
END;
$$;

REVOKE ALL ON FUNCTION public.set_internal_conversation_preference(uuid, boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_internal_conversation_preference(uuid, boolean, boolean) TO authenticated;
