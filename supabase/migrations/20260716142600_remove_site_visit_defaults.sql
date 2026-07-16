-- Drop default false constraints for site_visits boolean requirements so they remain unselected in UI
ALTER TABLE "public"."site_visits"
  ALTER COLUMN "scaffolding_required" DROP DEFAULT,
  ALTER COLUMN "crane_required" DROP DEFAULT,
  ALTER COLUMN "overnight_installation" DROP DEFAULT,
  ALTER COLUMN "extra_angles_required" DROP DEFAULT,
  ALTER COLUMN "extra_acp_sheet_required" DROP DEFAULT,
  ALTER COLUMN "old_board_removal_required" DROP DEFAULT,
  ALTER COLUMN "extra_wire_required" DROP DEFAULT,
  ALTER COLUMN "fabrication_required" DROP DEFAULT,
  ALTER COLUMN "civil_work_required" DROP DEFAULT;

-- Nullify existing false values that were set by default (only on incomplete site visits)
UPDATE "public"."site_visits"
SET
  "scaffolding_required" = NULL,
  "crane_required" = NULL,
  "overnight_installation" = NULL,
  "extra_angles_required" = NULL,
  "extra_acp_sheet_required" = NULL,
  "old_board_removal_required" = NULL,
  "extra_wire_required" = NULL,
  "fabrication_required" = NULL,
  "civil_work_required" = NULL
WHERE "completed" = false;
