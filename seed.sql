-- Seed Data for Printoms Orders, Customers, and Enquiries

-- 1. Create Mock Customers
INSERT INTO public.customers (id, company_id, name, phone, whatsapp, email, city, billing_address, shipping_address, status)
VALUES
('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Rajesh Kumar', '9988776655', '9988776655', 'rajesh@example.com', 'Delhi', '12, Connaught Place', '12, Connaught Place', 'Active'),
('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Gourmet Delights Cafe', '9900223344', '9900223344', 'info@gourmetcafe.com', 'Bangalore', 'MG Road, Bangalore', 'MG Road, Bangalore', 'Active'),
('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'Apex Tech Parks', '9876500112', '9876500112', 'facilities@apextech.com', 'Bangalore', 'Tech Zone, Bangalore', 'Tech Zone, Bangalore', 'Active')
ON CONFLICT DO NOTHING;

-- 2. Create Mock Enquiries
INSERT INTO public.enquiries (id, company_id, business_name, lead_name, phone, whatsapp, email, source, status, notes, primary_communication_mode, location, date_received)
VALUES
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Tech Startup', 'Aravind Sharma', '9911223344', '9911223344', 'contact@startup.com', 'Website', 'Pending', 'Wants 3D LED logo for front desk', 'MAIL', 'Koramangala', now() - interval '2 days'),
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Local Supermarket', 'Sunil Dev', '9988112233', '9988112233', 'admin@supermarket.in', 'Phone Call', 'Pending', 'Need urgent ACP board replacement', 'WHATSAPP', 'Indiranagar', now() - interval '5 hours')
ON CONFLICT DO NOTHING;

-- 3. Create Mock Orders (Linking to Customers and Employees)
-- Note: '502d6bb1...' is Akshay Kumar (Designer), 'e9730e5e...' is Vikram Malhotra (Marketer)
INSERT INTO public.orders (id, company_id, project_name, customer_id, stage, dimensions, notes, budget, deposit_paid, assigned_employees, business_name, stage_status, date_created)
VALUES
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Neon Window Signage', '33333333-3333-3333-3333-333333333333', 'Quotation In Progress', '48 x 24 inches', 'Requires high voltage transformers', 45000, 15000, ARRAY['502d6bb1-a51f-4025-83da-2e1ce8caf446']::uuid[], 'Gourmet Delights Cafe', 'Normal', now() - interval '3 days'),

(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'ACP Pillar Gate Banner', '44444444-4444-4444-4444-444444444444', 'Production', '120 x 48 inches', 'Concrete pillar mounting', 120000, 60000, ARRAY['e9730e5e-ff6a-4857-aec3-1ad4d98011fe']::uuid[], 'Apex Tech Parks', 'Normal', now() - interval '10 days'),

(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Office Reception Logo', '22222222-2222-2222-2222-222222222222', 'Site Visit Pending', 'TBD', 'Initial discussions only', 0, 0, '{}'::uuid[], 'Rajesh Kumar', 'Normal', now() - interval '1 day')
ON CONFLICT DO NOTHING;
