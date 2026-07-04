-- Ensure unit columns exist on site_visit_measurements (used by quotation + site visit UIs).
ALTER TABLE public.site_visit_measurements
  ADD COLUMN IF NOT EXISTS width_unit text DEFAULT 'ft',
  ADD COLUMN IF NOT EXISTS height_unit text DEFAULT 'ft',
  ADD COLUMN IF NOT EXISTS depth_unit text DEFAULT 'ft',
  ADD COLUMN IF NOT EXISTS ground_clearance_unit text DEFAULT 'ft';

UPDATE public.site_visit_measurements SET width_unit = 'ft' WHERE width_unit IS NULL;
UPDATE public.site_visit_measurements SET height_unit = 'ft' WHERE height_unit IS NULL;
UPDATE public.site_visit_measurements SET depth_unit = 'ft' WHERE depth_unit IS NULL;
UPDATE public.site_visit_measurements SET ground_clearance_unit = 'ft' WHERE ground_clearance_unit IS NULL;
