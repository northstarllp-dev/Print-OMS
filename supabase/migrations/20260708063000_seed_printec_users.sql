-- Add Users for Printec (UUID: 33333333-3333-3333-3333-333333333333)
-- Password for each account = phone number (plain text passed to bcrypt).

SELECT public.seed_app_user(
  'admin@printec.in', 
  '9000000001', 
  '33333333-3333-3333-3333-333333333333', 
  'Printec Admin', 
  'admin', 
  '9000000001', 
  NULL
);

SELECT public.seed_app_user(
  'staff@printec.in', 
  '9000000002', 
  '33333333-3333-3333-3333-333333333333', 
  'Printec Staff', 
  'staff', 
  '9000000002', 
  NULL
);

SELECT public.seed_app_user(
  'designer@printec.in', 
  '9000000003', 
  '33333333-3333-3333-3333-333333333333', 
  'Printec Designer', 
  'staff', 
  '9000000003', 
  'Designer'
);

SELECT public.seed_app_user(
  'production@printec.in', 
  '9000000004', 
  '33333333-3333-3333-3333-333333333333', 
  'Printec Production', 
  'staff', 
  '9000000004', 
  'Production'
);

SELECT public.seed_app_user(
  'installation@printec.in', 
  '9000000005', 
  '33333333-3333-3333-3333-333333333333', 
  'Printec Installation', 
  'staff', 
  '9000000005', 
  'Installation'
);
