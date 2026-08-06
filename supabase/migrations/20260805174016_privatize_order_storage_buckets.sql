-- Privatize customer-facing order/service buckets; keep product-images public.
-- Uploads and reads go through short-lived signed URLs issued by the server.

-- 1) Flip visibility
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

-- product-images stays public (catalogue/marketing); ensure sane limit
UPDATE storage.buckets
SET public = true
WHERE id = 'product-images';

-- 2) Remove broad public read policies on the now-private buckets.
--    Signed URLs bypass RLS; RLS remains as defense-in-depth for direct access.
DROP POLICY IF EXISTS "Public read order-resources" ON storage.objects;
DROP POLICY IF EXISTS "Public read design-proofs" ON storage.objects;
DROP POLICY IF EXISTS "Public read production-files" ON storage.objects;
DROP POLICY IF EXISTS "Give public read access to installation-photos" ON storage.objects;
DROP POLICY IF EXISTS "Public Insert" ON storage.objects;
DROP POLICY IF EXISTS "Public Update" ON storage.objects;
DROP POLICY IF EXISTS "Public Delete" ON storage.objects;
DROP POLICY IF EXISTS "Auth upload site visit photos" ON storage.objects;
DROP POLICY IF EXISTS "Auth delete site visit photos" ON storage.objects;

-- 3) Enforce size limits where missing (images 50MB, production 100MB already set)
UPDATE storage.buckets SET file_size_limit = 52428800 WHERE id IN (
  'site-visit-photos',
  'order-resources',
  'design-proofs',
  'installation-photos',
  'service-ticket-photos',
  'service-ticket-resolution-photos'
) AND file_size_limit IS NULL;

-- 4) Defense-in-depth: allow authenticated staff to manage objects in these buckets.
--    Signed upload/read URLs are the primary path; RLS here covers direct SDK access.
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
