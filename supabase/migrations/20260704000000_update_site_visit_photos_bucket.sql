-- Update site-visit-photos storage bucket to allow all MIME types (including PDFs, CDRs, DXFs, etc.)
-- and increase the maximum file size limit to 50MB.

UPDATE storage.buckets
SET allowed_mime_types = NULL,
    file_size_limit = 52428800 -- 50MB
WHERE id = 'site-visit-photos';
