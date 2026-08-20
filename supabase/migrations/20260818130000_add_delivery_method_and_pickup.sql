ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_method text NOT NULL DEFAULT 'installation',
  ADD COLUMN IF NOT EXISTS pickup_confirmed_at timestamptz;

COMMENT ON COLUMN public.orders.delivery_method IS
  'How the finished product reaches the customer: installation (default) or customer_pickup.';

COMMENT ON COLUMN public.orders.pickup_confirmed_at IS
  'Timestamp when the customer collected the order (only for customer_pickup delivery method).';
