CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_tenant_id uuid;
  display_name text;
  workspace_name text;
  assigned_role public.app_role;
  invite_record public.invites%ROWTYPE;
  invite_token text;
  client_claim_requested boolean;
BEGIN
  display_name := COALESCE(NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'full_name', '')), ''), split_part(NEW.email, '@', 1));
  invite_token := NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'invite_token', '')), '');
  client_claim_requested :=
    lower(COALESCE(NEW.raw_user_meta_data->>'client_claim', 'false')) IN ('true', '1', 'yes')
    OR lower(COALESCE(NEW.raw_user_meta_data->>'account_type', '')) = 'client';

  IF invite_token IS NOT NULL THEN
    SELECT * INTO invite_record
    FROM public.invites
    WHERE token = invite_token
      AND lower(email) = lower(NEW.email)
      AND status = 'pending'
      AND expires_at > now()
    FOR UPDATE;

    IF invite_record.id IS NULL THEN
      RAISE EXCEPTION 'Invitation is invalid, expired, revoked, or for another email' USING ERRCODE = '42501';
    END IF;
    IF invite_record.account_type = 'client' AND invite_record.company_id IS NULL THEN
      RAISE EXCEPTION 'Client invitation is missing a company' USING ERRCODE = '23514';
    END IF;

    new_tenant_id := invite_record.tenant_id;
    assigned_role := invite_record.account_type::public.app_role;
    display_name := COALESCE(NULLIF(trim(invite_record.full_name), ''), display_name);
    UPDATE public.invites SET status = 'accepted', accepted_by = NEW.id, accepted_at = now() WHERE id = invite_record.id;
  ELSIF client_claim_requested THEN
    -- Client self-registration is linked after email authentication by the
    -- claim-client-access Edge Function. Do not create a new office workspace.
    RETURN NEW;
  ELSE
    workspace_name := COALESCE(NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'workspace_name', '')), ''), display_name || ' workspace');
    assigned_role := 'admin'::public.app_role;
    INSERT INTO public.tenants (name, owner_user_id) VALUES (workspace_name, NEW.id) RETURNING id INTO new_tenant_id;
  END IF;

  INSERT INTO public.users (id, tenant_id, name, role)
  VALUES (NEW.id, new_tenant_id, display_name, assigned_role::text)
  ON CONFLICT (id) DO UPDATE
  SET tenant_id = COALESCE(public.users.tenant_id, EXCLUDED.tenant_id),
      name = COALESCE(NULLIF(public.users.name, ''), EXCLUDED.name),
      role = EXCLUDED.role;

  INSERT INTO public.profiles (user_id, tenant_id, company_id, full_name, account_type, status)
  VALUES (NEW.id, new_tenant_id, invite_record.company_id, display_name, assigned_role::text, 'active')
  ON CONFLICT (user_id) DO UPDATE
  SET tenant_id = COALESCE(public.profiles.tenant_id, EXCLUDED.tenant_id),
      company_id = COALESCE(public.profiles.company_id, EXCLUDED.company_id),
      full_name = COALESCE(NULLIF(public.profiles.full_name, ''), EXCLUDED.full_name),
      account_type = EXCLUDED.account_type,
      status = 'active';

  RETURN NEW;
END;
$$;
