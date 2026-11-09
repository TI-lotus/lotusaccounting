BEGIN;

-- Office staff must still be able to remove orphaned objects after metadata deletion.
CREATE OR REPLACE FUNCTION public.can_read_document_object(object_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT (public.can_manage_current_tenant() AND split_part(object_name, '/', 1) = public.current_user_tenant_id()::text)
    OR EXISTS (SELECT 1 FROM public.documents d
      WHERE d.file_path = object_name AND d.tenant_id = public.current_user_tenant_id()
        AND (public.can_manage_current_tenant() OR d.company_id = public.current_user_company_id()))
    OR (public.can_upload_document_object(object_name) AND NOT EXISTS (SELECT 1 FROM public.documents WHERE file_path = object_name))
$$;

COMMIT;
