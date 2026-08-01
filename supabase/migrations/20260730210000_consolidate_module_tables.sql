-- Consolidate module tables (15 → 7):
-- Finance: 4 tables → finance_entries
-- Purchases: lines/receipts/requests → jsonb on purchase_orders (+ vendors)
-- Inventory: order_material_consumptions → stock_movements.usage_kind
-- Tasks: task_comments → tasks.comments jsonb

-- ═══════════════════════════════════════════════════════════════════════════
-- A. FINANCE → finance_entries
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.finance_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    entry_type text NOT NULL,
    entry_no text,
    amount numeric NOT NULL,
    gst_amount numeric DEFAULT 0 NOT NULL,
    category text,
    mode text,
    status text,
    entry_date date DEFAULT CURRENT_DATE NOT NULL,
    due_date date,
    paid_at timestamp with time zone,
    customer_id uuid,
    order_id uuid,
    invoice_id uuid,
    vendor_id uuid,
    po_id uuid,
    payee text,
    attachment_url text,
    attachments jsonb DEFAULT '[]'::jsonb NOT NULL,
    notes text,
    created_by uuid,
    approved_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT finance_entries_pkey PRIMARY KEY (id),
    CONSTRAINT finance_entries_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE,
    CONSTRAINT finance_entries_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL,
    CONSTRAINT finance_entries_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL,
    CONSTRAINT finance_entries_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL,
    CONSTRAINT finance_entries_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id) ON DELETE SET NULL,
    CONSTRAINT finance_entries_po_id_fkey FOREIGN KEY (po_id) REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
    CONSTRAINT finance_entries_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL,
    CONSTRAINT finance_entries_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id) ON DELETE SET NULL,
    CONSTRAINT finance_entries_amount_check CHECK (amount > 0),
    CONSTRAINT finance_entries_type_check CHECK (entry_type IN ('receipt', 'payment', 'expense', 'other_income'))
);

CREATE UNIQUE INDEX IF NOT EXISTS finance_entries_company_entry_no_key
    ON public.finance_entries (company_id, entry_no)
    WHERE entry_no IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_finance_entries_company_id ON public.finance_entries USING btree (company_id);
CREATE INDEX IF NOT EXISTS idx_finance_entries_type ON public.finance_entries USING btree (entry_type);
CREATE INDEX IF NOT EXISTS idx_finance_entries_entry_date ON public.finance_entries USING btree (entry_date);
CREATE INDEX IF NOT EXISTS idx_finance_entries_po_id ON public.finance_entries USING btree (po_id);

CREATE OR REPLACE TRIGGER finance_entries_updated_at
    BEFORE UPDATE ON public.finance_entries
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.generate_finance_entry_no() RETURNS trigger
    LANGUAGE plpgsql
AS $$
DECLARE
    max_id integer;
BEGIN
    IF NEW.company_id IS NULL THEN
        RAISE EXCEPTION 'company_id is required to generate entry_no';
    END IF;

    IF NEW.entry_type <> 'receipt' THEN
        RETURN NEW;
    END IF;

    IF NEW.entry_no IS NOT NULL AND NEW.entry_no <> '' THEN
        RETURN NEW;
    END IF;

    SELECT COALESCE(MAX(NULLIF(regexp_replace(entry_no, '\D', '', 'g'), '')::integer), 0)
    INTO max_id
    FROM public.finance_entries
    WHERE company_id = NEW.company_id
      AND entry_type = 'receipt';

    NEW.entry_no := 'RCP-' || LPAD((max_id + 1)::text, 4, '0');
    RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trigger_generate_finance_entry_no
    BEFORE INSERT ON public.finance_entries
    FOR EACH ROW EXECUTE FUNCTION public.generate_finance_entry_no();

-- Migrate existing finance rows if present.
INSERT INTO public.finance_entries (
    id, company_id, entry_type, entry_no, amount, gst_amount, mode, entry_date,
    customer_id, order_id, invoice_id, notes, created_by, created_at
)
SELECT
    id, company_id, 'receipt', receipt_no, amount, 0, mode, received_at,
    customer_id, order_id, invoice_id, notes, created_by, created_at
FROM public.finance_receipts
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.finance_entries (
    id, company_id, entry_type, amount, gst_amount, category, status, entry_date,
    due_date, paid_at, vendor_id, po_id, payee, attachments, notes,
    created_by, approved_by, created_at, updated_at
)
SELECT
    id, company_id, 'payment', amount, COALESCE(gst_amount, 0), category, status,
    COALESCE((paid_at AT TIME ZONE 'UTC')::date, created_at::date),
    due_date, paid_at, vendor_id, po_id, payee, COALESCE(attachments, '[]'::jsonb), notes,
    created_by, approved_by, created_at, COALESCE(updated_at, created_at)
