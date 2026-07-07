-- Align site_visits / site_visit_measurements with Printec-DB (MCP-verified 2026-07-07).
-- Idempotent: safe on prod (already applied shape) and fixes supabase db reset locally.

-- ── site_visits: drop legacy root columns superseded by per-location measurements ──
ALTER TABLE public.site_visits
  DROP COLUMN IF EXISTS customer_contact,
  DROP COLUMN IF EXISTS site_personnel,
  DROP COLUMN IF EXISTS available_slots,
  DROP COLUMN IF EXISTS checked_in,
  DROP COLUMN IF EXISTS check_in_time,
  DROP COLUMN IF EXISTS check_in_gps,
  DROP COLUMN IF EXISTS check_in_timer_start,
  DROP COLUMN IF EXISTS elapsed_duration,
  DROP COLUMN IF EXISTS visit_started,
  DROP COLUMN IF EXISTS visit_start_timestamp,
  DROP COLUMN IF EXISTS start_gps_location,
  DROP COLUMN IF EXISTS start_device_info,
  DROP COLUMN IF EXISTS distance_to_power_source,
  DROP COLUMN IF EXISTS distance_to_power_source_unit,
  DROP COLUMN IF EXISTS electrical_notes,
  DROP COLUMN IF EXISTS audio_note_url,
  DROP COLUMN IF EXISTS surface_condition,
  DROP COLUMN IF EXISTS obstacles,
  DROP COLUMN IF EXISTS customer_budget,
  DROP COLUMN IF EXISTS expected_timeline,
  DROP COLUMN IF EXISTS customer_preferences,
  DROP COLUMN IF EXISTS competitor_references,
  DROP COLUMN IF EXISTS suggested_product_type,
  DROP COLUMN IF EXISTS additional_observations,
  DROP COLUMN IF EXISTS contact_person,
  DROP COLUMN IF EXISTS power_available,
  DROP COLUMN IF EXISTS electrical_photos,
  DROP COLUMN IF EXISTS wall_type,
  DROP COLUMN IF EXISTS mounting_method,
  DROP COLUMN IF EXISTS structural_notes,
  DROP COLUMN IF EXISTS photo_categories,
  DROP COLUMN IF EXISTS review_notes,
  DROP COLUMN IF EXISTS audit_trail;

-- ── site_visit_measurements: electrical / structural per location ──
ALTER TABLE public.site_visit_measurements
  ADD COLUMN IF NOT EXISTS power_available boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS distance_to_power_source numeric,
  ADD COLUMN IF NOT EXISTS distance_to_power_source_unit text,
  ADD COLUMN IF NOT EXISTS electrical_notes text,
  ADD COLUMN IF NOT EXISTS wall_type text,
  ADD COLUMN IF NOT EXISTS mounting_method text,
  ADD COLUMN IF NOT EXISTS surface_condition text,
  ADD COLUMN IF NOT EXISTS obstacles jsonb,
  ADD COLUMN IF NOT EXISTS structural_notes text;

-- ── performance + dedupe indexes ──
CREATE INDEX IF NOT EXISTS site_visit_measurements_site_visit_id_idx
  ON public.site_visit_measurements (site_visit_id);

ALTER TABLE public.site_visits DROP CONSTRAINT IF EXISTS site_visits_order_id_unique;
