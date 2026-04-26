UPDATE storage.buckets
SET public = false
WHERE id = 'documents';

DROP POLICY IF EXISTS "tenant storage access" ON storage.objects;
DROP POLICY IF EXISTS "Users can view document files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload document files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update document files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete document files" ON storage.objects;

CREATE POLICY "Users can view document files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND EXISTS (
    SELECT 1
    FROM public.documents d
    WHERE d.file_path = storage.objects.name
      AND (
        d.uploaded_by = auth.uid()
        OR d.tenant_id = public.current_user_tenant_id()
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
      )
  )
);

CREATE POLICY "Users can upload document files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);

CREATE POLICY "Users can update document files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documents'
  AND EXISTS (
    SELECT 1
    FROM public.documents d
    WHERE d.file_path = storage.objects.name
      AND (
        d.uploaded_by = auth.uid()
        OR d.tenant_id = public.current_user_tenant_id()
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
      )
  )
)
WITH CHECK (
  bucket_id = 'documents'
  AND EXISTS (
    SELECT 1
    FROM public.documents d
    WHERE d.file_path = storage.objects.name
      AND (
        d.uploaded_by = auth.uid()
        OR d.tenant_id = public.current_user_tenant_id()
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
      )
  )
);

CREATE POLICY "Users can delete document files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents'
  AND EXISTS (
    SELECT 1
    FROM public.documents d
    WHERE d.file_path = storage.objects.name
      AND (
        d.uploaded_by = auth.uid()
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
      )
  )
);

DROP POLICY IF EXISTS "Users can create their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can create their own profile as client" ON public.profiles;

CREATE POLICY "Users can create their own profile as client"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND account_type = 'client'
);