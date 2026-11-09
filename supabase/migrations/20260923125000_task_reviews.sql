BEGIN;

CREATE TABLE IF NOT EXISTS public.task_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  reviewer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'approved', 'rejected')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_reviews_tenant_status
ON public.task_reviews(tenant_id, status, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_task_reviews_task
ON public.task_reviews(task_id, requested_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS task_reviews_one_pending_per_task
ON public.task_reviews(task_id)
WHERE status = 'pending_review';

CREATE OR REPLACE FUNCTION public.touch_task_reviews()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.status IN ('approved', 'rejected') AND NEW.reviewed_at IS NULL THEN
    NEW.reviewed_at := now();
  ELSIF NEW.status = 'pending_review' THEN
    NEW.reviewed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_task_review_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  task_row record;
BEGIN
  SELECT id, tenant_id INTO task_row
  FROM public.tasks
  WHERE id = NEW.task_id;

  IF task_row.id IS NULL THEN
    RAISE EXCEPTION 'Review task not found' USING ERRCODE = '23503';
  END IF;

  IF NEW.tenant_id IS DISTINCT FROM task_row.tenant_id THEN
    RAISE EXCEPTION 'Task review must stay in the task workspace' USING ERRCODE = '23514';
  END IF;

  IF NEW.reviewer_id IS NOT NULL AND NOT public.profile_belongs_to_current_workspace(NEW.reviewer_id) THEN
    RAISE EXCEPTION 'Reviewer must belong to the current workspace' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_task_review_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'pending_review' THEN
    UPDATE public.client_period_checklist_items
    SET status = 'in_review'
    WHERE task_id = NEW.task_id
      AND requires_review = true
      AND status <> 'waived';

    UPDATE public.tasks
    SET status = 'in_progress', completed_at = NULL
    WHERE id = NEW.task_id
      AND status = 'completed';
  ELSIF NEW.status = 'approved' THEN
    UPDATE public.client_period_checklist_items
    SET status = 'completed'
    WHERE task_id = NEW.task_id
      AND requires_review = true
      AND status <> 'waived';

    UPDATE public.tasks
    SET status = 'completed', completed_at = COALESCE(completed_at, now())
    WHERE id = NEW.task_id;
  ELSIF NEW.status = 'rejected' THEN
    UPDATE public.client_period_checklist_items
    SET status = 'in_progress'
    WHERE task_id = NEW.task_id
      AND requires_review = true
      AND status <> 'waived';

    UPDATE public.tasks
    SET status = 'in_progress', completed_at = NULL
    WHERE id = NEW.task_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_task_review_from_checklist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.requires_review = true
    AND NEW.task_id IS NOT NULL
    AND NEW.status = 'in_review'
    AND (TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status)
  THEN
    INSERT INTO public.task_reviews (tenant_id, task_id, reviewer_id, status)
    VALUES (NEW.tenant_id, NEW.task_id, NULL, 'pending_review')
    ON CONFLICT (task_id) WHERE status = 'pending_review'
    DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_checklist_item_from_task_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    UPDATE public.client_period_checklist_items item
    SET status = CASE
      WHEN NEW.status = 'completed'
        AND item.requires_review = true
        AND NOT EXISTS (
          SELECT 1
          FROM public.task_reviews review
          WHERE review.task_id = NEW.id
            AND review.status = 'approved'
        )
        THEN 'in_review'
      WHEN NEW.status = 'completed' THEN 'completed'
      WHEN NEW.status = 'in_progress'
        AND EXISTS (
          SELECT 1
          FROM public.task_reviews review
          WHERE review.task_id = NEW.id
            AND review.status = 'pending_review'
        )
        THEN 'in_review'
      WHEN NEW.status = 'in_progress' THEN 'in_progress'
      ELSE 'pending'
    END
    WHERE item.task_id = NEW.id
      AND item.status <> 'waived';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.block_period_close_with_pending_reviews()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'closed' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF EXISTS (
      SELECT 1
      FROM public.client_period_checklist_items item
      JOIN public.task_reviews review ON review.task_id = item.task_id
      WHERE item.client_period_id = NEW.id
        AND review.status = 'pending_review'
    ) THEN
      RAISE EXCEPTION 'Cannot close a client period with pending task reviews' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_task_reviews ON public.task_reviews;
CREATE TRIGGER touch_task_reviews
BEFORE UPDATE ON public.task_reviews
FOR EACH ROW EXECUTE FUNCTION public.touch_task_reviews();

DROP TRIGGER IF EXISTS ensure_task_review_scope ON public.task_reviews;
CREATE TRIGGER ensure_task_review_scope
BEFORE INSERT OR UPDATE OF tenant_id, task_id, reviewer_id ON public.task_reviews
FOR EACH ROW EXECUTE FUNCTION public.ensure_task_review_scope();

DROP TRIGGER IF EXISTS apply_task_review_state ON public.task_reviews;
CREATE TRIGGER apply_task_review_state
AFTER INSERT OR UPDATE OF status ON public.task_reviews
FOR EACH ROW EXECUTE FUNCTION public.apply_task_review_state();

DROP TRIGGER IF EXISTS create_task_review_from_checklist ON public.client_period_checklist_items;
CREATE TRIGGER create_task_review_from_checklist
AFTER INSERT OR UPDATE OF status ON public.client_period_checklist_items
FOR EACH ROW EXECUTE FUNCTION public.create_task_review_from_checklist();

DROP TRIGGER IF EXISTS block_period_close_with_pending_reviews ON public.client_periods;
CREATE TRIGGER block_period_close_with_pending_reviews
BEFORE UPDATE OF status ON public.client_periods
FOR EACH ROW EXECUTE FUNCTION public.block_period_close_with_pending_reviews();

ALTER TABLE public.task_reviews ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_reviews TO authenticated;

CREATE POLICY task_reviews_select ON public.task_reviews
FOR SELECT TO authenticated
USING (
  tenant_id = public.current_user_tenant_id()
  AND public.can_manage_current_tenant()
);

CREATE POLICY task_reviews_insert ON public.task_reviews
FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = public.current_user_tenant_id()
  AND public.can_manage_current_tenant()
);

CREATE POLICY task_reviews_update ON public.task_reviews
FOR UPDATE TO authenticated
USING (
  tenant_id = public.current_user_tenant_id()
  AND public.can_manage_current_tenant()
)
WITH CHECK (
  tenant_id = public.current_user_tenant_id()
  AND public.can_manage_current_tenant()
);

CREATE POLICY task_reviews_delete ON public.task_reviews
FOR DELETE TO authenticated
USING (
  tenant_id = public.current_user_tenant_id()
  AND public.current_user_account_type() = 'admin'
);

CREATE POLICY task_reviews_collaborator_read_permission ON public.task_reviews AS RESTRICTIVE
FOR SELECT TO authenticated
USING (
  public.current_user_account_type() <> 'collaborator'
  OR public.has_workspace_permission('tasks', 'read')
);

CREATE POLICY task_reviews_collaborator_insert_permission ON public.task_reviews AS RESTRICTIVE
FOR INSERT TO authenticated
WITH CHECK (
  public.current_user_account_type() <> 'collaborator'
  OR public.has_workspace_permission('tasks', 'update')
);

CREATE POLICY task_reviews_collaborator_update_permission ON public.task_reviews AS RESTRICTIVE
FOR UPDATE TO authenticated
USING (
  public.current_user_account_type() <> 'collaborator'
  OR public.has_workspace_permission('tasks', 'update')
)
WITH CHECK (
  public.current_user_account_type() <> 'collaborator'
  OR public.has_workspace_permission('tasks', 'update')
);

REVOKE ALL ON FUNCTION public.touch_task_reviews() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ensure_task_review_scope() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_task_review_state() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_task_review_from_checklist() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.block_period_close_with_pending_reviews() FROM PUBLIC, anon, authenticated;

COMMIT;
