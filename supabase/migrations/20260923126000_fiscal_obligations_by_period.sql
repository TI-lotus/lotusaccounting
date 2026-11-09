BEGIN;

ALTER TABLE public.fiscal_obligations
  ADD COLUMN IF NOT EXISTS client_period_id uuid REFERENCES public.client_periods(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS source_template_id uuid,
  ADD COLUMN IF NOT EXISTS service_area text,
  ADD COLUMN IF NOT EXISTS generates_task boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_evidence boolean NOT NULL DEFAULT false;

ALTER TABLE public.fiscal_obligations
  DROP CONSTRAINT IF EXISTS fiscal_obligations_service_area_check;

ALTER TABLE public.fiscal_obligations
  ADD CONSTRAINT fiscal_obligations_service_area_check
  CHECK (service_area IS NULL OR service_area IN ('fiscal', 'contabil', 'folha', 'financeiro_bpo', 'societario'));

CREATE INDEX IF NOT EXISTS idx_fiscal_obligations_period
ON public.fiscal_obligations(client_period_id, due_date);

CREATE UNIQUE INDEX IF NOT EXISTS fiscal_obligations_unique_period_template
ON public.fiscal_obligations(client_period_id, source_template_id)
WHERE client_period_id IS NOT NULL AND source_template_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.fiscal_obligation_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  tax_regime text NOT NULL CHECK (tax_regime IN ('mei', 'simples_nacional', 'lucro_presumido', 'lucro_real')),
  service_area text NOT NULL DEFAULT 'fiscal' CHECK (service_area IN ('fiscal', 'contabil', 'folha', 'financeiro_bpo', 'societario')),
  recurrence text NOT NULL DEFAULT 'monthly',
  default_due_day integer NOT NULL DEFAULT 20 CHECK (default_due_day BETWEEN 1 AND 28),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  generates_task boolean NOT NULL DEFAULT true,
  requires_evidence boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS fiscal_obligation_templates_unique_scope
ON public.fiscal_obligation_templates(
  COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid),
  tax_regime,
  service_area,
  name
);

ALTER TABLE public.fiscal_obligations
  DROP CONSTRAINT IF EXISTS fiscal_obligations_source_template_id_fkey;

