-- Finance module: invoice types, receipts (incoming), outgoing payments,
-- expenses, and other income.

-- A. Invoice types (Proforma excluded from accounts totals in app logic).
ALTER TABLE public.invoices
    ADD COLUMN IF NOT EXISTS invoice_type text DEFAULT 'Tax Invoice' NOT NULL;

DO $$
BEGIN
    ALTER TABLE public.invoices
        ADD CONSTRAINT invoices_invoice_type_check CHECK (invoice_type IN (
            'GST Invoice', 'Tax Invoice', 'Actual Invoice', 'Proforma Invoice',
            'Credit Note', 'Debit Note'
        ));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- C. Receipts (incoming payments).
CREATE OR REPLACE FUNCTION public.generate_receipt_no() RETURNS trigger
    LANGUAGE plpgsql
AS $$
DECLARE
    max_id integer;
BEGIN
    IF NEW.company_id IS NULL THEN
        RAISE EXCEPTION 'company_id is required to generate receipt_no';
    END IF;

    IF NEW.receipt_no IS NOT NULL AND NEW.receipt_no <> '' THEN
        RETURN NEW;
    END IF;

    SELECT COALESCE(MAX(NULLIF(regexp_replace(receipt_no, '\D', '', 'g'), '')::integer), 0)
    INTO max_id
    FROM public.finance_receipts
    WHERE company_id = NEW.company_id;

    NEW.receipt_no := 'RCP-' || LPAD((max_id + 1)::text, 4, '0');
    RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.finance_receipts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    receipt_no text,
    customer_id uuid,
    order_id uuid,
    invoice_id uuid,
    amount numeric NOT NULL,
    mode text NOT NULL DEFAULT 'Cash',
    received_at date DEFAULT CURRENT_DATE NOT NULL,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT finance_receipts_pkey PRIMARY KEY (id),
    CONSTRAINT finance_receipts_company_receipt_no_key UNIQUE (company_id, receipt_no),
    CONSTRAINT finance_receipts_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE,
    CONSTRAINT finance_receipts_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL,
    CONSTRAINT finance_receipts_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL,
    CONSTRAINT finance_receipts_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL,
    CONSTRAINT finance_receipts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL,
    CONSTRAINT finance_receipts_amount_check CHECK (amount > 0),
    CONSTRAINT finance_receipts_mode_check CHECK (mode IN ('Cash', 'UPI', 'Bank', 'Cheque', 'Online'))
);

CREATE INDEX IF NOT EXISTS idx_finance_receipts_company_id ON public.finance_receipts USING btree (company_id);
CREATE INDEX IF NOT EXISTS idx_finance_receipts_received_at ON public.finance_receipts USING btree (received_at);

CREATE OR REPLACE TRIGGER trigger_generate_receipt_no
    BEFORE INSERT ON public.finance_receipts
    FOR EACH ROW EXECUTE FUNCTION public.generate_receipt_no();

-- D. Outgoing payments.
CREATE TABLE IF NOT EXISTS public.finance_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    category text NOT NULL DEFAULT 'Misc',
    payee text,
    vendor_id uuid,
    po_id uuid,
    amount numeric NOT NULL,
    gst_amount numeric DEFAULT 0 NOT NULL,
    due_date date,
    status text NOT NULL DEFAULT 'Pending',
    paid_at timestamp with time zone,
    attachments jsonb DEFAULT '[]'::jsonb NOT NULL,
    notes text,
    created_by uuid,
    approved_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT finance_payments_pkey PRIMARY KEY (id),
    CONSTRAINT finance_payments_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE,
    CONSTRAINT finance_payments_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id) ON DELETE SET NULL,
    CONSTRAINT finance_payments_po_id_fkey FOREIGN KEY (po_id) REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
    CONSTRAINT finance_payments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL,
    CONSTRAINT finance_payments_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id) ON DELETE SET NULL,
    CONSTRAINT finance_payments_amount_check CHECK (amount > 0),
    CONSTRAINT finance_payments_category_check CHECK (category IN (
        'Supplier', 'PO', 'Contractor', 'Freelancer', 'Salary', 'Rent', 'Electricity', 'Misc'
    )),
    CONSTRAINT finance_payments_status_check CHECK (status IN ('Pending', 'Approved', 'Paid'))
);

