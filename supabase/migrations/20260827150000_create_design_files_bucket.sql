-- New bucket: design-files (designer source files: .cdr, .ai, .psd, .eps, .svg, .pdf, etc.)
-- Private; signed upload/read via the production pipeline (TUS resumable).
-- Accessible from both design and production stages.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'design-files',
  'design-files',
  false,
  52428800,
  ARRAY[
    'image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif',
    'image/svg+xml','application/pdf','application/postscript',
    'application/octet-stream','application/zip','application/x-zip-compressed',
    'image/vnd.adobe.photoshop','application/dxf','image/x-dxf','application/plt'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 52428800,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- RLS: authenticated staff can manage objects in this bucket.
DROP POLICY IF EXISTS "Authenticated manage design-files" ON storage.objects;
CREATE POLICY "Authenticated manage design-files"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'design-files')
WITH CHECK (bucket_id = 'design-files');
