-- P0 security fixes: remove permissive anon access to PII and privileged RPCs.
-- Background:
--   * seed_app_user() is SECURITY DEFINER and creates auth.users rows.
--     Granting it to anon let anyone with the public anon key create arbitrary users.
--   * Several tables had USING (true) SELECT policies for the anon role, exposing
--     customers, enquiries, payments, order_files, and app_settings to unauthenticated
--     callers. The app uses the service-role key for public/portal flows that need
--     writes, so anon read access is not required.

-- 1. Revoke anon access to seed_app_user (service_role + authenticated only).
REVOKE EXECUTE ON FUNCTION public.seed_app_user(text, text, uuid, text, text, text, text) FROM anon;

-- 2. Drop permissive anon SELECT policies on PII / sensitive tables.
DROP POLICY IF EXISTS "Allow read access to anon users on order_files" ON public.order_files;
DROP POLICY IF EXISTS "Allow insert access to anon users on order_files" ON public.order_files;
DROP POLICY IF EXISTS "Anon can read app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Enable read access for anon users" ON public.customers;
DROP POLICY IF EXISTS "Enable read access for anon users" ON public.enquiries;
DROP POLICY IF EXISTS "Enable read access for anon users on payments" ON public.payments;
