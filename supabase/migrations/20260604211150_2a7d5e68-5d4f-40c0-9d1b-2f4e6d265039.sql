
-- 1) Ensure profiles.user_id is unique, then make tenant lookup deterministic
DELETE FROM public.profiles a
USING public.profiles b
WHERE a.ctid < b.ctid AND a.user_id = b.user_id;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_user_id_unique ON public.profiles(user_id);

CREATE OR REPLACE FUNCTION public.current_user_tenant_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT tenant_id
  FROM public.profiles
  WHERE user_id = auth.uid()
  ORDER BY created_at ASC
  LIMIT 1
$$;

-- 2) Fix OR-based policies on documents/tasks/messages → require tenant AND ownership
DROP POLICY IF EXISTS "Users can create tenant documents" ON public.documents;
DROP POLICY IF EXISTS "Users can update tenant documents" ON public.documents;
DROP POLICY IF EXISTS "Users can view tenant documents" ON public.documents;

CREATE POLICY "Users can view tenant documents" ON public.documents
FOR SELECT TO authenticated
USING (tenant_id = public.current_user_tenant_id() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can create tenant documents" ON public.documents
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (tenant_id = public.current_user_tenant_id() AND uploaded_by = auth.uid())
);

CREATE POLICY "Users can update tenant documents" ON public.documents
FOR UPDATE TO authenticated
USING (tenant_id = public.current_user_tenant_id() OR public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (tenant_id = public.current_user_tenant_id() AND uploaded_by = auth.uid())
);

DROP POLICY IF EXISTS "Users can create tenant tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can update assigned tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can view tenant tasks" ON public.tasks;

CREATE POLICY "Users can view tenant tasks" ON public.tasks
FOR SELECT TO authenticated
USING (tenant_id = public.current_user_tenant_id() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can create tenant tasks" ON public.tasks
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (tenant_id = public.current_user_tenant_id())
);

CREATE POLICY "Users can update assigned tasks" ON public.tasks
FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (tenant_id = public.current_user_tenant_id() AND (assigned_to = auth.uid() OR assigned_to IS NULL))
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (tenant_id = public.current_user_tenant_id())
);

DROP POLICY IF EXISTS "Users can create tenant messages" ON public.messages;
DROP POLICY IF EXISTS "Users can update own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can view tenant messages" ON public.messages;

CREATE POLICY "Users can view tenant messages" ON public.messages
FOR SELECT TO authenticated
USING (tenant_id = public.current_user_tenant_id() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can create tenant messages" ON public.messages
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (tenant_id = public.current_user_tenant_id() AND sender_id = auth.uid())
);

CREATE POLICY "Users can update own messages" ON public.messages
FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (tenant_id = public.current_user_tenant_id() AND sender_id = auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (tenant_id = public.current_user_tenant_id() AND sender_id = auth.uid())
);

-- 3) Prevent tenant hijacking on public.users
DROP POLICY IF EXISTS "Users can update themselves" ON public.users;
CREATE POLICY "Users can update themselves" ON public.users
FOR UPDATE TO authenticated
USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (
    auth.uid() = id
    AND tenant_id IS NOT DISTINCT FROM (SELECT u.tenant_id FROM public.users u WHERE u.id = auth.uid())
    AND role IS NOT DISTINCT FROM (SELECT u.role FROM public.users u WHERE u.id = auth.uid())
  )
);

-- 4) Restrictive policy blocking self-assignment of privileged roles in user_roles
DROP POLICY IF EXISTS "Block self-elevation to privileged roles" ON public.user_roles;
CREATE POLICY "Block self-elevation to privileged roles" ON public.user_roles
AS RESTRICTIVE
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR role = 'client'::app_role
);

-- 5) Lock down EXECUTE on helper functions (RLS still uses them via SECURITY DEFINER)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_tenant_id() FROM PUBLIC, anon;
