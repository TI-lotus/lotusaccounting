BEGIN;

DROP TRIGGER IF EXISTS trg_audit_client_periods ON public.client_periods;
CREATE TRIGGER trg_audit_client_periods
AFTER INSERT OR UPDATE OR DELETE ON public.client_periods
FOR EACH ROW EXECUTE FUNCTION public.log_entity_activity();

DROP TRIGGER IF EXISTS trg_audit_client_period_steps ON public.client_period_steps;
CREATE TRIGGER trg_audit_client_period_steps
AFTER INSERT OR UPDATE OR DELETE ON public.client_period_steps
FOR EACH ROW EXECUTE FUNCTION public.log_entity_activity();

DROP TRIGGER IF EXISTS trg_audit_client_period_checklist_items ON public.client_period_checklist_items;
CREATE TRIGGER trg_audit_client_period_checklist_items
AFTER INSERT OR UPDATE OR DELETE ON public.client_period_checklist_items
FOR EACH ROW EXECUTE FUNCTION public.log_entity_activity();

DROP TRIGGER IF EXISTS trg_audit_document_requests ON public.document_requests;
CREATE TRIGGER trg_audit_document_requests
AFTER INSERT OR UPDATE OR DELETE ON public.document_requests
FOR EACH ROW EXECUTE FUNCTION public.log_entity_activity();

DROP TRIGGER IF EXISTS trg_audit_task_reviews ON public.task_reviews;
CREATE TRIGGER trg_audit_task_reviews
AFTER INSERT OR UPDATE OR DELETE ON public.task_reviews
FOR EACH ROW EXECUTE FUNCTION public.log_entity_activity();

DROP TRIGGER IF EXISTS trg_audit_operational_comments ON public.operational_comments;
CREATE TRIGGER trg_audit_operational_comments
AFTER INSERT OR UPDATE OR DELETE ON public.operational_comments
FOR EACH ROW EXECUTE FUNCTION public.log_entity_activity();

COMMIT;
