-- Track last pipeline stage advancement for Needs Attention stall detection.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS stage_changed_at timestamp with time zone;

UPDATE public.orders
SET stage_changed_at = coalesce(date_created, now())
WHERE stage_changed_at IS NULL;

ALTER TABLE public.orders
  ALTER COLUMN stage_changed_at SET DEFAULT now(),
  ALTER COLUMN stage_changed_at SET NOT NULL;

COMMENT ON COLUMN public.orders.stage_changed_at IS
  'Timestamp of last pipeline stage change; used to auto-flag Active → Needs Attention after N days.';
