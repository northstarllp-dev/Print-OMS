-- Per-stage auto-approval toggles for the order pipeline.
-- When ON for a stage, staff requestStageAdvancementAction will advance the
-- order to the next stage without requiring an admin to click Approve.
-- Default: all off (preserves existing admin-approval behavior).
--
-- Timestamp is after 20260818100000_add_delivery_method_to_orders.sql so
-- both migrations can apply on a fresh database.

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS workflow_auto_approval jsonb
  NOT NULL DEFAULT '{"site_visit":false,"quotation":false,"design":false,"production":false,"installation":false}'::jsonb;

COMMENT ON COLUMN public.app_settings.workflow_auto_approval IS
  'Per-stage booleans. When true, staff stage-advancement requests for that stage auto-advance instead of parking in Pending Admin Approval.';
