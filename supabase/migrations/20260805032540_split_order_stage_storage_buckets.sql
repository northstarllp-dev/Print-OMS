-- Split order-stage uploads into dedicated Storage buckets.
-- Existing: site-visit-photos, installation-photos
-- New:     order-resources, design-proofs, production-files

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'order-resources',
    'order-resources',
    true,
    52428800,
    ARRAY[
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/heic',
      'image/svg+xml',
      'application/pdf'
    ]::text[]
  ),
  (
    'design-proofs',
    'design-proofs',
    true,
    52428800,
    ARRAY[
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/heic',
      'application/pdf'
    ]::text[]
  ),
  (
    'production-files',
    'production-files',
    true,
    104857600,
    ARRAY[
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/heic',
      'application/pdf',
      'application/zip',
      'application/x-zip-compressed',
      'application/postscript',
      'image/vnd.adobe.photoshop',
      'application/octet-stream'
    ]::text[]
  )
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Authenticated upload / update / delete (mirrors installation-photos pattern).
-- Public read is via bucket.public = true + public URL.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Authenticated access to order-resources'
  ) THEN
    CREATE POLICY "Authenticated access to order-resources"
      ON storage.objects
      FOR ALL
      TO authenticated
      USING (bucket_id = 'order-resources')
      WITH CHECK (bucket_id = 'order-resources');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Public read order-resources'
  ) THEN
    CREATE POLICY "Public read order-resources"
      ON storage.objects
      FOR SELECT
      TO public
      USING (bucket_id = 'order-resources');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Authenticated access to design-proofs'
  ) THEN
    CREATE POLICY "Authenticated access to design-proofs"
      ON storage.objects
      FOR ALL
      TO authenticated
      USING (bucket_id = 'design-proofs')
      WITH CHECK (bucket_id = 'design-proofs');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Public read design-proofs'
  ) THEN
    CREATE POLICY "Public read design-proofs"
      ON storage.objects
      FOR SELECT
      TO public
      USING (bucket_id = 'design-proofs');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Authenticated access to production-files'
  ) THEN
    CREATE POLICY "Authenticated access to production-files"
      ON storage.objects
      FOR ALL
      TO authenticated
      USING (bucket_id = 'production-files')
      WITH CHECK (bucket_id = 'production-files');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Public read production-files'
  ) THEN
    CREATE POLICY "Public read production-files"
      ON storage.objects
      FOR SELECT
      TO public
      USING (bucket_id = 'production-files');
  END IF;
END $$;
