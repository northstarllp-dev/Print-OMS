-- Add client_name to orders
ALTER TABLE public.orders ADD COLUMN client_name text;

-- Populate client_name with customers.name (or fallback to project_name)
UPDATE public.orders o
SET client_name = COALESCE(
  (SELECT c.name FROM public.customers c WHERE c.id = o.customer_id),
  o.project_name,
  ''
);

-- Make client_name NOT NULL and set default to empty string
ALTER TABLE public.orders ALTER COLUMN client_name SET NOT NULL;
ALTER TABLE public.orders ALTER COLUMN client_name SET DEFAULT '';

-- Drop project_name column
ALTER TABLE public.orders DROP COLUMN project_name;
