-- Inventory & Warehouse module: warehouses, stock balances, stock movement ledger,
-- production material consumptions, and order cost columns.

CREATE TABLE IF NOT EXISTS public.warehouses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    kind text NOT NULL DEFAULT 'main',
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT warehouses_pkey PRIMARY KEY (id),
    CONSTRAINT warehouses_company_code_key UNIQUE (company_id, code),
    CONSTRAINT warehouses_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE,
    CONSTRAINT warehouses_kind_check CHECK (kind IN ('main', 'production_floor', 'vehicle', 'branch'))
);

CREATE INDEX IF NOT EXISTS idx_warehouses_company_id ON public.warehouses USING btree (company_id);

CREATE OR REPLACE TRIGGER warehouses_updated_at
    BEFORE UPDATE ON public.warehouses
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.stock_balances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    product_id uuid NOT NULL,
    warehouse_id uuid NOT NULL,
    quantity numeric DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT stock_balances_pkey PRIMARY KEY (id),
    CONSTRAINT stock_balances_unique_key UNIQUE (company_id, product_id, warehouse_id),
    CONSTRAINT stock_balances_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE,
    CONSTRAINT stock_balances_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE,
    CONSTRAINT stock_balances_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_stock_balances_company_id ON public.stock_balances USING btree (company_id);
CREATE INDEX IF NOT EXISTS idx_stock_balances_product_id ON public.stock_balances USING btree (product_id);
CREATE INDEX IF NOT EXISTS idx_stock_balances_warehouse_id ON public.stock_balances USING btree (warehouse_id);

CREATE OR REPLACE TRIGGER stock_balances_updated_at
    BEFORE UPDATE ON public.stock_balances
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Immutable stock movement ledger.
CREATE TABLE IF NOT EXISTS public.stock_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    product_id uuid NOT NULL,
    warehouse_id uuid NOT NULL,
    direction text NOT NULL,
    txn_type text NOT NULL,
    quantity numeric NOT NULL,
    balance_after numeric,
    unit_cost numeric,
    reference text,
    order_id uuid,
    notes text,
    actor_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT stock_movements_pkey PRIMARY KEY (id),
    CONSTRAINT stock_movements_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE,
    CONSTRAINT stock_movements_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE,
    CONSTRAINT stock_movements_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE CASCADE,
    CONSTRAINT stock_movements_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL,
    CONSTRAINT stock_movements_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE SET NULL,
    CONSTRAINT stock_movements_direction_check CHECK (direction IN ('in', 'out')),
    CONSTRAINT stock_movements_quantity_check CHECK (quantity > 0),
    CONSTRAINT stock_movements_txn_type_check CHECK (txn_type IN (
        'purchase', 'customer_return', 'adjustment', 'transfer_in', 'transfer_out',
        'production_return', 'production_yield', 'production_consumption',
        'damage', 'scrap', 'sample_usage'
    ))
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_company_id ON public.stock_movements USING btree (company_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON public.stock_movements USING btree (product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_warehouse_id ON public.stock_movements USING btree (warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_order_id ON public.stock_movements USING btree (order_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON public.stock_movements USING btree (created_at);

-- Production material consumption lines per order.
CREATE TABLE IF NOT EXISTS public.order_material_consumptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    order_id uuid NOT NULL,
    product_id uuid NOT NULL,
    warehouse_id uuid NOT NULL,
    quantity numeric NOT NULL,
    usage_kind text NOT NULL DEFAULT 'normal',
    unit_cost numeric DEFAULT 0 NOT NULL,
    total_cost numeric DEFAULT 0 NOT NULL,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT order_material_consumptions_pkey PRIMARY KEY (id),
    CONSTRAINT omc_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE,
    CONSTRAINT omc_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE,
    CONSTRAINT omc_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE,
    CONSTRAINT omc_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE CASCADE,
    CONSTRAINT omc_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL,
    CONSTRAINT omc_quantity_check CHECK (quantity > 0),
    CONSTRAINT omc_usage_kind_check CHECK (usage_kind IN ('normal', 'wastage', 'damaged', 'returned', 'scrap'))
);

CREATE INDEX IF NOT EXISTS idx_omc_company_id ON public.order_material_consumptions USING btree (company_id);
CREATE INDEX IF NOT EXISTS idx_omc_order_id ON public.order_material_consumptions USING btree (order_id);

-- Order costing columns.
ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS material_cost numeric DEFAULT 0 NOT NULL,
    ADD COLUMN IF NOT EXISTS labour_cost numeric DEFAULT 0 NOT NULL,
    ADD COLUMN IF NOT EXISTS transport_cost numeric DEFAULT 0 NOT NULL,
    ADD COLUMN IF NOT EXISTS installation_cost numeric DEFAULT 0 NOT NULL,
    ADD COLUMN IF NOT EXISTS overhead_cost numeric DEFAULT 0 NOT NULL;

-- Default warehouse on products.
ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS default_warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL;

-- RLS
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_material_consumptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company-scoped access for authenticated users"
    ON public.warehouses
    TO authenticated
    USING ((company_id = public.current_company_id()))
    WITH CHECK ((company_id = public.current_company_id()));

CREATE POLICY "Company-scoped access for authenticated users"
    ON public.stock_balances
    TO authenticated
    USING ((company_id = public.current_company_id()))
    WITH CHECK ((company_id = public.current_company_id()));

CREATE POLICY "Company-scoped access for authenticated users"
    ON public.stock_movements
    TO authenticated
    USING ((company_id = public.current_company_id()))
    WITH CHECK ((company_id = public.current_company_id()));

CREATE POLICY "Company-scoped access for authenticated users"
    ON public.order_material_consumptions
    TO authenticated
    USING ((company_id = public.current_company_id()))
    WITH CHECK ((company_id = public.current_company_id()));

GRANT ALL ON TABLE public.warehouses TO anon;
GRANT ALL ON TABLE public.warehouses TO authenticated;
GRANT ALL ON TABLE public.warehouses TO service_role;

GRANT ALL ON TABLE public.stock_balances TO anon;
GRANT ALL ON TABLE public.stock_balances TO authenticated;
GRANT ALL ON TABLE public.stock_balances TO service_role;

GRANT ALL ON TABLE public.stock_movements TO anon;
GRANT ALL ON TABLE public.stock_movements TO authenticated;
GRANT ALL ON TABLE public.stock_movements TO service_role;

GRANT ALL ON TABLE public.order_material_consumptions TO anon;
GRANT ALL ON TABLE public.order_material_consumptions TO authenticated;
GRANT ALL ON TABLE public.order_material_consumptions TO service_role;

-- Seed Main + Production Floor warehouses for every existing company.
INSERT INTO public.warehouses (company_id, code, name, kind)
SELECT c.id, 'WH-MAIN', 'Main Warehouse', 'main'
FROM public.companies c
WHERE NOT EXISTS (
    SELECT 1 FROM public.warehouses w WHERE w.company_id = c.id AND w.code = 'WH-MAIN'
);

INSERT INTO public.warehouses (company_id, code, name, kind)
SELECT c.id, 'WH-PROD', 'Production Floor', 'production_floor'
FROM public.companies c
WHERE NOT EXISTS (
    SELECT 1 FROM public.warehouses w WHERE w.company_id = c.id AND w.code = 'WH-PROD'
);
