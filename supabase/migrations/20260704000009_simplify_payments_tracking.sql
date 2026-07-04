-- Simplify payments to financial tracking only.
-- No stage gates, no verification workflow, no payment_gate_stages.

UPDATE orders
SET stage_status = 'Normal'
WHERE stage_status = 'Pending Payment Verification';

DROP TABLE IF EXISTS payment_gate_stages;

-- Drop status check before rewriting values
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;

UPDATE payments
SET status = 'received'
WHERE status IN ('verified', 'paid');

UPDATE payments
SET status = 'expected'
WHERE status NOT IN ('expected', 'received');

ALTER TABLE payments
  ADD CONSTRAINT payments_status_check
  CHECK (status IN ('expected', 'received'));

ALTER TABLE payments
  ALTER COLUMN status SET DEFAULT 'expected';

ALTER TABLE payments
  ALTER COLUMN required_for_next_stage SET DEFAULT false;

UPDATE payments SET required_for_next_stage = false;
