-- Product catalog cleanup:
-- 1. Final Product designation is always available; drop the settings gate.
-- 2. Add inventory attribute columns to products (products = inventory master).

ALTER TABLE public.app_settings DROP COLUMN IF EXISTS enable_final_product;

ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS unit text,
    ADD COLUMN IF NOT EXISTS brand text,
    ADD COLUMN IF NOT EXISTS supplier_name text,
    ADD COLUMN IF NOT EXISTS purchase_price numeric,
    ADD COLUMN IF NOT EXISTS min_stock numeric,
    ADD COLUMN IF NOT EXISTS max_stock numeric,
    ADD COLUMN IF NOT EXISTS hsn_code text,
    ADD COLUMN IF NOT EXISTS gst_rate numeric,
    ADD COLUMN IF NOT EXISTS barcode text,
    ADD COLUMN IF NOT EXISTS qr_code text,
    ADD COLUMN IF NOT EXISTS track_inventory boolean DEFAULT true NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products USING btree (barcode);
