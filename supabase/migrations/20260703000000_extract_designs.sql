-- Extract design data from orders.design_details into a dedicated designs table.
-- Phase 1: create table + indexes + trigger
-- Phase 2: migrate data (idempotent UPSERT on order_id)
-- Phase 3: enable RLS
-- NOTE: orders.design_details is intentionally NOT dropped here; it is removed in the cleanup migration after all code has been cut over.

-- 1. Create designs table
CREATE TABLE IF NOT EXISTS designs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    resources JSONB NOT NULL DEFAULT '[]'::jsonb,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    payment_verified BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Unique constraint / index on order_id
ALTER TABLE designs DROP CONSTRAINT IF EXISTS designs_order_id_unique;
ALTER TABLE designs ADD CONSTRAINT designs_order_id_unique UNIQUE (order_id);
CREATE INDEX IF NOT EXISTS designs_order_id_idx ON designs(order_id);

-- 3. Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS designs_set_updated_at ON designs;
CREATE TRIGGER designs_set_updated_at
BEFORE UPDATE ON designs
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- 4. Migrate data from orders.design_details (idempotent)
INSERT INTO designs (order_id, resources, items, payment_verified)
SELECT
    o.id AS order_id,
    COALESCE(o.design_details->'resources', '[]'::jsonb) AS resources,
    COALESCE(
        -- Prefer the new multi-item structure
        o.design_details->'items',
        -- Legacy: top-level versions/currentVersion become a single "General Design" item
        CASE
            WHEN o.design_details->'versions' IS NOT NULL AND jsonb_typeof(o.design_details->'versions') = 'array'
            THEN jsonb_build_array(
                jsonb_build_object(
                    'id', 'general',
                    'name', 'General Design',
                    'versions', o.design_details->'versions',
                    'currentVersion', COALESCE((o.design_details->>'currentVersion')::int, 0)
                )
            )
            ELSE '[]'::jsonb
        END
    ) AS items,
    COALESCE((o.design_details->>'paymentVerified')::boolean, false) AS payment_verified
FROM orders o
WHERE o.design_details IS NOT NULL
ON CONFLICT (order_id) DO UPDATE SET
    resources = EXCLUDED.resources,
    items = EXCLUDED.items,
    payment_verified = EXCLUDED.payment_verified,
    updated_at = now();

-- 5. Enable RLS
ALTER TABLE designs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON designs;
CREATE POLICY "Enable all access for authenticated users" ON designs
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);
