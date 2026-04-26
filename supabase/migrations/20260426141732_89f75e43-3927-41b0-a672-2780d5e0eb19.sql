CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view themselves" ON public.users;
CREATE POLICY "Users can view themselves"
ON public.users
FOR SELECT
TO authenticated
USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can update themselves" ON public.users;
CREATE POLICY "Users can update themselves"
ON public.users
FOR UPDATE
TO authenticated
USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can insert themselves" ON public.users;
CREATE POLICY "Users can insert themselves"
ON public.users
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can delete users" ON public.users;
CREATE POLICY "Admins can delete users"
ON public.users
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can create their client role" ON public.user_roles;
CREATE POLICY "Users can create their client role"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND role = 'client');

DROP POLICY IF EXISTS "Users can view their tenant" ON public.tenants;
CREATE POLICY "Users can view their tenant"
ON public.tenants
FOR SELECT
TO authenticated
USING (id = public.current_user_tenant_id() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can manage tenants" ON public.tenants;
CREATE POLICY "Admins can manage tenants"
ON public.tenants
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can view tenant documents" ON public.documents;
CREATE POLICY "Users can view tenant documents"
ON public.documents
FOR SELECT
TO authenticated
USING (tenant_id = public.current_user_tenant_id() OR uploaded_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can create tenant documents" ON public.documents;
CREATE POLICY "Users can create tenant documents"
ON public.documents
FOR INSERT
TO authenticated
WITH CHECK (tenant_id = public.current_user_tenant_id() OR uploaded_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can update tenant documents" ON public.documents;
CREATE POLICY "Users can update tenant documents"
ON public.documents
FOR UPDATE
TO authenticated
USING (tenant_id = public.current_user_tenant_id() OR uploaded_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (tenant_id = public.current_user_tenant_id() OR uploaded_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete documents" ON public.documents;
CREATE POLICY "Admins can delete documents"
ON public.documents
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can view tenant messages" ON public.messages;
CREATE POLICY "Users can view tenant messages"
ON public.messages
FOR SELECT
TO authenticated
USING (tenant_id = public.current_user_tenant_id() OR sender_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can create tenant messages" ON public.messages;
CREATE POLICY "Users can create tenant messages"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (tenant_id = public.current_user_tenant_id() OR sender_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can update own messages" ON public.messages;
CREATE POLICY "Users can update own messages"
ON public.messages
FOR UPDATE
TO authenticated
USING (sender_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (sender_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete messages" ON public.messages;
CREATE POLICY "Admins can delete messages"
ON public.messages
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can view tenant tasks" ON public.tasks;
CREATE POLICY "Users can view tenant tasks"
ON public.tasks
FOR SELECT
TO authenticated
USING (tenant_id = public.current_user_tenant_id() OR assigned_to = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can create tenant tasks" ON public.tasks;
CREATE POLICY "Users can create tenant tasks"
ON public.tasks
FOR INSERT
TO authenticated
WITH CHECK (tenant_id = public.current_user_tenant_id() OR assigned_to = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can update assigned tasks" ON public.tasks;
CREATE POLICY "Users can update assigned tasks"
ON public.tasks
FOR UPDATE
TO authenticated
USING (tenant_id = public.current_user_tenant_id() OR assigned_to = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (tenant_id = public.current_user_tenant_id() OR assigned_to = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete tasks" ON public.tasks;
CREATE POLICY "Admins can delete tasks"
ON public.tasks
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can create their own profile as client" ON public.profiles;
CREATE POLICY "Users can create their own profile as client"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND account_type = 'client');