BEGIN;

-- The legacy policy only allowed administrators to delete tasks. The
-- collaborator permission policy is restrictive, so it could narrow access
-- but never grant it. Replace the permissive policy with the actual matrix.
DROP POLICY IF EXISTS "Admins can delete tasks" ON public.tasks;
DROP POLICY IF EXISTS "Workspace members can delete permitted tasks" ON public.tasks;

CREATE POLICY "Workspace members can delete permitted tasks"
ON public.tasks
FOR DELETE TO authenticated
USING (
  tenant_id = public.current_user_tenant_id()
  AND (
    public.current_user_account_type() = 'admin'
    OR (
      public.current_user_account_type() = 'collaborator'
      AND public.has_workspace_permission('tasks', 'delete')
    )
  )
);

COMMIT;
