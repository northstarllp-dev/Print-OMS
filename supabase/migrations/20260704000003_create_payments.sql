-- Flexible payment milestones (business gates, not pipeline stages).
-- Locks use orders.stage_status = 'Pending Payment Verification'.

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    payment_name TEXT NOT NULL,
    trigger_stage TEXT NOT NULL,
    amount_type TEXT NOT NULL CHECK (amount_type IN ('fixed', 'percentage')),
    amount NUMERIC,
    percentage NUMERIC,
    calculated_amount NUMERIC,
    required_for_next_stage BOOLEAN NOT NULL DEFAULT true,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'requested', 'paid', 'verified', 'waived')),
    payment_method TEXT,
    payment_reference TEXT,
    notes TEXT,
    requested_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    verified_at TIMESTAMPTZ,
    verified_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payments_order_id_idx ON payments(order_id);
CREATE INDEX IF NOT EXISTS payments_status_idx ON payments(status);
CREATE INDEX IF NOT EXISTS payments_trigger_stage_idx ON payments(trigger_stage);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS payments_set_updated_at ON payments;
CREATE TRIGGER payments_set_updated_at
BEFORE UPDATE ON payments
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON payments;
CREATE POLICY "Enable all access for authenticated users" ON payments
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);
