BEGIN;

CREATE TABLE IF NOT EXISTS public.operational_checklist_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  tax_regime text NOT NULL CHECK (tax_regime IN ('mei', 'simples_nacional', 'lucro_presumido', 'lucro_real')),
  service_area text NOT NULL CHECK (service_area IN ('fiscal', 'contabil', 'folha', 'financeiro_bpo', 'societario')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS operational_checklist_templates_unique_scope
ON public.operational_checklist_templates(COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), tax_regime, service_area, name);

CREATE TABLE IF NOT EXISTS public.operational_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.operational_checklist_templates(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  default_priority text NOT NULL DEFAULT 'medium' CHECK (default_priority IN ('low', 'medium', 'high')),
  default_due_day integer NOT NULL DEFAULT 10 CHECK (default_due_day BETWEEN 1 AND 28),
  requires_review boolean NOT NULL DEFAULT false,
  requires_document boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operational_checklist_items_unique_title UNIQUE (template_id, title)
);

CREATE TABLE IF NOT EXISTS public.client_period_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  client_period_id uuid NOT NULL REFERENCES public.client_periods(id) ON DELETE CASCADE,
  checklist_item_id uuid NOT NULL REFERENCES public.operational_checklist_items(id) ON DELETE RESTRICT,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  service_area text NOT NULL CHECK (service_area IN ('fiscal', 'contabil', 'folha', 'financeiro_bpo', 'societario')),
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'in_review', 'completed', 'blocked', 'waived')),
  due_date date,
  requires_review boolean NOT NULL DEFAULT false,
  requires_document boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  blocked_reason text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_period_checklist_items_unique_item UNIQUE (client_period_id, checklist_item_id)
);

CREATE INDEX IF NOT EXISTS idx_client_period_checklist_items_period
ON public.client_period_checklist_items(client_period_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_client_period_checklist_items_task
ON public.client_period_checklist_items(task_id)
WHERE task_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_client_period_checklist_items_tenant_status
ON public.client_period_checklist_items(tenant_id, status);

CREATE OR REPLACE FUNCTION public.touch_operational_checklists()
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

CREATE OR REPLACE FUNCTION public.touch_client_period_checklist_items()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.status = 'completed' AND NEW.completed_at IS NULL THEN
    NEW.completed_at := now();
  ELSIF NEW.status <> 'completed' THEN
    NEW.completed_at := NULL;
  END IF;

  IF NEW.status <> 'blocked' THEN
    NEW.blocked_reason := NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_client_period_from_checklist(target_period_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_items integer;
  done_items integer;
  blocked_items integer;
  review_items integer;
  active_items integer;
  next_status text;
  next_progress integer;
BEGIN
  SELECT
    count(*),
    count(*) FILTER (WHERE status IN ('completed', 'waived')),
    count(*) FILTER (WHERE status = 'blocked'),
    count(*) FILTER (WHERE status = 'in_review'),
    count(*) FILTER (WHERE status = 'in_progress')
  INTO total_items, done_items, blocked_items, review_items, active_items
  FROM public.client_period_checklist_items
  WHERE client_period_id = target_period_id;

  IF total_items = 0 THEN
    RETURN;
  END IF;

  next_progress := round((done_items::numeric / total_items::numeric) * 100)::integer;

  IF blocked_items > 0 THEN
    next_status := 'blocked';
  ELSIF done_items = total_items THEN
    next_status := 'closed';
  ELSIF review_items > 0 THEN
    next_status := 'in_review';
  ELSIF active_items > 0 OR done_items > 0 THEN
    next_status := 'in_progress';
  ELSE
    next_status := 'waiting_documents';
  END IF;

  UPDATE public.client_periods
  SET
    progress_percent = next_progress,
    status = CASE
      WHEN status = 'delivered' AND next_status NOT IN ('blocked', 'closed') THEN status
      ELSE next_status
    END,
    blocked_reason = CASE WHEN next_status = 'blocked' THEN 'Ha itens de checklist bloqueados nesta competencia.' ELSE NULL END
  WHERE id = target_period_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_client_period_from_checklist_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.refresh_client_period_from_checklist(COALESCE(NEW.client_period_id, OLD.client_period_id));
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
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

CREATE OR REPLACE FUNCTION public.create_checklist_for_client_period_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.create_checklist_for_client_period(NEW.id);
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
    UPDATE public.client_period_checklist_items
    SET status = CASE
      WHEN NEW.status = 'completed' THEN 'completed'
      WHEN NEW.status = 'in_progress' THEN 'in_progress'
      ELSE 'pending'
    END
    WHERE task_id = NEW.id
      AND status <> 'waived';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_operational_checklist_templates ON public.operational_checklist_templates;
CREATE TRIGGER touch_operational_checklist_templates
BEFORE UPDATE ON public.operational_checklist_templates
FOR EACH ROW EXECUTE FUNCTION public.touch_operational_checklists();

DROP TRIGGER IF EXISTS touch_operational_checklist_items ON public.operational_checklist_items;
CREATE TRIGGER touch_operational_checklist_items
BEFORE UPDATE ON public.operational_checklist_items
FOR EACH ROW EXECUTE FUNCTION public.touch_operational_checklists();

DROP TRIGGER IF EXISTS touch_client_period_checklist_items ON public.client_period_checklist_items;
CREATE TRIGGER touch_client_period_checklist_items
BEFORE UPDATE ON public.client_period_checklist_items
FOR EACH ROW EXECUTE FUNCTION public.touch_client_period_checklist_items();

DROP TRIGGER IF EXISTS refresh_client_period_from_checklist ON public.client_period_checklist_items;
CREATE TRIGGER refresh_client_period_from_checklist
AFTER INSERT OR UPDATE OR DELETE ON public.client_period_checklist_items
FOR EACH ROW EXECUTE FUNCTION public.refresh_client_period_from_checklist_trigger();

DROP TRIGGER IF EXISTS create_checklist_for_client_period ON public.client_periods;
CREATE TRIGGER create_checklist_for_client_period
AFTER INSERT ON public.client_periods
FOR EACH ROW EXECUTE FUNCTION public.create_checklist_for_client_period_trigger();

DROP TRIGGER IF EXISTS sync_checklist_item_from_task_status ON public.tasks;
CREATE TRIGGER sync_checklist_item_from_task_status
AFTER UPDATE OF status ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.sync_checklist_item_from_task_status();

ALTER TABLE public.operational_checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operational_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_period_checklist_items ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.operational_checklist_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operational_checklist_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_period_checklist_items TO authenticated;

CREATE POLICY operational_checklist_templates_select ON public.operational_checklist_templates
FOR SELECT TO authenticated
USING (tenant_id IS NULL OR tenant_id = public.current_user_tenant_id());

CREATE POLICY operational_checklist_templates_admin_write ON public.operational_checklist_templates
FOR ALL TO authenticated
USING (tenant_id = public.current_user_tenant_id() AND public.current_user_account_type() = 'admin')
WITH CHECK (tenant_id = public.current_user_tenant_id() AND public.current_user_account_type() = 'admin');

CREATE POLICY operational_checklist_items_select ON public.operational_checklist_items
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.operational_checklist_templates template
    WHERE template.id = template_id
      AND (template.tenant_id IS NULL OR template.tenant_id = public.current_user_tenant_id())
  )
);

