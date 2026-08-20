-- Allow authenticated staff to manage catalog images under products/.
-- Public bucket enables public READ; writes still require RLS.

UPDATE storage.buckets
SET file_size_limit = 52428800
WHERE id = 'product-images'
  AND (file_size_limit IS NULL OR file_size_limit < 52428800);

DROP POLICY IF EXISTS "Authenticated insert product-images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update product-images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete product-images" ON storage.objects;

CREATE POLICY "Authenticated insert product-images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND name LIKE 'products/%'
  AND name NOT LIKE '%..%'
);

CREATE POLICY "Authenticated update product-images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND name LIKE 'products/%'
  AND name NOT LIKE '%..%'
)
WITH CHECK (
  bucket_id = 'product-images'
  AND name LIKE 'products/%'
  AND name NOT LIKE '%..%'
);

CREATE POLICY "Authenticated delete product-images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND name LIKE 'products/%'
  AND name NOT LIKE '%..%'
);
