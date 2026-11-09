BEGIN;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS service_areas text[] NOT NULL DEFAULT ARRAY['fiscal', 'contabil']::text[];

ALTER TABLE public.companies
  DROP CONSTRAINT IF EXISTS companies_service_areas_check;

ALTER TABLE public.companies
  ADD CONSTRAINT companies_service_areas_check
  CHECK (
    service_areas IS NOT NULL
    AND array_length(service_areas, 1) IS NOT NULL
    AND service_areas <@ ARRAY['fiscal', 'contabil', 'folha', 'financeiro_bpo', 'societario']::text[]
  );

UPDATE public.companies
SET service_areas = ARRAY['fiscal', 'contabil']::text[]
WHERE service_areas IS NULL OR array_length(service_areas, 1) IS NULL;

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

CREATE OR REPLACE FUNCTION public.create_fiscal_obligations_for_client_period(target_period_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  period_row record;
  template_row record;
  obligation_id uuid;
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

  FOR template_row IN
    SELECT *
    FROM public.fiscal_obligation_templates template
    WHERE template.active = true
      AND template.tax_regime = period_row.tax_regime
      AND template.service_area = ANY(period_row.service_areas)
      AND (template.tenant_id IS NULL OR template.tenant_id = period_row.tenant_id)
    ORDER BY template.service_area, template.sort_order, template.name
  LOOP
    obligation_id := NULL;
    generated_task_id := NULL;
    due_on := make_date(
      period_row.period_year,
      period_row.period_month,
      LEAST(template_row.default_due_day, EXTRACT(day FROM (date_trunc('month', make_date(period_row.period_year, period_row.period_month, 1)) + interval '1 month - 1 day'))::integer)
    );

    INSERT INTO public.fiscal_obligations (
      tenant_id,
      company_id,
      client_period_id,
      source_template_id,
      name,
      description,
      tax_regime,
      service_area,
      recurrence,
      period_month,
      period_year,
      due_date,
      status,
      priority,
      generates_task,
      requires_evidence,
      created_by
    )
    VALUES (
      period_row.tenant_id,
      period_row.company_id,
      period_row.id,
      template_row.id,
      template_row.name,
      COALESCE(template_row.description, format('Obrigacao gerada para %s em %s/%s.', period_row.company_name, lpad(period_row.period_month::text, 2, '0'), period_row.period_year)),
      period_row.tax_regime,
      template_row.service_area,
      template_row.recurrence,
      period_row.period_month,
      period_row.period_year,
      due_on,
      'pending',
      template_row.priority,
      template_row.generates_task,
      template_row.requires_evidence,
      period_row.created_by
    )
    ON CONFLICT (client_period_id, source_template_id) WHERE client_period_id IS NOT NULL AND source_template_id IS NOT NULL
    DO NOTHING
    RETURNING id INTO obligation_id;

    IF obligation_id IS NOT NULL THEN
      IF template_row.generates_task THEN
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
          template_row.name,
          template_row.description,
          'monthly',
          'pending',
          template_row.priority,
          CASE template_row.service_area
            WHEN 'fiscal' THEN 'Obrigacoes fiscais'
            WHEN 'contabil' THEN 'Obrigacoes contabeis'
            WHEN 'folha' THEN 'Folha'
            WHEN 'financeiro_bpo' THEN 'Financeiro/BPO'
            ELSE 'Societario'
          END,
          due_on::timestamptz
        )
        RETURNING id INTO generated_task_id;

        UPDATE public.fiscal_obligations
        SET task_id = generated_task_id
        WHERE id = obligation_id;
      END IF;

      created_count := created_count + 1;
    END IF;
  END LOOP;

  RETURN created_count;
END;
$$;

REVOKE ALL ON FUNCTION public.create_checklist_for_client_period(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_fiscal_obligations_for_client_period(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_checklist_for_client_period(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_fiscal_obligations_for_client_period(uuid) TO authenticated;

COMMIT;
