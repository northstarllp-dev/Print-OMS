-- Admin-configurable payment notification rules.
-- Triggers: stage_entered | milestone_created

CREATE TABLE IF NOT EXISTS payment_notification_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_name TEXT NOT NULL,
    trigger_type TEXT NOT NULL
        CHECK (trigger_type IN ('stage_entered', 'milestone_created')),
    trigger_value TEXT NOT NULL,
    channels TEXT[] NOT NULL DEFAULT ARRAY['email']::text[],
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    template_text TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_notification_rules_trigger_idx
    ON payment_notification_rules (trigger_type, trigger_value)
    WHERE is_enabled = true;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS payment_notification_rules_set_updated_at ON payment_notification_rules;
CREATE TRIGGER payment_notification_rules_set_updated_at
BEFORE UPDATE ON payment_notification_rules
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

ALTER TABLE payment_notification_rules ENABLE ROW LEVEL SECURITY;

-- Only admins (users.role = 'admin') may read/write rules
DROP POLICY IF EXISTS "Admins can manage payment notification rules" ON payment_notification_rules;
CREATE POLICY "Admins can manage payment notification rules"
ON payment_notification_rules
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
