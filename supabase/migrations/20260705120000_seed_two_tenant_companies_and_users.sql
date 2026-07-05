-- Reset operational data and seed Printoms + The Board Company users.
-- Password for each account = phone number (plain text passed to bcrypt).

-- ── Wipe operational data (children first) ───────────────────────────────
DELETE FROM public.order_activity;
DELETE FROM public.order_files;
DELETE FROM public.order_assignments;
DELETE FROM public.payments;
DELETE FROM public.productions;
DELETE FROM public.installations;
DELETE FROM public.designs;
DELETE FROM public.quotations;
DELETE FROM public.site_visit_measurements;
DELETE FROM public.site_visits;
DELETE FROM public.portal_access_tokens;
DELETE FROM public.notification_outbox;
DELETE FROM public.enquiries;
DELETE FROM public.orders;
DELETE FROM public.customers;
DELETE FROM public.products;
DELETE FROM public.product_categories;

-- ── Reset users ──────────────────────────────────────────────────────────
DELETE FROM public.users;
DELETE FROM auth.identities;
DELETE FROM auth.users;

-- ── Companies ────────────────────────────────────────────────────────────
UPDATE public.companies SET name = 'Printoms' WHERE id = '11111111-1111-1111-1111-111111111111';

INSERT INTO public.companies (id, name)
VALUES ('22222222-2222-2222-2222-222222222222', 'The Board Company')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- ── Helper: create auth user + public.users profile ────────────────────────
CREATE OR REPLACE FUNCTION public.seed_app_user(
  p_email text,
  p_password text,
  p_company_id uuid,
  p_name text,
  p_role text,
  p_phone text,
  p_staff_role text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_user_id uuid := gen_random_uuid();
  v_email text := lower(trim(p_email));
BEGIN
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, recovery_sent_at, last_sign_in_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    v_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(), now(),
    '', '', '', ''
  );

  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(),
    v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email),
    'email',
    v_user_id::text,
    now(), now(), now()
  );

  INSERT INTO public.users (id, company_id, name, role, phone, email, staff_role)
  VALUES (v_user_id, p_company_id, p_name, p_role, p_phone, v_email, p_staff_role);

  RETURN v_user_id;
END;
$$;

-- ── Printoms users (password = phone) ─────────────────────────────────────
SELECT public.seed_app_user('admin@printoms.com', '1234567890', '11111111-1111-1111-1111-111111111111', 'Admin', 'admin', '1234567890', NULL);
SELECT public.seed_app_user('akshaykumar@printoms.co.in', '9994400333', '11111111-1111-1111-1111-111111111111', 'Akshay Kumar M', 'staff', '9994400333', 'Designer');
SELECT public.seed_app_user('priyankasen@printoms.co.in', '9123456789', '11111111-1111-1111-1111-111111111111', 'Priyanka Sen', 'staff', '9123456789', 'Designer');
SELECT public.seed_app_user('vikrammalhotra@printoms.co.in', '9876543210', '11111111-1111-1111-1111-111111111111', 'Vikram Malhotra', 'staff', '9876543210', 'Marketer');
SELECT public.seed_app_user('production@printoms.co.in', '9111111111', '11111111-1111-1111-1111-111111111111', 'Production Team', 'staff', '9111111111', 'Production');
SELECT public.seed_app_user('installation@printoms.co.in', '9222222222', '11111111-1111-1111-1111-111111111111', 'Installation Team', 'staff', '9222222222', 'Installation');

-- ── The Board Company users (password = phone) ───────────────────────────
SELECT public.seed_app_user('sachin@theboardcompany.in', '9964653838', '22222222-2222-2222-2222-222222222222', 'Sachin', 'admin', '9964653838', NULL);
SELECT public.seed_app_user('pavan@theboardcompany.in', '9731033433', '22222222-2222-2222-2222-222222222222', 'Pavan', 'admin', '9731033433', NULL);
SELECT public.seed_app_user('harsha@theboardcompany.in', '7483549027', '22222222-2222-2222-2222-222222222222', 'Harsha', 'admin', '7483549027', NULL);
SELECT public.seed_app_user('design@theboardcompany.in', '8341313869', '22222222-2222-2222-2222-222222222222', 'Design', 'staff', '8341313869', 'Designer');
SELECT public.seed_app_user('likith.s@theboardcompany.in', '9743108886', '22222222-2222-2222-2222-222222222222', 'Likith S', 'staff', '9743108886', 'Production & Service');
SELECT public.seed_app_user('basavaraj.s@theboardcompany.in', '9535848661', '22222222-2222-2222-2222-222222222222', 'Basavaraj S', 'staff', '9535848661', 'Recce & Installation');

DROP FUNCTION public.seed_app_user(text, text, uuid, text, text, text, text);
