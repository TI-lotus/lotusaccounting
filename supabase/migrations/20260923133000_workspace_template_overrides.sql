BEGIN;

CREATE OR REPLACE FUNCTION public.clone_operational_checklist_template(source_template_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  source_template record;
  existing_template_id uuid;
  new_template_id uuid;
BEGIN
  IF public.current_user_account_type() <> 'admin' THEN
    RAISE EXCEPTION 'Only workspace admins can duplicate checklist templates' USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO source_template
  FROM public.operational_checklist_templates
  WHERE id = source_template_id
    AND (tenant_id IS NULL OR tenant_id = public.current_user_tenant_id());

  IF source_template.id IS NULL THEN
    RAISE EXCEPTION 'Checklist template not found' USING ERRCODE = '40400';
  END IF;

  SELECT id INTO existing_template_id
  FROM public.operational_checklist_templates
  WHERE tenant_id = public.current_user_tenant_id()
    AND tax_regime = source_template.tax_regime
    AND service_area = source_template.service_area
    AND name = source_template.name
  LIMIT 1;

  IF existing_template_id IS NOT NULL THEN
    RETURN existing_template_id;
  END IF;

  INSERT INTO public.operational_checklist_templates (
    tenant_id,
    name,
    tax_regime,
    service_area,
    active
  )
  VALUES (
    public.current_user_tenant_id(),
    source_template.name,
    source_template.tax_regime,
    source_template.service_area,
    source_template.active
  )
  RETURNING id INTO new_template_id;

  INSERT INTO public.operational_checklist_items (
    template_id,
    title,
    description,
    default_priority,
    default_due_day,
    requires_review,
    requires_document,
    active,
    sort_order
  )
  SELECT
    new_template_id,
    title,
    description,
    default_priority,
    default_due_day,
    requires_review,
    requires_document,
    active,
    sort_order
  FROM public.operational_checklist_items
  WHERE template_id = source_template_id
  ORDER BY sort_order, title;

  RETURN new_template_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.clone_fiscal_obligation_template(source_template_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  source_template record;
  existing_template_id uuid;
  new_template_id uuid;
BEGIN
  IF public.current_user_account_type() <> 'admin' THEN
    RAISE EXCEPTION 'Only workspace admins can duplicate obligation templates' USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO source_template
  FROM public.fiscal_obligation_templates
  WHERE id = source_template_id
    AND (tenant_id IS NULL OR tenant_id = public.current_user_tenant_id());

  IF source_template.id IS NULL THEN
    RAISE EXCEPTION 'Fiscal obligation template not found' USING ERRCODE = '40400';
  END IF;

  SELECT id INTO existing_template_id
  FROM public.fiscal_obligation_templates
  WHERE tenant_id = public.current_user_tenant_id()
    AND tax_regime = source_template.tax_regime
    AND service_area = source_template.service_area
    AND name = source_template.name
  LIMIT 1;

  IF existing_template_id IS NOT NULL THEN
    RETURN existing_template_id;
  END IF;

  INSERT INTO public.fiscal_obligation_templates (
    tenant_id,
    name,
    description,
    tax_regime,
    service_area,
    recurrence,
    default_due_day,
    priority,
    generates_task,
    requires_evidence,
    active,
    sort_order
  )
  VALUES (
    public.current_user_tenant_id(),
    source_template.name,
    source_template.description,
    source_template.tax_regime,
    source_template.service_area,
    source_template.recurrence,
    source_template.default_due_day,
    source_template.priority,
    source_template.generates_task,
    source_template.requires_evidence,
    source_template.active,
    source_template.sort_order
  )
  RETURNING id INTO new_template_id;

  RETURN new_template_id;
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
      AND (
        template.tenant_id = period_row.tenant_id
        OR (
          template.tenant_id IS NULL
          AND NOT EXISTS (
            SELECT 1
            FROM public.operational_checklist_templates workspace_template
            WHERE workspace_template.tenant_id = period_row.tenant_id
              AND workspace_template.tax_regime = template.tax_regime
              AND workspace_template.service_area = template.service_area
              AND workspace_template.name = template.name
          )
        )
      )
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
      AND (
        template.tenant_id = period_row.tenant_id
        OR (
          template.tenant_id IS NULL
          AND NOT EXISTS (
            SELECT 1
            FROM public.fiscal_obligation_templates workspace_template
            WHERE workspace_template.tenant_id = period_row.tenant_id
              AND workspace_template.tax_regime = template.tax_regime
              AND workspace_template.service_area = template.service_area
              AND workspace_template.name = template.name
          )
        )
      )
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

REVOKE ALL ON FUNCTION public.clone_operational_checklist_template(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.clone_fiscal_obligation_template(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_checklist_for_client_period(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_fiscal_obligations_for_client_period(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clone_operational_checklist_template(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clone_fiscal_obligation_template(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_checklist_for_client_period(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_fiscal_obligations_for_client_period(uuid) TO authenticated;

COMMIT;
