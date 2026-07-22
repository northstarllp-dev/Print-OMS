-- Configurable workshop production checklist (admin settings) + per-order progress

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS production_checklist_items jsonb NOT NULL DEFAULT '[
    {"id":"procurementOfMaterials","label":"Procurement of Materials","description":"Sourcing and procuring all required raw materials"},
    {"id":"acpAndAcrylicCutting","label":"ACP & Acrylic Cutting","description":"Precision cutting of ACP and acrylic sheets"},
    {"id":"lightingAndWiring","label":"Lighting & Wiring","description":"Installing LED modules and electrical wiring"},
    {"id":"qualityCheck","label":"Quality Check","description":"Final inspection and quality assurance"}
  ]'::jsonb;

ALTER TABLE public.productions
  ADD COLUMN IF NOT EXISTS checklist jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Backfill checklist progress from legacy boolean columns
UPDATE public.productions
SET checklist = jsonb_build_object(
  'procurementOfMaterials', COALESCE("procurementOfMaterials", false),
  'acpAndAcrylicCutting', COALESCE("acpAndAcrylicCutting", false),
  'lightingAndWiring', COALESCE("lightingAndWiring", false),
  'qualityCheck', COALESCE("qualityCheck", false)
)
WHERE checklist = '{}'::jsonb
   OR checklist IS NULL;