FROM public.finance_payments
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.finance_entries (
    id, company_id, entry_type, amount, gst_amount, category, entry_date,
    attachment_url, notes, created_by, created_at
)
SELECT
    id, company_id, 'expense', amount, COALESCE(gst_amount, 0), category, expense_date,
    attachment_url, notes, created_by, created_at
FROM public.finance_expenses
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.finance_entries (
    id, company_id, entry_type, amount, category, entry_date, notes, created_by, created_at
)
SELECT
    id, company_id, 'other_income', amount, category, income_date, notes, created_by, created_at
FROM public.finance_other_income
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.finance_entries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    CREATE POLICY "Company-scoped access for authenticated users"
        ON public.finance_entries
        TO authenticated
        USING ((company_id = public.current_company_id()))
        WITH CHECK ((company_id = public.current_company_id()));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

GRANT ALL ON TABLE public.finance_entries TO anon;
GRANT ALL ON TABLE public.finance_entries TO authenticated;
GRANT ALL ON TABLE public.finance_entries TO service_role;
GRANT ALL ON FUNCTION public.generate_finance_entry_no() TO anon;
GRANT ALL ON FUNCTION public.generate_finance_entry_no() TO authenticated;
GRANT ALL ON FUNCTION public.generate_finance_entry_no() TO service_role;

DROP TABLE IF EXISTS public.finance_receipts CASCADE;
DROP TABLE IF EXISTS public.finance_payments CASCADE;
DROP TABLE IF EXISTS public.finance_expenses CASCADE;
DROP TABLE IF EXISTS public.finance_other_income CASCADE;
DROP FUNCTION IF EXISTS public.generate_receipt_no() CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════
-- B. PURCHASES → lines/receipts jsonb on purchase_orders; fold requests
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.purchase_orders
    ADD COLUMN IF NOT EXISTS doc_type text DEFAULT 'order' NOT NULL,
    ADD COLUMN IF NOT EXISTS lines jsonb DEFAULT '[]'::jsonb NOT NULL,
    ADD COLUMN IF NOT EXISTS receipts jsonb DEFAULT '[]'::jsonb NOT NULL,
    ADD COLUMN IF NOT EXISTS requested_by uuid,
    ADD COLUMN IF NOT EXISTS approved_by uuid;

CREATE OR REPLACE FUNCTION public.generate_po_number() RETURNS trigger
    LANGUAGE plpgsql
AS $$
DECLARE
    max_id integer;
BEGIN
    IF COALESCE(NEW.doc_type, 'order') = 'request' THEN
        RETURN NEW;
    END IF;

    IF NEW.company_id IS NULL THEN
        RAISE EXCEPTION 'company_id is required to generate po_number';
    END IF;

    IF NEW.po_number IS NOT NULL AND NEW.po_number <> '' THEN
        RETURN NEW;
    END IF;

    SELECT COALESCE(MAX(NULLIF(regexp_replace(po_number, '\D', '', 'g'), '')::integer), 0)
    INTO max_id
    FROM public.purchase_orders
    WHERE company_id = NEW.company_id
      AND COALESCE(doc_type, 'order') = 'order';

    NEW.po_number := 'PO-' || LPAD((max_id + 1)::text, 4, '0');
    RETURN NEW;
END;
$$;

DO $$
BEGIN
    ALTER TABLE public.purchase_orders
        ADD CONSTRAINT purchase_orders_doc_type_check CHECK (doc_type IN ('order', 'request'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Relax vendor for purchase requests.
ALTER TABLE public.purchase_orders ALTER COLUMN vendor_id DROP NOT NULL;

-- Allow request statuses on the shared purchase_orders.status column.
ALTER TABLE public.purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_status_check;
ALTER TABLE public.purchase_orders
    ADD CONSTRAINT purchase_orders_status_check CHECK (status IN (
        'Draft', 'Sent', 'Approved', 'Partially Received', 'Received', 'Cancelled', 'Closed',
        'Pending', 'Rejected', 'Converted'
    ));

-- Copy line rows into jsonb.
UPDATE public.purchase_orders po
SET lines = COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
        'id', l.id,
        'product_id', l.product_id,
        'qty_ordered', l.qty_ordered,
        'qty_received', l.qty_received,
        'unit_cost', l.unit_cost,
        'tax_rate', l.tax_rate
    ) ORDER BY l.created_at)
    FROM public.purchase_order_lines l
    WHERE l.po_id = po.id
), '[]'::jsonb)
WHERE EXISTS (SELECT 1 FROM public.purchase_order_lines l WHERE l.po_id = po.id);

