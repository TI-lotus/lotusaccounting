DROP POLICY IF EXISTS "Users can update themselves" ON public.users;

CREATE POLICY "Users can update themselves"
ON public.users
FOR UPDATE
TO authenticated
USING ((auth.uid() = id) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    auth.uid() = id
    AND tenant_id IS NOT DISTINCT FROM public.current_user_tenant_id()
    AND role IS NOT DISTINCT FROM (
      SELECT ur.role::text
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      ORDER BY CASE WHEN ur.role = 'admin'::app_role THEN 1 ELSE 2 END
      LIMIT 1
    )
  )
);