BEGIN;

CREATE OR REPLACE FUNCTION public.guard_document_path()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'authenticated' OR auth.role() IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.file_path IS NOT DISTINCT FROM OLD.file_path THEN RETURN NEW; END IF;

  IF NEW.file_path IS NOT NULL AND split_part(NEW.file_path, '/', 1) <> NEW.tenant_id::text THEN
    RAISE EXCEPTION 'Document path belongs to another workspace' USING ERRCODE = '42501';
  END IF;
  IF public.current_user_account_type() = 'client' AND (
    NEW.file_path IS NULL OR NOT public.can_upload_document_object(NEW.file_path)
    OR NEW.uploaded_by IS DISTINCT FROM auth.uid()
  ) THEN
    RAISE EXCEPTION 'Clients may only register their own company uploads' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER guard_document_path BEFORE INSERT OR UPDATE OF file_path ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.guard_document_path();
REVOKE ALL ON FUNCTION public.guard_document_path() FROM PUBLIC, anon, authenticated;

COMMIT;
