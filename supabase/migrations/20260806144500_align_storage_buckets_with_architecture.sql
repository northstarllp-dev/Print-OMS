-- Align bucket MIME allowlists with app storageConfig + clean duplicate RLS policies.
-- Architecture: 7 private order/service buckets; product-images public.

-- 1) MIME allowlists (defense-in-depth; app validates too)
UPDATE storage.buckets SET allowed_mime_types = ARRAY[
  'image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif','application/pdf'
]::text[]
WHERE id = 'site-visit-photos';

UPDATE storage.buckets SET allowed_mime_types = ARRAY[
  'image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif'
]::text[]
WHERE id = 'installation-photos';

UPDATE storage.buckets SET allowed_mime_types = ARRAY[
  'image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif'
]::text[]
WHERE id IN ('service-ticket-photos', 'service-ticket-resolution-photos');

-- Align order-resources / design-proofs / production-files with app allowlists
UPDATE storage.buckets SET allowed_mime_types = ARRAY[
  'image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif',
  'image/svg+xml','application/pdf','application/postscript','application/octet-stream'
]::text[]
WHERE id = 'order-resources';

UPDATE storage.buckets SET allowed_mime_types = ARRAY[
  'image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif','application/pdf'
]::text[]
WHERE id = 'design-proofs';

UPDATE storage.buckets SET allowed_mime_types = ARRAY[
  'image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif',
  'image/svg+xml','application/pdf','application/zip','application/x-zip-compressed',
  'application/postscript','image/vnd.adobe.photoshop','application/octet-stream',
  'application/dxf','image/x-dxf','application/plt'
]::text[]
WHERE id = 'production-files';

-- product-images already correct (jpeg/png/webp/gif, public, 50MB)

-- 2) Drop duplicate authenticated ALL policies (keep "Authenticated manage …")
DROP POLICY IF EXISTS "Authenticated access to design-proofs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated access to order-resources" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated access to production-files" ON storage.objects;
DROP POLICY IF EXISTS "Give authenticated users full access to installation-photos" ON storage.objects;

-- Ensure manage policies exist for all private buckets (idempotent)
DO $$
DECLARE
  b text;
BEGIN
  FOREACH b IN ARRAY ARRAY[
    'site-visit-photos',
    'order-resources',
    'design-proofs',
    'production-files',
    'installation-photos',
    'service-ticket-photos',
    'service-ticket-resolution-photos'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'storage'
        AND tablename = 'objects'
        AND policyname = format('Authenticated manage %s', b)
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON storage.objects FOR ALL TO authenticated USING (bucket_id = %L) WITH CHECK (bucket_id = %L)',
        format('Authenticated manage %s', b),
        b,
        b
      );
    END IF;
  END LOOP;
END $$;

-- Ensure private visibility
UPDATE storage.buckets
SET public = false
WHERE id IN (
  'site-visit-photos',
  'order-resources',
  'design-proofs',
  'production-files',
  'installation-photos',
  'service-ticket-photos',
  'service-ticket-resolution-photos'
);

UPDATE storage.buckets
SET public = true,
    file_size_limit = COALESCE(GREATEST(file_size_limit, 52428800), 52428800)
WHERE id = 'product-images';
