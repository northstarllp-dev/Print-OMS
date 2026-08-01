-- Purchase Order management: vendors, purchase requests, purchase orders,
-- PO lines, and goods receipts feeding the stock ledger.

CREATE OR REPLACE FUNCTION public.generate_po_number() RETURNS trigger
    LANGUAGE plpgsql
AS $$
DECLARE
    max_id integer;
BEGIN
    IF NEW.company_id IS NULL THEN
        RAISE EXCEPTION 'company_id is required to generate po_number';
    END IF;

    IF NEW.po_number IS NOT NULL AND NEW.po_number <> '' THEN
        RETURN NEW;
    END IF;

    SELECT COALESCE(MAX(NULLIF(regexp_replace(po_number, '\D', '', 'g'), '')::integer), 0)
    INTO max_id
    FROM public.purchase_orders
    WHERE company_id = NEW.company_id;

    NEW.po_number := 'PO-' || LPAD((max_id + 1)::text, 4, '0');
    RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.vendors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    name text NOT NULL,
    gstin text,
    address text,
    phone text,
    email text,
    rating numeric,
    notes text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT vendors_pkey PRIMARY KEY (id),
    CONSTRAINT vendors_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE,
    CONSTRAINT vendors_rating_check CHECK (rating IS NULL OR (rating >= 0 AND rating <= 5))
);

CREATE INDEX IF NOT EXISTS idx_vendors_company_id ON public.vendors USING btree (company_id);

CREATE OR REPLACE TRIGGER vendors_updated_at
    BEFORE UPDATE ON public.vendors
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.purchase_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    status text NOT NULL DEFAULT 'Pending',
    lines jsonb DEFAULT '[]'::jsonb NOT NULL,
    notes text,
    requested_by uuid,
    approved_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT purchase_requests_pkey PRIMARY KEY (id),
    CONSTRAINT purchase_requests_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE,
    CONSTRAINT purchase_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id) ON DELETE SET NULL,
    CONSTRAINT purchase_requests_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id) ON DELETE SET NULL,
    CONSTRAINT purchase_requests_status_check CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Converted'))
);

CREATE INDEX IF NOT EXISTS idx_purchase_requests_company_id ON public.purchase_requests USING btree (company_id);

