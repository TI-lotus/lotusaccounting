ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS file_size bigint,
  ADD COLUMN IF NOT EXISTS mime_type text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS documents_storage_select ON storage.objects;
CREATE POLICY documents_storage_select
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'documents'
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.tenant_id::text = (storage.foldername(name))[1]
  )
);

DROP POLICY IF EXISTS documents_storage_insert ON storage.objects;
CREATE POLICY documents_storage_insert
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.tenant_id::text = (storage.foldername(name))[1]
  )
);

DROP POLICY IF EXISTS documents_storage_update ON storage.objects;
CREATE POLICY documents_storage_update
ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'documents'
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.tenant_id::text = (storage.foldername(name))[1]
  )
)
WITH CHECK (
  bucket_id = 'documents'
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.tenant_id::text = (storage.foldername(name))[1]
  )
);

DROP POLICY IF EXISTS documents_storage_delete ON storage.objects;
CREATE POLICY documents_storage_delete
ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'documents'
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.tenant_id::text = (storage.foldername(name))[1]
  )
);
