-- Drop unused payment-gate / legacy checklist columns and tables.

ALTER TABLE payments
  DROP COLUMN IF EXISTS required_for_next_stage,
  DROP COLUMN IF EXISTS payment_method,
  DROP COLUMN IF EXISTS payment_reference,
  DROP COLUMN IF EXISTS requested_at,
  DROP COLUMN IF EXISTS verified_at,
  DROP COLUMN IF EXISTS verified_by;

ALTER TABLE designs
  DROP COLUMN IF EXISTS payment_verified;

ALTER TABLE quotations
  DROP COLUMN IF EXISTS advance_paid,
  DROP COLUMN IF EXISTS advance_percent,
  DROP COLUMN IF EXISTS advance_amount,
  DROP COLUMN IF EXISTS amount_paid;

DROP TABLE IF EXISTS payment_notification_rules;

-- Portal is view-only; remove write access for anon.
DROP POLICY IF EXISTS "Enable update access for anon users on payments" ON payments;
