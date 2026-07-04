-- Switch payment gate settings from granular stages to high-level phases.
-- Keys: site_visit, quotation, design, production, installation

DELETE FROM payment_gate_stages;

INSERT INTO payment_gate_stages (stage, is_enabled) VALUES
    ('site_visit', true),
    ('quotation', true),
    ('design', true),
    ('production', true),
    ('installation', true)
ON CONFLICT (stage) DO UPDATE SET is_enabled = EXCLUDED.is_enabled;
