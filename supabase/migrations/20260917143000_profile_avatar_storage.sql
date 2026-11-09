BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS avatars_admin_upload ON storage.objects;
DROP POLICY IF EXISTS avatars_admin_update ON storage.objects;
DROP POLICY IF EXISTS avatars_admin_delete ON storage.objects;

CREATE POLICY avatars_admin_upload ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND split_part(name, '/', 1) = auth.uid()::text
  AND public.current_user_account_type() = 'admin'
);

CREATE POLICY avatars_admin_update ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'avatars'
  AND split_part(name, '/', 1) = auth.uid()::text
  AND public.current_user_account_type() = 'admin'
)
WITH CHECK (
  bucket_id = 'avatars'
  AND split_part(name, '/', 1) = auth.uid()::text
  AND public.current_user_account_type() = 'admin'
);

CREATE POLICY avatars_admin_delete ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'avatars'
  AND split_part(name, '/', 1) = auth.uid()::text
  AND public.current_user_account_type() = 'admin'
);

COMMIT;
