-- Installation / fabrication / design-input flags on site_visits.
-- These columns exist on Printec-DB (added outside repo history). This migration
-- brings the committed schema in line with production and siteVisitMapper.ts.
-- Safe to re-run: IF NOT EXISTS on every column.

ALTER TABLE public.site_visits
  ADD COLUMN IF NOT EXISTS scaffolding_required boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS crane_required boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS overnight_installation boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS extra_angles_required boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS extra_angles_length text,
  ADD COLUMN IF NOT EXISTS extra_acp_sheet_required boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS old_board_removal_required boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS extra_wire_required boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS design_brief_available text,
  ADD COLUMN IF NOT EXISTS fabrication_required boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS civil_work_required boolean DEFAULT false;
