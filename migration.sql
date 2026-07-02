-- Migration SQL Dump - v2 (Production Grade)
-- Created automatically

DROP TABLE IF EXISTS public.orders CASCADE;
DROP TABLE IF EXISTS public.enquiries CASCADE;
DROP TABLE IF EXISTS public.customers CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.companies CASCADE;

CREATE TABLE IF NOT EXISTS public.companies (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for all authenticated users" ON public.companies FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.users (
    id uuid NOT NULL PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id),
    name text NOT NULL,
    role text NOT NULL,
    phone text NOT NULL,
    email text,
    staff_role text
);
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access for authenticated users" ON public.users FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.customers (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id),
    name text NOT NULL,
    phone text NOT NULL,
    whatsapp text NOT NULL,
    email text NOT NULL,
    city text,
    billing_address text,
    shipping_address text,
    status text DEFAULT 'Active'::text
);
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access for authenticated users" ON public.customers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_customers_company ON public.customers(company_id);

CREATE TABLE IF NOT EXISTS public.enquiries (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id),
    lead_name text NOT NULL,
    phone text NOT NULL,
    whatsapp text NOT NULL,
    email text NOT NULL,
    source text NOT NULL,
    status text DEFAULT 'Pending'::text,
    notes text,
    primary_communication_mode text DEFAULT 'MAIL'::text,
    location text,
    date_received timestamp with time zone DEFAULT now()
);
ALTER TABLE public.enquiries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access for authenticated users" ON public.enquiries FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_enquiries_company ON public.enquiries(company_id);

CREATE TABLE IF NOT EXISTS public.orders (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id),
    project_name text NOT NULL,
    customer_id uuid NOT NULL REFERENCES public.customers(id),
    stage text NOT NULL,
    dimensions text,
    notes text,
    assigned_employees uuid[] DEFAULT '{}'::uuid[],
    assigned_designers uuid[] DEFAULT '{}'::uuid[],
    assigned_marketers uuid[] DEFAULT '{}'::uuid[],
    image_mockup text,
    stage_status text DEFAULT 'Normal'::text,
    version_history jsonb DEFAULT '[]'::jsonb,
    chat_history jsonb DEFAULT '[]'::jsonb,
    site_visit_details jsonb,
    quote_details jsonb,
    design_details jsonb,
    production_details jsonb,
    installation_details jsonb,
    date_created timestamp with time zone DEFAULT now(),
    budget numeric DEFAULT 0,
    deposit_paid numeric DEFAULT 0,
    stage_admin_notes text,
    business_name text
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access for authenticated users" ON public.orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_orders_customer ON public.orders(customer_id);
CREATE INDEX idx_orders_company ON public.orders(company_id);

-- Insert Primary Company
INSERT INTO public.companies (id, name) VALUES ('11111111-1111-1111-1111-111111111111', 'Printoms Main') ON CONFLICT DO NOTHING;

-- Insert Staff Users
INSERT INTO public.users (id, company_id, name, role, phone, email, staff_role) VALUES 
('502d6bb1-a51f-4025-83da-2e1ce8caf446', '11111111-1111-1111-1111-111111111111', 'Akshay Kumar M', 'staff', '9994400333', 'akshaykumar@printoms.co.in', 'Designer'),
('e9730e5e-ff6a-4857-aec3-1ad4d98011fe', '11111111-1111-1111-1111-111111111111', 'Vikram Malhotra', 'staff', '9876543210', 'vikrammalhotra@printoms.co.in', 'Marketer'),
('60c40772-f7c4-4604-89af-de3235df6619', '11111111-1111-1111-1111-111111111111', 'Priyanka Sen', 'staff', '9123456789', 'priyankasen@printoms.co.in', 'Designer'),
('e5db65a4-3968-4b84-bdf4-4783360a8d83', '11111111-1111-1111-1111-111111111111', 'Admin', 'admin', '1234567890', 'admin@printoms.com', NULL) ON CONFLICT DO NOTHING;

