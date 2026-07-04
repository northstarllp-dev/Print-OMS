-- Replace automated notification rules with admin-configurable payment-gate prompts.
-- When advancing FROM an enabled stage, show "Is payment required before the next stage?"

DROP TABLE IF EXISTS payment_notification_rules;

CREATE TABLE IF NOT EXISTS payment_gate_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stage TEXT NOT NULL UNIQUE,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_gate_stages_enabled_idx
    ON payment_gate_stages (stage)
    WHERE is_enabled = true;

DROP TRIGGER IF EXISTS payment_gate_stages_set_updated_at ON payment_gate_stages;
CREATE TRIGGER payment_gate_stages_set_updated_at
BEFORE UPDATE ON payment_gate_stages
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

ALTER TABLE payment_gate_stages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage payment gate stages" ON payment_gate_stages;
CREATE POLICY "Admins can manage payment gate stages"
ON payment_gate_stages
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid() AND u.role = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid() AND u.role = 'admin'
    )
);

-- Staff need to read which stages prompt for payment
DROP POLICY IF EXISTS "Authenticated can read payment gate stages" ON payment_gate_stages;
CREATE POLICY "Authenticated can read payment gate stages"
ON payment_gate_stages
FOR SELECT
TO authenticated
USING (true);

-- Default: prompt on these stages when advancing (admin can disable any)
INSERT INTO payment_gate_stages (stage, is_enabled) VALUES
    ('Site Visit Pending', true),
    ('Site Visit Scheduled', true),
    ('Site Visit Completed', true),
    ('Quotation In Progress', true),
    ('Quotation Sent', true),
    ('Quotation Negotiation', true),
    ('Quotation Approved', true),
    ('Design In Progress', true),
    ('Design Approved', true),
    ('Production', true),
    ('Ready For Installation', true),
    ('Installation Scheduled', true)
ON CONFLICT (stage) DO NOTHING;
