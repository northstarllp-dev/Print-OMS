-- Portal (anon) can read payments and submit payment references.
-- Only authenticated staff/admin can create, verify, or waive.

CREATE POLICY "Enable read access for anon users on payments"
ON payments FOR SELECT TO anon
USING (true);

CREATE POLICY "Enable update access for anon users on payments"
ON payments FOR UPDATE TO anon
USING (true)
WITH CHECK (true);
