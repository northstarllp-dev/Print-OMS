-- Rename productions.deadline → installation_deadline (shared across all tenants).
ALTER TABLE public.productions
  RENAME COLUMN deadline TO installation_deadline;

COMMENT ON COLUMN public.productions.installation_deadline IS
  'Admin-set installation deadline (formerly production deadline). Staff cannot update.';
