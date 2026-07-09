-- 1. Add slug column to companies table
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS slug text UNIQUE;

-- 2. Populate the 3 tenant companies
-- The Board Company (Existing)
UPDATE public.companies SET slug = 'the-board-company' WHERE id = '22222222-2222-2222-2222-222222222222';

-- Printec (New)
INSERT INTO public.companies (id, name, slug)
VALUES ('33333333-3333-3333-3333-333333333333', 'Printec', 'printec')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug;

-- Hitech Vision (New)
INSERT INTO public.companies (id, name, slug)
VALUES ('44444444-4444-4444-4444-444444444444', 'Hitech Vision', 'hitech-vision')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug;
