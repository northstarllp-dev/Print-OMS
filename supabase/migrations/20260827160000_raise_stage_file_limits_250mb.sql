-- Raise per-file upload limit for design source + production buckets to 250 MB.
UPDATE storage.buckets
SET file_size_limit = 262144000
WHERE id IN ('design-files', 'production-files');
