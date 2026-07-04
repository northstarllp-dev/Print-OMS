-- WhatsApp / notification dispatch audit log.

CREATE TABLE IF NOT EXISTS notification_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    template_key TEXT NOT NULL,
    recipient_phone TEXT NOT NULL,
    order_id TEXT,
    enquiry_id UUID REFERENCES enquiries(id) ON DELETE SET NULL,
    body_parameters JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
    idempotency_key TEXT NOT NULL UNIQUE,
    meta_message_id TEXT,
    error_message TEXT,
    attempts INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS notification_outbox_status_idx
    ON notification_outbox (status)
    WHERE status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS notification_outbox_order_idx
    ON notification_outbox (order_id);

CREATE INDEX IF NOT EXISTS notification_outbox_created_idx
    ON notification_outbox (created_at DESC);

ALTER TABLE notification_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read notification outbox" ON notification_outbox;
CREATE POLICY "Staff can read notification outbox"
ON notification_outbox FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Staff can insert notification outbox" ON notification_outbox;
CREATE POLICY "Staff can insert notification outbox"
ON notification_outbox FOR INSERT TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Staff can update notification outbox" ON notification_outbox;
CREATE POLICY "Staff can update notification outbox"
ON notification_outbox FOR UPDATE TO authenticated
USING (true)
WITH CHECK (true);