CREATE POLICY operational_checklist_items_admin_write ON public.operational_checklist_items
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.operational_checklist_templates template
    WHERE template.id = template_id
      AND template.tenant_id = public.current_user_tenant_id()
      AND public.current_user_account_type() = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.operational_checklist_templates template
    WHERE template.id = template_id
      AND template.tenant_id = public.current_user_tenant_id()
      AND public.current_user_account_type() = 'admin'
  )
);

CREATE POLICY client_period_checklist_items_select ON public.client_period_checklist_items
FOR SELECT TO authenticated
USING (
  tenant_id = public.current_user_tenant_id()
  AND (
    public.can_manage_current_tenant()
    OR company_id = public.current_user_company_id()
  )
);

CREATE POLICY client_period_checklist_items_update ON public.client_period_checklist_items
FOR UPDATE TO authenticated
USING (
  tenant_id = public.current_user_tenant_id()
  AND public.can_manage_current_tenant()
)
WITH CHECK (
  tenant_id = public.current_user_tenant_id()
  AND public.can_manage_current_tenant()
);

CREATE POLICY client_period_checklist_items_admin_delete ON public.client_period_checklist_items
FOR DELETE TO authenticated
USING (
  tenant_id = public.current_user_tenant_id()
  AND public.current_user_account_type() = 'admin'
);

CREATE POLICY client_period_checklist_items_collaborator_read_permission ON public.client_period_checklist_items AS RESTRICTIVE
FOR SELECT TO authenticated
USING (
  public.current_user_account_type() <> 'collaborator'
  OR public.has_workspace_permission('tasks', 'read')
  OR public.has_workspace_permission('clients', 'read')
);

CREATE POLICY client_period_checklist_items_collaborator_update_permission ON public.client_period_checklist_items AS RESTRICTIVE
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