CREATE OR REPLACE TRIGGER purchase_requests_updated_at
    BEFORE UPDATE ON public.purchase_requests
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.purchase_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    po_number text,
    vendor_id uuid NOT NULL,
    request_id uuid,
    status text NOT NULL DEFAULT 'Draft',
    payment_status text NOT NULL DEFAULT 'Pending',
    order_date date DEFAULT CURRENT_DATE NOT NULL,
    expected_date date,
    subtotal numeric DEFAULT 0 NOT NULL,
    tax numeric DEFAULT 0 NOT NULL,
    grand_total numeric DEFAULT 0 NOT NULL,
    notes text,
    attachments jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT purchase_orders_pkey PRIMARY KEY (id),
    CONSTRAINT purchase_orders_company_po_number_key UNIQUE (company_id, po_number),
    CONSTRAINT purchase_orders_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE,
    CONSTRAINT purchase_orders_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id) ON DELETE RESTRICT,
    CONSTRAINT purchase_orders_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.purchase_requests(id) ON DELETE SET NULL,
    CONSTRAINT purchase_orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL,
    CONSTRAINT purchase_orders_status_check CHECK (status IN ('Draft', 'Sent', 'Approved', 'Partially Received', 'Received', 'Cancelled', 'Closed')),
    CONSTRAINT purchase_orders_payment_status_check CHECK (payment_status IN ('Pending', 'Partially Paid', 'Paid'))
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_company_id ON public.purchase_orders USING btree (company_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_vendor_id ON public.purchase_orders USING btree (vendor_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON public.purchase_orders USING btree (status);

CREATE OR REPLACE TRIGGER purchase_orders_updated_at
    BEFORE UPDATE ON public.purchase_orders
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trigger_generate_po_number
    BEFORE INSERT ON public.purchase_orders
    FOR EACH ROW EXECUTE FUNCTION public.generate_po_number();

CREATE TABLE IF NOT EXISTS public.purchase_order_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    po_id uuid NOT NULL,
    product_id uuid NOT NULL,
    qty_ordered numeric NOT NULL,
    qty_received numeric DEFAULT 0 NOT NULL,
    unit_cost numeric DEFAULT 0 NOT NULL,
    tax_rate numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT purchase_order_lines_pkey PRIMARY KEY (id),
    CONSTRAINT pol_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE,
    CONSTRAINT pol_po_id_fkey FOREIGN KEY (po_id) REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
    CONSTRAINT pol_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT,
    CONSTRAINT pol_qty_ordered_check CHECK (qty_ordered > 0)
);

CREATE INDEX IF NOT EXISTS idx_pol_company_id ON public.purchase_order_lines USING btree (company_id);
CREATE INDEX IF NOT EXISTS idx_pol_po_id ON public.purchase_order_lines USING btree (po_id);

CREATE TABLE IF NOT EXISTS public.purchase_receipts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    po_id uuid NOT NULL,
    warehouse_id uuid NOT NULL,
    lines jsonb DEFAULT '[]'::jsonb NOT NULL,
    notes text,
    received_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT purchase_receipts_pkey PRIMARY KEY (id),
    CONSTRAINT pr_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE,
    CONSTRAINT pr_po_id_fkey FOREIGN KEY (po_id) REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
    CONSTRAINT pr_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE RESTRICT,
    CONSTRAINT pr_received_by_fkey FOREIGN KEY (received_by) REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_pr_company_id ON public.purchase_receipts USING btree (company_id);
CREATE INDEX IF NOT EXISTS idx_pr_po_id ON public.purchase_receipts USING btree (po_id);

-- RLS
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company-scoped access for authenticated users"
    ON public.vendors
    TO authenticated
    USING ((company_id = public.current_company_id()))
    WITH CHECK ((company_id = public.current_company_id()));

CREATE POLICY "Company-scoped access for authenticated users"
    ON public.purchase_requests
    TO authenticated
    USING ((company_id = public.current_company_id()))
    WITH CHECK ((company_id = public.current_company_id()));

CREATE POLICY "Company-scoped access for authenticated users"
    ON public.purchase_orders
    TO authenticated
    USING ((company_id = public.current_company_id()))
    WITH CHECK ((company_id = public.current_company_id()));

CREATE POLICY "Company-scoped access for authenticated users"
    ON public.purchase_order_lines
    TO authenticated
    USING ((company_id = public.current_company_id()))
    WITH CHECK ((company_id = public.current_company_id()));

CREATE POLICY "Company-scoped access for authenticated users"
    ON public.purchase_receipts
    TO authenticated
    USING ((company_id = public.current_company_id()))
    WITH CHECK ((company_id = public.current_company_id()));

GRANT ALL ON TABLE public.vendors TO anon;
GRANT ALL ON TABLE public.vendors TO authenticated;
GRANT ALL ON TABLE public.vendors TO service_role;

GRANT ALL ON TABLE public.purchase_requests TO anon;
GRANT ALL ON TABLE public.purchase_requests TO authenticated;
GRANT ALL ON TABLE public.purchase_requests TO service_role;

GRANT ALL ON TABLE public.purchase_orders TO anon;
GRANT ALL ON TABLE public.purchase_orders TO authenticated;
GRANT ALL ON TABLE public.purchase_orders TO service_role;

GRANT ALL ON TABLE public.purchase_order_lines TO anon;
GRANT ALL ON TABLE public.purchase_order_lines TO authenticated;
GRANT ALL ON TABLE public.purchase_order_lines TO service_role;

GRANT ALL ON TABLE public.purchase_receipts TO anon;
GRANT ALL ON TABLE public.purchase_receipts TO authenticated;
GRANT ALL ON TABLE public.purchase_receipts TO service_role;

GRANT ALL ON FUNCTION public.generate_po_number() TO anon;
GRANT ALL ON FUNCTION public.generate_po_number() TO authenticated;
GRANT ALL ON FUNCTION public.generate_po_number() TO service_role;
