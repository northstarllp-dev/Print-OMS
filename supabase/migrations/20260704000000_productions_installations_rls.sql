-- Match existing app pattern (site_visits, designs): authenticated staff can read/write.
-- productions / installations were created without RLS policies, so inserts fail under default deny.

ALTER TABLE public.productions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.productions;
CREATE POLICY "Enable all access for authenticated users" ON public.productions
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.installations;
CREATE POLICY "Enable all access for authenticated users" ON public.installations
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

-- Ensure one production / installation row per order (safe upserts)
CREATE UNIQUE INDEX IF NOT EXISTS productions_order_id_key ON public.productions (order_id);
CREATE UNIQUE INDEX IF NOT EXISTS installations_order_id_key ON public.installations (order_id);
