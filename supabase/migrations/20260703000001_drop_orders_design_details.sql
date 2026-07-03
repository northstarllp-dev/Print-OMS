-- Cleanup: remove the legacy design_details JSONB column from orders.
-- Only run after the designs table is populated and all code paths have been cut over.

ALTER TABLE orders DROP COLUMN IF EXISTS design_details;
