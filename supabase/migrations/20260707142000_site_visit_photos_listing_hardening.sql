-- Reduce data exposure from public storage object enumeration.
-- Keep existing upload/download behavior intact while removing broad anon listing.

-- Remove broad public listing/read-through-API policies for design/site-visit bucket.
drop policy if exists "Public Select" on storage.objects;
drop policy if exists "Public read site visit photos" on storage.objects;

-- Intentionally keep no broad SELECT policy on this public bucket to prevent
-- object listing through storage API. Public object URLs still work.