-- Insert Auth Users
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) VALUES 
('00000000-0000-0000-0000-000000000000', '60c40772-f7c4-4604-89af-de3235df6619', 'authenticated', 'authenticated', 'priyankasen@printoms.co.in', '$2a$10$obBZKXC5wPjP0g3XM301bOHCBM3h4/yuytlqcw38DYRkVpN/Negza', '2026-06-13T13:21:59.395394+00:00', '{"provider":"email","providers":["email"]}'::jsonb, '{"sub":"60c40772-f7c4-4604-89af-de3235df6619","email":"priyankasen@printoms.co.in","email_verified":true,"phone_verified":false}'::jsonb, '2026-06-13T13:21:59.395394+00:00', '2026-06-13T13:40:48.644819+00:00'),
('00000000-0000-0000-0000-000000000000', '5ec2186c-ff49-4330-bc2d-ddd89a816df7', 'authenticated', 'authenticated', 'api-test-user@printoms.com', '$2a$10$CBGq.7X0lKyTXhbUy0T73ealbyKgWpzENS2C3vuEmcHjRx8r.5DgG', NULL, '{"provider":"email","providers":["email"]}'::jsonb, '{"sub":"5ec2186c-ff49-4330-bc2d-ddd89a816df7","email":"api-test-user@printoms.com","email_verified":false,"phone_verified":false}'::jsonb, '2026-06-13T13:23:53.660964+00:00', '2026-06-13T13:23:55.124972+00:00'),
('00000000-0000-0000-0000-000000000000', 'e9730e5e-ff6a-4857-aec3-1ad4d98011fe', 'authenticated', 'authenticated', 'vikrammalhotra@printoms.co.in', '$2a$10$jKm/8RMyyClopldr7j7GEOCzO0hDs.PUQgAM9qPcvncFxZAD/uZLG', '2026-06-13T13:21:59.395394+00:00', '{"provider":"email","providers":["email"]}'::jsonb, '{"sub":"e9730e5e-ff6a-4857-aec3-1ad4d98011fe","email":"vikrammalhotra@printoms.co.in","email_verified":true,"phone_verified":false}'::jsonb, '2026-06-13T13:21:59.395394+00:00', '2026-06-13T13:21:59.395394+00:00'),
('00000000-0000-0000-0000-000000000000', 'e5db65a4-3968-4b84-bdf4-4783360a8d83', 'authenticated', 'authenticated', 'admin@printoms.com', '$2a$10$UOFa4D5KxZ1tcEvATMuMWOJtqo4gc7KZ7c1PHCcXuubBQTJWZVuz2', '2026-06-13T13:21:47.141361+00:00', '{"provider":"email","providers":["email"]}'::jsonb, '{"sub":"e5db65a4-3968-4b84-bdf4-4783360a8d83","email":"admin@printoms.com","email_verified":true,"phone_verified":false}'::jsonb, '2026-06-13T13:21:47.141361+00:00', '2026-06-14T05:46:10.143228+00:00'),
('00000000-0000-0000-0000-000000000000', '502d6bb1-a51f-4025-83da-2e1ce8caf446', 'authenticated', 'authenticated', 'akshaykumar@printoms.co.in', '$2a$10$4eaD1akZ2L7B63l/Qrocku8R.Ghj2wUEgdOFrBjFwd/crO4KeVUe.', '2026-06-13T13:21:59.395394+00:00', '{"provider":"email","providers":["email"]}'::jsonb, '{"sub":"502d6bb1-a51f-4025-83da-2e1ce8caf446","email":"akshaykumar@printoms.co.in","email_verified":true,"phone_verified":false}'::jsonb, '2026-06-13T13:21:59.395394+00:00', '2026-06-14T05:57:33.078794+00:00') ON CONFLICT (id) DO NOTHING;