CREATE INDEX IF NOT EXISTS idx_finance_payments_company_id ON public.finance_payments USING btree (company_id);
CREATE INDEX IF NOT EXISTS idx_finance_payments_status ON public.finance_payments USING btree (status);

CREATE OR REPLACE TRIGGER finance_payments_updated_at
    BEFORE UPDATE ON public.finance_payments
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- E. Expenses.
CREATE TABLE IF NOT EXISTS public.finance_expenses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    category text NOT NULL DEFAULT 'Miscellaneous',
    expense_date date DEFAULT CURRENT_DATE NOT NULL,
    amount numeric NOT NULL,
    gst_amount numeric DEFAULT 0 NOT NULL,
    attachment_url text,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT finance_expenses_pkey PRIMARY KEY (id),
    CONSTRAINT finance_expenses_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE,
    CONSTRAINT finance_expenses_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL,
    CONSTRAINT finance_expenses_amount_check CHECK (amount > 0),
    CONSTRAINT finance_expenses_category_check CHECK (category IN (
        'Office', 'Travel', 'Fuel', 'Marketing', 'Maintenance', 'Repairs', 'Subscriptions', 'Miscellaneous'
    ))
);

CREATE INDEX IF NOT EXISTS idx_finance_expenses_company_id ON public.finance_expenses USING btree (company_id);
CREATE INDEX IF NOT EXISTS idx_finance_expenses_expense_date ON public.finance_expenses USING btree (expense_date);

-- F. Other income.
CREATE TABLE IF NOT EXISTS public.finance_other_income (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    category text NOT NULL DEFAULT 'Misc',
    income_date date DEFAULT CURRENT_DATE NOT NULL,
    amount numeric NOT NULL,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT finance_other_income_pkey PRIMARY KEY (id),
    CONSTRAINT finance_other_income_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE,
    CONSTRAINT finance_other_income_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL,
    CONSTRAINT finance_other_income_amount_check CHECK (amount > 0),
    CONSTRAINT finance_other_income_category_check CHECK (category IN (
        'Interest', 'Asset Sale', 'Commission', 'Consultancy', 'Misc'
    ))
);

CREATE INDEX IF NOT EXISTS idx_finance_other_income_company_id ON public.finance_other_income USING btree (company_id);

-- RLS
ALTER TABLE public.finance_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_other_income ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company-scoped access for authenticated users"
    ON public.finance_receipts
    TO authenticated
    USING ((company_id = public.current_company_id()))
    WITH CHECK ((company_id = public.current_company_id()));

CREATE POLICY "Company-scoped access for authenticated users"
    ON public.finance_payments
    TO authenticated
    USING ((company_id = public.current_company_id()))
    WITH CHECK ((company_id = public.current_company_id()));

CREATE POLICY "Company-scoped access for authenticated users"
    ON public.finance_expenses
    TO authenticated
    USING ((company_id = public.current_company_id()))
    WITH CHECK ((company_id = public.current_company_id()));

CREATE POLICY "Company-scoped access for authenticated users"
    ON public.finance_other_income
    TO authenticated
    USING ((company_id = public.current_company_id()))
    WITH CHECK ((company_id = public.current_company_id()));

GRANT ALL ON TABLE public.finance_receipts TO anon;
GRANT ALL ON TABLE public.finance_receipts TO authenticated;
GRANT ALL ON TABLE public.finance_receipts TO service_role;

GRANT ALL ON TABLE public.finance_payments TO anon;
GRANT ALL ON TABLE public.finance_payments TO authenticated;
GRANT ALL ON TABLE public.finance_payments TO service_role;

GRANT ALL ON TABLE public.finance_expenses TO anon;
GRANT ALL ON TABLE public.finance_expenses TO authenticated;
GRANT ALL ON TABLE public.finance_expenses TO service_role;

GRANT ALL ON TABLE public.finance_other_income TO anon;
GRANT ALL ON TABLE public.finance_other_income TO authenticated;
GRANT ALL ON TABLE public.finance_other_income TO service_role;

GRANT ALL ON FUNCTION public.generate_receipt_no() TO anon;
GRANT ALL ON FUNCTION public.generate_receipt_no() TO authenticated;
GRANT ALL ON FUNCTION public.generate_receipt_no() TO service_role;
