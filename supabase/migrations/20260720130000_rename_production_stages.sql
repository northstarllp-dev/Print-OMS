-- Rename production milestone columns to generic stage1–stage4.
-- Display names come from app_settings.production_checklist_items.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'productions' AND column_name = 'procurementOfMaterials'
  ) THEN
    ALTER TABLE public.productions RENAME COLUMN "procurementOfMaterials" TO stage1;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'productions' AND column_name = 'acpAndAcrylicCutting'
  ) THEN
    ALTER TABLE public.productions RENAME COLUMN "acpAndAcrylicCutting" TO stage2;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'productions' AND column_name = 'lightingAndWiring'
  ) THEN
    ALTER TABLE public.productions RENAME COLUMN "lightingAndWiring" TO stage3;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'productions' AND column_name = 'qualityCheck'
  ) THEN
    ALTER TABLE public.productions RENAME COLUMN "qualityCheck" TO stage4;
  END IF;
END $$;

-- Ensure stage columns exist even on fresh DBs that never had the old names
ALTER TABLE public.productions
  ADD COLUMN IF NOT EXISTS stage1 boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS stage2 boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS stage3 boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS stage4 boolean DEFAULT false;

-- Remap checklist jsonb keys + keep stage columns as source for the first four
UPDATE public.productions
SET checklist = (
  COALESCE(checklist, '{}'::jsonb)
  - 'procurementOfMaterials'
  - 'acpAndAcrylicCutting'
  - 'lightingAndWiring'
  - 'qualityCheck'
) || jsonb_build_object(
  'stage1', COALESCE(stage1, false),
  'stage2', COALESCE(stage2, false),
  'stage3', COALESCE(stage3, false),
  'stage4', COALESCE(stage4, false)
);

-- Remap settings item ids from old camelCase keys to stage1–stage4
UPDATE public.app_settings
SET production_checklist_items = COALESCE((
  SELECT jsonb_agg(
    CASE elem->>'id'
      WHEN 'procurementOfMaterials' THEN jsonb_set(elem, '{id}', '"stage1"')
      WHEN 'acpAndAcrylicCutting' THEN jsonb_set(elem, '{id}', '"stage2"')
      WHEN 'lightingAndWiring' THEN jsonb_set(elem, '{id}', '"stage3"')
      WHEN 'qualityCheck' THEN jsonb_set(elem, '{id}', '"stage4"')
      ELSE elem
    END
    ORDER BY ordinality
  )
  FROM jsonb_array_elements(COALESCE(production_checklist_items, '[]'::jsonb))
    WITH ORDINALITY AS t(elem, ordinality)
), '[
  {"id":"stage1","label":"Procurement of Materials","description":"Sourcing and procuring all required raw materials"},
  {"id":"stage2","label":"ACP & Acrylic Cutting","description":"Precision cutting of ACP and acrylic sheets"},
  {"id":"stage3","label":"Lighting & Wiring","description":"Installing LED modules and electrical wiring"},
  {"id":"stage4","label":"Quality Check","description":"Final inspection and quality assurance"}
]'::jsonb);

ALTER TABLE public.app_settings
  ALTER COLUMN production_checklist_items SET DEFAULT '[
    {"id":"stage1","label":"Procurement of Materials","description":"Sourcing and procuring all required raw materials"},
    {"id":"stage2","label":"ACP & Acrylic Cutting","description":"Precision cutting of ACP and acrylic sheets"},
    {"id":"stage3","label":"Lighting & Wiring","description":"Installing LED modules and electrical wiring"},
    {"id":"stage4","label":"Quality Check","description":"Final inspection and quality assurance"}
  ]'::jsonb;
