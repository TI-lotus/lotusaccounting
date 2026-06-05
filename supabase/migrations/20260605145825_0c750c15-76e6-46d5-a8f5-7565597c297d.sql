
-- ============ TENANTS ============
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS owner_user_id uuid;

-- ============ COMPANIES ============
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS tax_regime text,
  ADD COLUMN IF NOT EXISTS service_fee numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS responsible_user_id uuid;

-- ============ TASKS ============
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_by uuid;

-- ============ DOCUMENTS ============
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS original_file_name text,
  ADD COLUMN IF NOT EXISTS amount numeric,
  ADD COLUMN IF NOT EXISTS doc_date date,
  ADD COLUMN IF NOT EXISTS month int,
  ADD COLUMN IF NOT EXISTS year int,
  ADD COLUMN IF NOT EXISTS read_at timestamptz,
  ADD COLUMN IF NOT EXISTS classified_automatically boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS classification_confidence numeric;

-- ============ PAYMENTS ============
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS direction text DEFAULT 'entrada',
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS company_id uuid;

-- ============ CONVERSATIONS ============
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS title text;

-- ============ Updated handle_new_user: auto tenant + profile + admin role ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_tenant_id uuid;
  display_name text;
BEGIN
  display_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));

  -- Create tenant for this user
  INSERT INTO public.tenants (name, owner_user_id)
  VALUES (display_name || ' workspace', NEW.id)
  RETURNING id INTO new_tenant_id;

  -- Mirror into public.users (kept for legacy)
  INSERT INTO public.users (id, tenant_id, name, role)
  VALUES (NEW.id, new_tenant_id, display_name, 'admin')
  ON CONFLICT (id) DO UPDATE SET tenant_id = EXCLUDED.tenant_id;

  -- Create profile linked to tenant
  INSERT INTO public.profiles (user_id, tenant_id, full_name, account_type, status)
  VALUES (NEW.id, new_tenant_id, display_name, 'admin', 'active')
  ON CONFLICT (user_id) DO UPDATE SET tenant_id = EXCLUDED.tenant_id;

  -- Grant admin role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Ensure profiles.user_id unique for ON CONFLICT
CREATE UNIQUE INDEX IF NOT EXISTS profiles_user_id_unique ON public.profiles(user_id);
