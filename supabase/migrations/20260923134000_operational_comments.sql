BEGIN;

CREATE TABLE IF NOT EXISTS public.operational_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('task', 'checklist_item', 'client_period', 'fiscal_obligation')),
  target_id uuid NOT NULL,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body text NOT NULL CHECK (length(trim(body)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_operational_comments_tenant_target
ON public.operational_comments(tenant_id, target_type, target_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_operational_comments_company
ON public.operational_comments(tenant_id, company_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.touch_operational_comments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_operational_comment_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_row record;
BEGIN
  IF NEW.author_id IS NULL THEN
    NEW.author_id := auth.uid();
  END IF;

  IF NEW.author_id IS NOT NULL AND NOT public.profile_belongs_to_current_workspace(NEW.author_id) THEN
    RAISE EXCEPTION 'Comment author must belong to the current workspace' USING ERRCODE = '23514';
  END IF;

  IF NEW.target_type = 'task' THEN
    SELECT tenant_id, company_id INTO target_row
    FROM public.tasks
    WHERE id = NEW.target_id;
  ELSIF NEW.target_type = 'checklist_item' THEN
    SELECT tenant_id, company_id INTO target_row
    FROM public.client_period_checklist_items
    WHERE id = NEW.target_id;
  ELSIF NEW.target_type = 'client_period' THEN
    SELECT tenant_id, company_id INTO target_row
    FROM public.client_periods
    WHERE id = NEW.target_id;
  ELSIF NEW.target_type = 'fiscal_obligation' THEN
    SELECT tenant_id, company_id INTO target_row
    FROM public.fiscal_obligations
    WHERE id = NEW.target_id;
  END IF;

  IF target_row.tenant_id IS NULL THEN
    RAISE EXCEPTION 'Comment target not found' USING ERRCODE = '23503';
  END IF;

  IF NEW.tenant_id IS DISTINCT FROM target_row.tenant_id THEN
    RAISE EXCEPTION 'Comment must stay in the target workspace' USING ERRCODE = '23514';
  END IF;

  IF NEW.company_id IS NULL THEN
    NEW.company_id := target_row.company_id;
  ELSIF NEW.company_id IS DISTINCT FROM target_row.company_id THEN
    RAISE EXCEPTION 'Comment must stay in the target company' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_operational_comments ON public.operational_comments;
CREATE TRIGGER touch_operational_comments
BEFORE UPDATE ON public.operational_comments
FOR EACH ROW EXECUTE FUNCTION public.touch_operational_comments();

DROP TRIGGER IF EXISTS ensure_operational_comment_scope ON public.operational_comments;
CREATE TRIGGER ensure_operational_comment_scope
BEFORE INSERT OR UPDATE OF tenant_id, company_id, target_type, target_id, author_id ON public.operational_comments
FOR EACH ROW EXECUTE FUNCTION public.ensure_operational_comment_scope();

ALTER TABLE public.operational_comments ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operational_comments TO authenticated;

CREATE POLICY operational_comments_select ON public.operational_comments
FOR SELECT TO authenticated
USING (
  tenant_id = public.current_user_tenant_id()
  AND public.can_manage_current_tenant()
);

CREATE POLICY operational_comments_insert ON public.operational_comments
FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = public.current_user_tenant_id()
  AND public.can_manage_current_tenant()
  AND author_id = auth.uid()
);

CREATE POLICY operational_comments_update_own ON public.operational_comments
FOR UPDATE TO authenticated
USING (
  tenant_id = public.current_user_tenant_id()
  AND public.can_manage_current_tenant()
  AND author_id = auth.uid()
)
WITH CHECK (
  tenant_id = public.current_user_tenant_id()
  AND public.can_manage_current_tenant()
  AND author_id = auth.uid()
);

CREATE POLICY operational_comments_delete_admin ON public.operational_comments
FOR DELETE TO authenticated
USING (
  tenant_id = public.current_user_tenant_id()
  AND public.current_user_account_type() = 'admin'
);

CREATE POLICY operational_comments_collaborator_read_permission ON public.operational_comments AS RESTRICTIVE
FOR SELECT TO authenticated
USING (
  public.current_user_account_type() <> 'collaborator'
  OR public.has_workspace_permission('tasks', 'read')
  OR public.has_workspace_permission('clients', 'read')
);

CREATE POLICY operational_comments_collaborator_insert_permission ON public.operational_comments AS RESTRICTIVE
FOR INSERT TO authenticated
WITH CHECK (
  public.current_user_account_type() <> 'collaborator'
  OR public.has_workspace_permission('tasks', 'update')
  OR public.has_workspace_permission('clients', 'update')
);

CREATE POLICY operational_comments_collaborator_update_permission ON public.operational_comments AS RESTRICTIVE
FOR UPDATE TO authenticated
USING (
  public.current_user_account_type() <> 'collaborator'
  OR public.has_workspace_permission('tasks', 'update')
  OR public.has_workspace_permission('clients', 'update')
)
WITH CHECK (
  public.current_user_account_type() <> 'collaborator'
  OR public.has_workspace_permission('tasks', 'update')
  OR public.has_workspace_permission('clients', 'update')
);

REVOKE ALL ON FUNCTION public.touch_operational_comments() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ensure_operational_comment_scope() FROM PUBLIC, anon, authenticated;

COMMIT;
