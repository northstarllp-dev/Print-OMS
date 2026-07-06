-- Per-tenant friendly ID generation.
-- Replaces global UNIQUE on human-readable codes with (company_id, code).
-- Trigger MAX() queries are scoped to NEW.company_id so RLS-visible rows match
-- the tenant being inserted for.

-- ── 1. ENQUIRIES (ENQ001) ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.generate_enquiry_id()
RETURNS TRIGGER AS $$
DECLARE
    max_id integer;
BEGIN
    IF NEW.company_id IS NULL THEN
        RAISE EXCEPTION 'company_id is required to generate enquire_id';
    END IF;

    IF NEW.enquire_id IS NOT NULL AND NEW.enquire_id <> '' THEN
        RETURN NEW;
    END IF;

    SELECT COALESCE(MAX(NULLIF(regexp_replace(enquire_id, '\D', '', 'g'), '')::integer), 0)
    INTO max_id
    FROM public.enquiries
    WHERE company_id = NEW.company_id;

    NEW.enquire_id := 'ENQ' || LPAD((max_id + 1)::text, 3, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE public.enquiries DROP CONSTRAINT IF EXISTS enquiries_enquire_id_key;
ALTER TABLE public.enquiries
  ADD CONSTRAINT enquiries_company_enquire_id_key UNIQUE (company_id, enquire_id);


-- ── 2. CUSTOMERS (A001) ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.generate_customer_id()
RETURNS TRIGGER AS $$
DECLARE
    max_id integer;
BEGIN
    IF NEW.company_id IS NULL THEN
        RAISE EXCEPTION 'company_id is required to generate customer_id';
    END IF;

    IF NEW.customer_id IS NOT NULL AND NEW.customer_id <> '' THEN
        RETURN NEW;
    END IF;

    SELECT COALESCE(MAX(NULLIF(regexp_replace(customer_id, '\D', '', 'g'), '')::integer), 0)
    INTO max_id
    FROM public.customers
    WHERE company_id = NEW.company_id;

    NEW.customer_id := 'A' || LPAD((max_id + 1)::text, 3, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_customer_id_key;
ALTER TABLE public.customers
  ADD CONSTRAINT customers_company_customer_id_key UNIQUE (company_id, customer_id);


-- ── 3. ORDERS (A012-001) ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.generate_order_id()
RETURNS TRIGGER AS $$
DECLARE
    cust_id text;
    max_id integer;
BEGIN
    IF NEW.company_id IS NULL THEN
        RAISE EXCEPTION 'company_id is required to generate order_id';
    END IF;

    IF NEW.order_id IS NOT NULL AND NEW.order_id <> '' THEN
        RETURN NEW;
    END IF;

    SELECT customer_id INTO cust_id
    FROM public.customers
    WHERE id = NEW.customer_id
      AND company_id = NEW.company_id;

    IF cust_id IS NULL THEN
        RAISE EXCEPTION 'customer not found for order (customer_id=%, company_id=%)', NEW.customer_id, NEW.company_id;
    END IF;

    SELECT COALESCE(MAX(NULLIF(regexp_replace(split_part(order_id, '-', 2), '\D', '', 'g'), '')::integer), 0)
    INTO max_id
    FROM public.orders
    WHERE customer_id = NEW.customer_id
      AND company_id = NEW.company_id;

    NEW.order_id := cust_id || '-' || LPAD((max_id + 1)::text, 3, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_order_id_key;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_company_order_id_key UNIQUE (company_id, order_id);


-- ── 4. PRODUCTS (PRD-001 / FP001 — app-generated; composite unique only) ─────

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_product_id_key;
DROP INDEX IF EXISTS public.idx_products_product_id;
ALTER TABLE public.products
  ADD CONSTRAINT products_company_product_id_key UNIQUE (company_id, product_id);


-- ── 5. QUOTATIONS (QT-001) ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.generate_quotation_id()
RETURNS TRIGGER AS $$
DECLARE
    max_id integer;
BEGIN
    IF NEW.company_id IS NULL THEN
        RAISE EXCEPTION 'company_id is required to generate quotation_id';
    END IF;

    IF NEW.quotation_id IS NOT NULL AND NEW.quotation_id <> '' THEN
        RETURN NEW;
    END IF;

    SELECT COALESCE(MAX(NULLIF(regexp_replace(quotation_id, '\D', '', 'g'), '')::integer), 0)
    INTO max_id
    FROM public.quotations
    WHERE company_id = NEW.company_id;

    NEW.quotation_id := 'QT-' || LPAD((max_id + 1)::text, 3, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE public.quotations DROP CONSTRAINT IF EXISTS quotations_quotation_id_key;
ALTER TABLE public.quotations
  ADD CONSTRAINT quotations_company_quotation_id_key UNIQUE (company_id, quotation_id);

DROP TRIGGER IF EXISTS trigger_generate_quotation_id ON public.quotations;
CREATE TRIGGER trigger_generate_quotation_id
BEFORE INSERT ON public.quotations
FOR EACH ROW
EXECUTE FUNCTION public.generate_quotation_id();
