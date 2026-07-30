-- Configurable invoice numbering per company (app_settings) + sequence counters.

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS invoice_numbering jsonb DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.invoice_number_sequences (
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  period_key text NOT NULL,
  next_value integer NOT NULL,
  PRIMARY KEY (company_id, period_key)
);

ALTER TABLE public.invoice_number_sequences OWNER TO postgres;
ALTER TABLE public.invoice_number_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company-scoped access for authenticated users"
  ON public.invoice_number_sequences
  TO authenticated
  USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());

GRANT ALL ON TABLE public.invoice_number_sequences TO anon;
GRANT ALL ON TABLE public.invoice_number_sequences TO authenticated;
GRANT ALL ON TABLE public.invoice_number_sequences TO service_role;

-- Atomic allocate: returns the sequence number to embed in invoice_id.
CREATE OR REPLACE FUNCTION public.allocate_invoice_sequence(
  p_company_id uuid,
  p_period_key text,
  p_starting_number integer
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start integer := GREATEST(COALESCE(p_starting_number, 1), 1);
  v_allocated integer;
BEGIN
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'company_id is required';
  END IF;
  IF p_period_key IS NULL OR p_period_key = '' THEN
    RAISE EXCEPTION 'period_key is required';
  END IF;

  INSERT INTO public.invoice_number_sequences (company_id, period_key, next_value)
  VALUES (p_company_id, p_period_key, v_start + 1)
  ON CONFLICT (company_id, period_key)
  DO UPDATE SET next_value = public.invoice_number_sequences.next_value + 1
  RETURNING next_value - 1 INTO v_allocated;

  RETURN v_allocated;
END;
$$;

ALTER FUNCTION public.allocate_invoice_sequence(uuid, text, integer) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.allocate_invoice_sequence(uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.allocate_invoice_sequence(uuid, text, integer) TO authenticated;

-- Keep trigger as fallback only when invoice_id is blank (legacy).
-- Prefer app-allocated configurable IDs on insert.
CREATE OR REPLACE FUNCTION public.generate_invoice_id() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  max_id integer;
BEGIN
  IF NEW.invoice_id IS NOT NULL AND NEW.invoice_id <> '' THEN
    RETURN NEW;
  END IF;

  IF NEW.company_id IS NULL THEN
    RAISE EXCEPTION 'company_id is required to generate invoice_id';
  END IF;

  SELECT COALESCE(MAX(NULLIF(regexp_replace(invoice_id, '\D', '', 'g'), '')::integer), 0)
  INTO max_id
  FROM public.invoices
  WHERE company_id = NEW.company_id;

  NEW.invoice_id := 'INV-' || LPAD((max_id + 1)::text, 3, '0');
  RETURN NEW;
END;
$$;
