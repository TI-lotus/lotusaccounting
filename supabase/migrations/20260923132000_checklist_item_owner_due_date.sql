BEGIN;

ALTER TABLE public.client_period_checklist_items
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_client_period_checklist_items_assigned_to
ON public.client_period_checklist_items(tenant_id, assigned_to)
WHERE assigned_to IS NOT NULL;

CREATE OR REPLACE FUNCTION public.validate_client_period_checklist_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.assigned_to IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = NEW.assigned_to
      AND p.tenant_id = NEW.tenant_id
      AND p.account_type <> 'client'
      AND p.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Checklist assignee must be an active internal workspace member' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_task_from_checklist_planning()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.task_id IS NOT NULL AND (
    NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
    OR NEW.due_date IS DISTINCT FROM OLD.due_date
  ) THEN
    UPDATE public.tasks
    SET
      assigned_to = NEW.assigned_to,
      due_date = NEW.due_date::timestamptz
    WHERE id = NEW.task_id
      AND tenant_id = NEW.tenant_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_checklist_for_client_period(target_period_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  period_row record;
  item_row record;
  checklist_id uuid;
  generated_task_id uuid;
  due_on date;
  created_count integer := 0;
BEGIN
  SELECT
    cp.id,
    cp.tenant_id,
    cp.company_id,
    cp.period_month,
    cp.period_year,
    cp.responsible_user_id,
    cp.created_by,
    COALESCE(NULLIF(c.tax_regime, ''), 'simples_nacional') AS tax_regime,
    COALESCE(c.service_areas, ARRAY['fiscal', 'contabil']::text[]) AS service_areas,
    c.name AS company_name
  INTO period_row
  FROM public.client_periods cp
  JOIN public.companies c ON c.id = cp.company_id
  WHERE cp.id = target_period_id;

  IF period_row.id IS NULL THEN
    RETURN 0;
  END IF;

  FOR item_row IN
    SELECT
      item.id AS checklist_item_id,
      item.title,
      item.description,
      item.default_priority,
      item.default_due_day,
      item.requires_review,
      item.requires_document,
      item.sort_order,
      template.service_area
    FROM public.operational_checklist_templates template
    JOIN public.operational_checklist_items item ON item.template_id = template.id
    WHERE template.active = true
      AND item.active = true
      AND template.tax_regime = period_row.tax_regime
      AND template.service_area = ANY(period_row.service_areas)
      AND (template.tenant_id IS NULL OR template.tenant_id = period_row.tenant_id)
    ORDER BY template.service_area, item.sort_order, item.title
  LOOP
    checklist_id := NULL;
    generated_task_id := NULL;
    due_on := (make_date(period_row.period_year, period_row.period_month, 1) + (LEAST(item_row.default_due_day, 28) - 1));

    INSERT INTO public.client_period_checklist_items (
      tenant_id,
      company_id,
      client_period_id,
      checklist_item_id,
      task_id,
      assigned_to,
      service_area,
      title,
      description,
      due_date,
      requires_review,
      requires_document,
      sort_order
    )
    VALUES (
      period_row.tenant_id,
      period_row.company_id,
      period_row.id,
      item_row.checklist_item_id,
      NULL,
      period_row.responsible_user_id,
      item_row.service_area,
      item_row.title,
      item_row.description,
      due_on,
      item_row.requires_review,
      item_row.requires_document,
      item_row.sort_order
    )
    ON CONFLICT (client_period_id, checklist_item_id) DO NOTHING
    RETURNING id INTO checklist_id;

    IF checklist_id IS NOT NULL THEN
      INSERT INTO public.tasks (
        tenant_id,
        company_id,
        assigned_to,
        created_by,
        title,
        description,
        task_type,
        status,
        priority,
        category,
        due_date
      )
      VALUES (
        period_row.tenant_id,
        period_row.company_id,
        period_row.responsible_user_id,
        period_row.created_by,
        item_row.title,
        item_row.description,
        'monthly',
        'pending',
        item_row.default_priority,
        CASE item_row.service_area
          WHEN 'fiscal' THEN 'Fiscal'
          WHEN 'contabil' THEN 'Contabil'
          WHEN 'folha' THEN 'Folha'
          WHEN 'financeiro_bpo' THEN 'Financeiro/BPO'
          ELSE 'Societario'
        END,
        due_on::timestamptz
      )
      RETURNING id INTO generated_task_id;

      UPDATE public.client_period_checklist_items
      SET task_id = generated_task_id
      WHERE id = checklist_id;

      created_count := created_count + 1;
    END IF;
  END LOOP;

  PERFORM public.refresh_client_period_from_checklist(target_period_id);
  RETURN created_count;
END;
$$;

UPDATE public.client_period_checklist_items cpi
SET assigned_to = t.assigned_to
FROM public.tasks t
WHERE cpi.task_id = t.id
  AND cpi.assigned_to IS NULL;

DROP TRIGGER IF EXISTS validate_client_period_checklist_assignment ON public.client_period_checklist_items;
CREATE TRIGGER validate_client_period_checklist_assignment
BEFORE INSERT OR UPDATE OF assigned_to, tenant_id ON public.client_period_checklist_items
FOR EACH ROW EXECUTE FUNCTION public.validate_client_period_checklist_assignment();

DROP TRIGGER IF EXISTS sync_task_from_checklist_planning ON public.client_period_checklist_items;
CREATE TRIGGER sync_task_from_checklist_planning
AFTER UPDATE OF assigned_to, due_date ON public.client_period_checklist_items
FOR EACH ROW EXECUTE FUNCTION public.sync_task_from_checklist_planning();

REVOKE ALL ON FUNCTION public.validate_client_period_checklist_assignment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_task_from_checklist_planning() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_checklist_for_client_period(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_checklist_for_client_period(uuid) TO authenticated;

COMMIT;
