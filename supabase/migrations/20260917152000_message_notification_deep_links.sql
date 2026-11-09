BEGIN;

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
    format('/messages?conversation=%s', NEW.conversation_id),
    jsonb_build_object('conversation_id', NEW.conversation_id, 'message_id', NEW.id)
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_internal_message_recipient() FROM PUBLIC, anon, authenticated;

COMMIT;