-- Copy receipts into jsonb.
UPDATE public.purchase_orders po
SET receipts = COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
        'id', r.id,
        'warehouse_id', r.warehouse_id,
        'lines', r.lines,
        'notes', r.notes,
        'received_by', r.received_by,
        'created_at', r.created_at
    ) ORDER BY r.created_at)
    FROM public.purchase_receipts r
    WHERE r.po_id = po.id
), '[]'::jsonb)
WHERE EXISTS (SELECT 1 FROM public.purchase_receipts r WHERE r.po_id = po.id);

-- Migrate purchase_requests into purchase_orders (doc_type=request).
INSERT INTO public.purchase_orders (
    id, company_id, doc_type, vendor_id, status, payment_status,
    order_date, lines, notes, requested_by, approved_by, created_by, created_at, updated_at,
    subtotal, tax, grand_total, attachments, receipts
)
SELECT
    pr.id,
    pr.company_id,
    'request',
    NULL,
    pr.status,
    'Pending',
    pr.created_at::date,
    COALESCE(pr.lines, '[]'::jsonb),
    pr.notes,
    pr.requested_by,
    pr.approved_by,
    pr.requested_by,
    pr.created_at,
    pr.updated_at,
    0, 0, 0, '[]'::jsonb, '[]'::jsonb
FROM public.purchase_requests pr
ON CONFLICT (id) DO NOTHING;

DROP TABLE IF EXISTS public.purchase_receipts CASCADE;
DROP TABLE IF EXISTS public.purchase_order_lines CASCADE;

-- Drop request_id FK (requests now live in same table); keep column as soft link.
ALTER TABLE public.purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_request_id_fkey;
DROP TABLE IF EXISTS public.purchase_requests CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════
-- C. INVENTORY → fold consumptions into stock_movements
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.stock_movements
    ADD COLUMN IF NOT EXISTS usage_kind text;

DO $$
BEGIN
    ALTER TABLE public.stock_movements
        ADD CONSTRAINT stock_movements_usage_kind_check
        CHECK (usage_kind IS NULL OR usage_kind IN ('normal', 'wastage', 'damaged', 'returned', 'scrap'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Prefer backfilling usage_kind onto existing production ledger rows (already wrote stock).
UPDATE public.stock_movements m
SET usage_kind = c.usage_kind
FROM public.order_material_consumptions c
WHERE m.company_id = c.company_id
  AND m.order_id = c.order_id
  AND m.product_id = c.product_id
  AND m.warehouse_id = c.warehouse_id
  AND m.quantity = c.quantity
  AND m.usage_kind IS NULL
  AND m.txn_type IN ('production_consumption', 'production_return', 'damage', 'scrap');

-- Insert only consumptions that have no matching ledger row yet.
INSERT INTO public.stock_movements (
    company_id, product_id, warehouse_id, direction, txn_type, quantity,
    balance_after, unit_cost, reference, order_id, notes, actor_id, created_at, usage_kind
)
SELECT
    c.company_id,
    c.product_id,
    c.warehouse_id,
    CASE WHEN c.usage_kind = 'returned' THEN 'in' ELSE 'out' END,
    CASE c.usage_kind
        WHEN 'returned' THEN 'production_return'
        WHEN 'damaged' THEN 'damage'
        WHEN 'scrap' THEN 'scrap'
        ELSE 'production_consumption'
    END,
    c.quantity,
    0,
    c.unit_cost,
    'consumption',
    c.order_id,
    c.notes,
    c.created_by,
    c.created_at,
    c.usage_kind
FROM public.order_material_consumptions c
WHERE NOT EXISTS (
    SELECT 1 FROM public.stock_movements m
    WHERE m.company_id = c.company_id
      AND m.order_id = c.order_id
      AND m.product_id = c.product_id
      AND m.warehouse_id = c.warehouse_id
      AND m.quantity = c.quantity
      AND m.txn_type IN ('production_consumption', 'production_return', 'damage', 'scrap')
);

DROP TABLE IF EXISTS public.order_material_consumptions CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════
-- D. TASKS → comments jsonb on tasks
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.tasks
    ADD COLUMN IF NOT EXISTS comments jsonb DEFAULT '[]'::jsonb NOT NULL;

UPDATE public.tasks t
SET comments = COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
        'id', c.id,
        'author_id', c.author_id,
        'body', c.body,
        'created_at', c.created_at
    ) ORDER BY c.created_at)
    FROM public.task_comments c
    WHERE c.task_id = t.id
), '[]'::jsonb)
WHERE EXISTS (SELECT 1 FROM public.task_comments c WHERE c.task_id = t.id);

DROP TABLE IF EXISTS public.task_comments CASCADE;
