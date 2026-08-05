-- Soft-archive employees instead of hard delete.
-- Active = can sign in; Inactive = frozen; Archived = soft-deleted (hidden from default directory).

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_status_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_status_check
  CHECK (status = ANY (ARRAY['Active'::text, 'Inactive'::text, 'Archived'::text]));

COMMENT ON COLUMN public.users.status IS
  'Active = can sign in; Inactive = frozen by admin; Archived = soft-deleted (not hard-deleted)';
