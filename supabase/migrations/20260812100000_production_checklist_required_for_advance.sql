-- Add admin setting to control whether the production checklist
-- must be fully checked before advancing to the next stage.
-- Default: required (preserves existing behavior).
ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS production_checklist_required_for_advance boolean DEFAULT true;