INSERT INTO public.operational_checklist_templates (id, name, tax_regime, service_area)
VALUES
  ('10000000-0000-4000-8000-000000000001', 'MEI - Fiscal mensal', 'mei', 'fiscal'),
  ('10000000-0000-4000-8000-000000000002', 'MEI - Contabil mensal', 'mei', 'contabil'),
  ('10000000-0000-4000-8000-000000000003', 'Simples Nacional - Fiscal mensal', 'simples_nacional', 'fiscal'),
  ('10000000-0000-4000-8000-000000000004', 'Simples Nacional - Contabil mensal', 'simples_nacional', 'contabil'),
  ('10000000-0000-4000-8000-000000000005', 'Lucro Presumido - Fiscal mensal', 'lucro_presumido', 'fiscal'),
  ('10000000-0000-4000-8000-000000000006', 'Lucro Presumido - Contabil mensal', 'lucro_presumido', 'contabil'),
  ('10000000-0000-4000-8000-000000000007', 'Lucro Real - Fiscal mensal', 'lucro_real', 'fiscal'),
  ('10000000-0000-4000-8000-000000000008', 'Lucro Real - Contabil mensal', 'lucro_real', 'contabil')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.operational_checklist_items (id, template_id, title, description, default_priority, default_due_day, requires_review, requires_document, sort_order)
VALUES
  ('10000000-0000-4000-8001-000000000001', '10000000-0000-4000-8000-000000000001', 'Conferir faturamento MEI', 'Validar receita mensal informada pelo cliente.', 'medium', 5, false, true, 10),
  ('10000000-0000-4000-8001-000000000002', '10000000-0000-4000-8000-000000000001', 'Apurar DAS MEI interno', 'Preparar conferencia interna da guia mensal do MEI.', 'high', 15, true, false, 20),
  ('10000000-0000-4000-8001-000000000003', '10000000-0000-4000-8000-000000000002', 'Arquivar evidencias MEI', 'Conferir comprovantes e evidencias da competencia.', 'low', 20, false, true, 30),
  ('10000000-0000-4000-8001-000000000004', '10000000-0000-4000-8000-000000000003', 'Conferir notas e documentos fiscais', 'Revisar entradas, saidas e documentos fiscais do Simples Nacional.', 'medium', 6, false, true, 10),
  ('10000000-0000-4000-8001-000000000005', '10000000-0000-4000-8000-000000000003', 'Apurar receita e anexos do Simples', 'Classificar receita e validar anexo aplicavel para apuracao interna.', 'high', 12, true, false, 20),
  ('10000000-0000-4000-8001-000000000006', '10000000-0000-4000-8000-000000000004', 'Conciliar movimentos contabeis', 'Conferir movimentos relevantes da competencia antes do fechamento.', 'medium', 18, false, true, 30),
  ('10000000-0000-4000-8001-000000000007', '10000000-0000-4000-8000-000000000005', 'Conferir documentos fiscais do presumido', 'Revisar notas, retencoes e documentos fiscais do periodo.', 'medium', 6, false, true, 10),
  ('10000000-0000-4000-8001-000000000008', '10000000-0000-4000-8000-000000000005', 'Apurar tributos do Lucro Presumido', 'Preparar apuracao interna de PIS, COFINS, IRPJ e CSLL.', 'high', 15, true, false, 20),
  ('10000000-0000-4000-8001-000000000009', '10000000-0000-4000-8000-000000000006', 'Revisar balancete mensal', 'Conferir consistencia contabil e evidencias antes da entrega.', 'high', 22, true, true, 30),
  ('10000000-0000-4000-8001-000000000010', '10000000-0000-4000-8000-000000000007', 'Conferir livros e documentos do real', 'Validar documentacao fiscal e contabil para apuracao do Lucro Real.', 'high', 5, false, true, 10),
  ('10000000-0000-4000-8001-000000000011', '10000000-0000-4000-8000-000000000007', 'Apurar base do Lucro Real', 'Preparar apuracao interna e pontos de revisao tecnica.', 'high', 14, true, false, 20),
  ('10000000-0000-4000-8001-000000000012', '10000000-0000-4000-8000-000000000008', 'Revisar conciliacoes e demonstrativos', 'Conferir conciliacoes criticas e demonstrativos da competencia.', 'high', 24, true, true, 30)
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE
  period_record record;
BEGIN
  FOR period_record IN SELECT id FROM public.client_periods LOOP
    PERFORM public.create_checklist_for_client_period(period_record.id);
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.touch_operational_checklists() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_client_period_checklist_items() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_client_period_from_checklist(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_client_period_from_checklist_trigger() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_checklist_for_client_period(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_checklist_for_client_period_trigger() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_checklist_item_from_task_status() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_checklist_for_client_period(uuid) TO authenticated;

COMMIT;