ALTER TABLE public.fiscal_obligations
  ADD CONSTRAINT fiscal_obligations_source_template_id_fkey
  FOREIGN KEY (source_template_id) REFERENCES public.fiscal_obligation_templates(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.touch_fiscal_obligation_templates()
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

CREATE OR REPLACE FUNCTION public.guard_fiscal_obligation_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND NEW.requires_evidence = true AND NEW.document_id IS NULL THEN
    RAISE EXCEPTION 'Fiscal obligation requires evidence before completion' USING ERRCODE = '23514';
  END IF;

  IF NEW.status = 'completed' AND NEW.completed_at IS NULL THEN
    NEW.completed_at := now();
  ELSIF NEW.status <> 'completed' THEN
    NEW.completed_at := NULL;
  END IF;

  RETURN NEW;
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

CREATE OR REPLACE FUNCTION public.create_fiscal_obligations_for_client_period_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.create_fiscal_obligations_for_client_period(NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_fiscal_obligation_from_task_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    UPDATE public.fiscal_obligations
    SET status = CASE
        WHEN NEW.status = 'completed' THEN 'completed'
        WHEN NEW.status = 'in_progress' THEN 'in_progress'
        ELSE 'pending'
      END
    WHERE task_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_fiscal_obligation_due_alert(target_obligation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  obligation_row record;
  recipient uuid;
BEGIN
  SELECT fo.*, cp.responsible_user_id
  INTO obligation_row
  FROM public.fiscal_obligations fo
  LEFT JOIN public.client_periods cp ON cp.id = fo.client_period_id
  WHERE fo.id = target_obligation_id;

  IF obligation_row.id IS NULL THEN
    RETURN;
  END IF;

  recipient := COALESCE(obligation_row.responsible_user_id, obligation_row.created_by);

  IF obligation_row.status = 'completed'
     OR obligation_row.due_date IS NULL
     OR obligation_row.due_date > (current_date + 3)
     OR recipient IS NULL
  THEN
    UPDATE public.user_notifications
    SET read_at = COALESCE(read_at, now())
    WHERE kind = 'fiscal_obligation_due'
      AND metadata ->> 'fiscal_obligation_id' = obligation_row.id::text;
    RETURN;
  END IF;

  INSERT INTO public.user_notifications (tenant_id, user_id, kind, title, body, href, metadata)
  VALUES (
    obligation_row.tenant_id,
    recipient,
    'fiscal_obligation_due',
    'Obrigacao fiscal proxima do vencimento',
    format('%s vence em %s.', obligation_row.name, to_char(obligation_row.due_date, 'DD/MM/YYYY')),
    '/reports',
    jsonb_build_object('fiscal_obligation_id', obligation_row.id, 'company_id', obligation_row.company_id, 'due_date', obligation_row.due_date)
  )
  ON CONFLICT DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_fiscal_obligation_due_alert_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.user_notifications
    SET read_at = COALESCE(read_at, now())
    WHERE kind = 'fiscal_obligation_due'
      AND metadata ->> 'fiscal_obligation_id' = OLD.id::text;
    RETURN OLD;
  END IF;

  PERFORM public.sync_fiscal_obligation_due_alert(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_fiscal_obligation_templates ON public.fiscal_obligation_templates;
CREATE TRIGGER touch_fiscal_obligation_templates
BEFORE UPDATE ON public.fiscal_obligation_templates
FOR EACH ROW EXECUTE FUNCTION public.touch_fiscal_obligation_templates();

DROP TRIGGER IF EXISTS guard_fiscal_obligation_completion ON public.fiscal_obligations;
CREATE TRIGGER guard_fiscal_obligation_completion
BEFORE INSERT OR UPDATE OF status, document_id, requires_evidence ON public.fiscal_obligations
FOR EACH ROW EXECUTE FUNCTION public.guard_fiscal_obligation_completion();

DROP TRIGGER IF EXISTS create_fiscal_obligations_for_client_period ON public.client_periods;
CREATE TRIGGER create_fiscal_obligations_for_client_period
AFTER INSERT ON public.client_periods
FOR EACH ROW EXECUTE FUNCTION public.create_fiscal_obligations_for_client_period_trigger();

DROP TRIGGER IF EXISTS sync_fiscal_obligation_from_task_status ON public.tasks;
CREATE TRIGGER sync_fiscal_obligation_from_task_status
AFTER UPDATE OF status ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.sync_fiscal_obligation_from_task_status();

DROP TRIGGER IF EXISTS sync_fiscal_obligation_due_alert ON public.fiscal_obligations;
CREATE TRIGGER sync_fiscal_obligation_due_alert
AFTER INSERT OR UPDATE OF status, due_date, task_id, client_period_id OR DELETE ON public.fiscal_obligations
FOR EACH ROW EXECUTE FUNCTION public.sync_fiscal_obligation_due_alert_trigger();

ALTER TABLE public.fiscal_obligation_templates ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiscal_obligation_templates TO authenticated;

CREATE POLICY fiscal_obligation_templates_select ON public.fiscal_obligation_templates
FOR SELECT TO authenticated
USING (tenant_id IS NULL OR tenant_id = public.current_user_tenant_id());

CREATE POLICY fiscal_obligation_templates_admin_write ON public.fiscal_obligation_templates
FOR ALL TO authenticated
USING (tenant_id = public.current_user_tenant_id() AND public.current_user_account_type() = 'admin')
WITH CHECK (tenant_id = public.current_user_tenant_id() AND public.current_user_account_type() = 'admin');

INSERT INTO public.fiscal_obligation_templates (
  id, name, description, tax_regime, service_area, recurrence, default_due_day, priority, generates_task, requires_evidence, sort_order
)
VALUES
  ('10000000-0000-4000-8100-000000000001', 'DAS-MEI', 'Conferir e registrar a guia mensal do MEI.', 'mei', 'fiscal', 'monthly', 20, 'medium', true, true, 10),
  ('10000000-0000-4000-8100-000000000002', 'Relatorio mensal MEI', 'Conferir faturamento e evidencias mensais do MEI.', 'mei', 'contabil', 'monthly', 25, 'low', true, false, 20),
  ('10000000-0000-4000-8100-000000000003', 'DAS - Simples Nacional', 'Preparar conferencia interna do DAS do Simples Nacional.', 'simples_nacional', 'fiscal', 'monthly', 20, 'high', true, true, 10),
  ('10000000-0000-4000-8100-000000000004', 'Conferencia PGDAS', 'Validar receita, anexos e memoria da apuracao.', 'simples_nacional', 'fiscal', 'monthly', 15, 'high', true, false, 20),
  ('10000000-0000-4000-8100-000000000005', 'DARF IRPJ/CSLL', 'Registrar conferencia interna de IRPJ e CSLL.', 'lucro_presumido', 'fiscal', 'monthly', 25, 'high', true, true, 10),
  ('10000000-0000-4000-8100-000000000006', 'EFD Contribuicoes', 'Acompanhar entrega interna da EFD Contribuicoes.', 'lucro_presumido', 'fiscal', 'monthly', 15, 'medium', true, false, 20),
  ('10000000-0000-4000-8100-000000000007', 'SPED Fiscal', 'Acompanhar preparacao e evidencia interna do SPED Fiscal.', 'lucro_real', 'fiscal', 'monthly', 25, 'high', true, true, 10),
  ('10000000-0000-4000-8100-000000000008', 'Conciliacao fiscal do Lucro Real', 'Conferir base fiscal e pontos de revisao da competencia.', 'lucro_real', 'contabil', 'monthly', 22, 'high', true, false, 20)
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE
  period_record record;
BEGIN
  FOR period_record IN SELECT id FROM public.client_periods LOOP
    PERFORM public.create_fiscal_obligations_for_client_period(period_record.id);
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.touch_fiscal_obligation_templates() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_fiscal_obligation_completion() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_fiscal_obligations_for_client_period(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_fiscal_obligations_for_client_period_trigger() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_fiscal_obligation_from_task_status() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_fiscal_obligation_due_alert(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_fiscal_obligation_due_alert_trigger() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_fiscal_obligations_for_client_period(uuid) TO authenticated;

COMMIT;
