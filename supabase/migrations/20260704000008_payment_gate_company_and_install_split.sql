-- Multi-tenant payment gate settings + split Installation into two checkboxes.

-- 1. Add company_id
ALTER TABLE payment_gate_stages
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

-- 2. Replace unique(stage) with unique(company_id, stage)
ALTER TABLE payment_gate_stages DROP CONSTRAINT IF EXISTS payment_gate_stages_stage_key;
ALTER TABLE payment_gate_stages DROP CONSTRAINT IF EXISTS payment_gate_stages_company_stage_unique;
ALTER TABLE payment_gate_stages
  ADD CONSTRAINT payment_gate_stages_company_stage_unique UNIQUE (company_id, stage);

CREATE INDEX IF NOT EXISTS payment_gate_stages_company_id_idx
  ON payment_gate_stages (company_id);

-- 3. Clear legacy global rows (no company / old phase keys)
DELETE FROM payment_gate_stages;

-- 4. Seed defaults for every existing company
INSERT INTO payment_gate_stages (company_id, stage, is_enabled)
SELECT c.id, v.stage, true
FROM companies c
CROSS JOIN (
  VALUES
    ('site_visit'),
    ('quotation'),
    ('design'),
    ('production'),
    ('installation_scheduled'),
    ('installation_completed')
) AS v(stage)
ON CONFLICT (company_id, stage) DO NOTHING;

-- 5. Require company_id going forward
ALTER TABLE payment_gate_stages
  ALTER COLUMN company_id SET NOT NULL;

-- 6. RLS: admins only manage their own company; staff can read their company
DROP POLICY IF EXISTS "Admins can manage payment gate stages" ON payment_gate_stages;
CREATE POLICY "Admins can manage payment gate stages"
ON payment_gate_stages
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role = 'admin'
      AND u.company_id = payment_gate_stages.company_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role = 'admin'
      AND u.company_id = payment_gate_stages.company_id
  )
);

DROP POLICY IF EXISTS "Authenticated can read payment gate stages" ON payment_gate_stages;
CREATE POLICY "Authenticated can read payment gate stages"
ON payment_gate_stages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.company_id = payment_gate_stages.company_id
  )
);
