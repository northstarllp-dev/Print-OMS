-- Employee account status for freeze / inactive
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'Active';

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_status_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_status_check
  CHECK (status = ANY (ARRAY['Active'::text, 'Inactive'::text]));

COMMENT ON COLUMN public.users.status IS 'Active = can sign in; Inactive = frozen by admin';
