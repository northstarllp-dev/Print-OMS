-- PrintOMS E2E seed baseline
-- Applied by `npx supabase db reset` after migrations.
-- Company UUIDs match src/config/clients/*/index.ts

BEGIN;

-- ── Companies ──────────────────────────────────────────────────────────────
INSERT INTO public.companies (id, name, slug, address)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Printoms', 'printoms', 'Bengaluru, Karnataka'),
  ('33333333-3333-3333-3333-333333333333', 'Printec', 'printec', 'Mumbai, Maharashtra')
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name, slug = EXCLUDED.slug, address = EXCLUDED.address;

-- ── App settings ───────────────────────────────────────────────────────────
INSERT INTO public.app_settings (
  company_id,
  site_visit_scheduling_enabled,
  installation_scheduling_enabled,
  production_checklist_items
)
VALUES
  (
    '11111111-1111-1111-1111-111111111111',
    true,
    true,
    '[
      {"id":"procurementOfMaterials","label":"Procurement of Materials","description":"Sourcing and procuring all required raw materials"},
      {"id":"acpAndAcrylicCutting","label":"ACP & Acrylic Cutting","description":"Precision cutting of ACP and acrylic sheets"},
      {"id":"lightingAndWiring","label":"Lighting & Wiring","description":"Installing LED modules and electrical wiring"},
      {"id":"qualityCheck","label":"Quality Check","description":"Final inspection and quality assurance"}
    ]'::jsonb
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    true,
    true,
    '[
      {"id":"procurementOfMaterials","label":"Procurement of Materials","description":"Sourcing and procuring all required raw materials"},
      {"id":"acpAndAcrylicCutting","label":"ACP & Acrylic Cutting","description":"Precision cutting of ACP and acrylic sheets"},
      {"id":"lightingAndWiring","label":"Lighting & Wiring","description":"Installing LED modules and electrical wiring"},
      {"id":"qualityCheck","label":"Quality Check","description":"Final inspection and quality assurance"}
    ]'::jsonb
  )
ON CONFLICT (company_id) DO UPDATE
SET
  site_visit_scheduling_enabled = EXCLUDED.site_visit_scheduling_enabled,
  installation_scheduling_enabled = EXCLUDED.installation_scheduling_enabled,
  production_checklist_items = EXCLUDED.production_checklist_items;

-- ── Users (password for all: TestPass123!) ─────────────────────────────────
-- Idempotent: only seed if email not already present in auth.users
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@printoms.test') THEN
    PERFORM public.seed_app_user(
      'admin@printoms.test', 'TestPass123!',
      '11111111-1111-1111-1111-111111111111',
      'Priya Admin', 'admin', '919900000001', NULL
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'marketer@printoms.test') THEN
    PERFORM public.seed_app_user(
      'marketer@printoms.test', 'TestPass123!',
      '11111111-1111-1111-1111-111111111111',
      'Arjun Marketer', 'staff', '919900000002', 'Marketer'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'designer@printoms.test') THEN
    PERFORM public.seed_app_user(
      'designer@printoms.test', 'TestPass123!',
      '11111111-1111-1111-1111-111111111111',
      'Meera Designer', 'staff', '919900000003', 'Designer'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'production@printoms.test') THEN
    PERFORM public.seed_app_user(
      'production@printoms.test', 'TestPass123!',
      '11111111-1111-1111-1111-111111111111',
      'Ravi Production', 'staff', '919900000004', 'Production'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'installation@printoms.test') THEN
    PERFORM public.seed_app_user(
      'installation@printoms.test', 'TestPass123!',
      '11111111-1111-1111-1111-111111111111',
      'Karan Installation', 'staff', '919900000005', 'Installation'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@printec.test') THEN
    PERFORM public.seed_app_user(
      'admin@printec.test', 'TestPass123!',
      '33333333-3333-3333-3333-333333333333',
      'Printec Admin', 'admin', '919900000099', NULL
    );
  END IF;
END $$;

-- Ensure Active status (migration may default it)
UPDATE public.users
SET status = 'Active'
WHERE email LIKE '%@printoms.test' OR email LIKE '%@printec.test';

-- ── Products ───────────────────────────────────────────────────────────────
INSERT INTO public.products (
  product_id, company_id, name, description, category,
  pricing_type, price_per_sqft, price_per_unit, is_active
)
VALUES
  (
    'PRD-LED-001',
    '11111111-1111-1111-1111-111111111111',
    '3D LED Channel Letters',
    'Premium acrylic channel letters with halo lighting',
    'Signage',
    'per_sqft',
    850,
    NULL,
    true
  ),
  (
    'PRD-ACP-001',
    '11111111-1111-1111-1111-111111111111',
    'ACP Sign Board',
    'Aluminum composite panel with vinyl graphics',
    'Signage',
    'per_sqft',
    420,
    NULL,
    true
  ),
  (
    'PRD-LBOX-001',
    '11111111-1111-1111-1111-111111111111',
    'Lightbox Panel',
    'Backlit fabric lightbox for retail fronts',
    'Signage',
    'per_unit',
    NULL,
    18500,
    true
  )
ON CONFLICT (company_id, product_id) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active;

-- ── Storage buckets (one per order stage; private except product-images)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('site-visit-photos','site-visit-photos',false,52428800,ARRAY['image/jpeg','image/png','image/webp','image/heic','application/pdf']::text[]),
  ('order-resources','order-resources',false,52428800,ARRAY['image/jpeg','image/png','image/webp','image/gif','image/heic','image/svg+xml','application/pdf']::text[]),
  ('design-proofs','design-proofs',false,52428800,ARRAY['image/jpeg','image/png','image/webp','image/gif','image/heic','application/pdf']::text[]),
  ('production-files','production-files',false,262144000,ARRAY['image/jpeg','image/png','image/webp','image/gif','image/heic','application/pdf','application/zip','application/x-zip-compressed','application/postscript','image/vnd.adobe.photoshop','application/octet-stream']::text[]),
  ('installation-photos','installation-photos',false,52428800,ARRAY['image/jpeg','image/png','image/webp','image/heic']::text[])
ON CONFLICT (id) DO NOTHING;

-- Permissive local storage policies for E2E (signed URLs are the primary path in prod)
DO $$
DECLARE
  b text;
BEGIN
  FOREACH b IN ARRAY ARRAY[
    'site-visit-photos',
    'order-resources',
    'design-proofs',
    'production-files',
    'installation-photos'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'storage'
        AND tablename = 'objects'
        AND policyname = format('e2e_%s_all', replace(b, '-', '_'))
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON storage.objects FOR ALL TO authenticated, anon USING (bucket_id = %L) WITH CHECK (bucket_id = %L)',
        format('e2e_%s_all', replace(b, '-', '_')),
        b,
        b
      );
    END IF;
  END LOOP;
END $$;

COMMIT;
