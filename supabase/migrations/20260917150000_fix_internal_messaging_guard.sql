BEGIN;

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
    WHERE company.id = sender_profile.company_id AND company.tenant_id = NEW.tenant_id;
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

COMMIT;
