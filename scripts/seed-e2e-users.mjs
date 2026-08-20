#!/usr/bin/env node
/**
 * Seed deterministic E2E users into the current local DB without wiping data.
 * Safe to run after db:clone:dev.
 *
 * Usage: node scripts/seed-e2e-users.mjs
 */
import { spawnSync } from "node:child_process";

const container = "supabase_db_Print-OMS";

const sql = `
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@printoms.test') THEN
    PERFORM public.seed_app_user(
      'admin@printoms.test', 'TestPass123!',
      '11111111-1111-1111-1111-111111111111',
      'Priya Admin', 'admin', '919900000001', NULL
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'marketer@printoms.test') THEN
    PERFORM public.seed_app_user(
      'marketer@printoms.test', 'TestPass123!',
      '11111111-1111-1111-1111-111111111111',
      'Arjun Marketer', 'staff', '919900000002', 'Marketer'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'designer@printoms.test') THEN
    PERFORM public.seed_app_user(
      'designer@printoms.test', 'TestPass123!',
      '11111111-1111-1111-1111-111111111111',
      'Meera Designer', 'staff', '919900000003', 'Designer'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'production@printoms.test') THEN
    PERFORM public.seed_app_user(
      'production@printoms.test', 'TestPass123!',
      '11111111-1111-1111-1111-111111111111',
      'Ravi Production', 'staff', '919900000004', 'Production'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'installation@printoms.test') THEN
    PERFORM public.seed_app_user(
      'installation@printoms.test', 'TestPass123!',
      '11111111-1111-1111-1111-111111111111',
      'Karan Installation', 'staff', '919900000005', 'Installation'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@printec.test') THEN
    PERFORM public.seed_app_user(
      'admin@printec.test', 'TestPass123!',
      '33333333-3333-3333-3333-333333333333',
      'Printec Admin', 'admin', '919900000099', NULL
    );
  END IF;
END $$;

UPDATE public.users
SET status = 'Active'
WHERE email LIKE '%@printoms.test' OR email LIKE '%@printec.test';

-- Ensure printoms app_settings exist
INSERT INTO public.app_settings (company_id, site_visit_scheduling_enabled, installation_scheduling_enabled)
SELECT '11111111-1111-1111-1111-111111111111', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.app_settings WHERE company_id = '11111111-1111-1111-1111-111111111111'
);

SELECT email, role FROM auth.users WHERE email LIKE '%printoms.test' OR email LIKE '%printec.test' ORDER BY email;
SELECT email, role, staff_role, status FROM public.users WHERE email LIKE '%printoms.test' OR email LIKE '%printec.test' ORDER BY email;
`;

const r = spawnSync(
  "docker",
  [
    "exec",
    "-i",
    container,
    "psql",
    "-U",
    "postgres",
    "-d",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
  ],
  { input: sql, encoding: "utf8" }
);

if (r.status !== 0) {
  console.error(r.stderr || r.stdout);
  process.exit(r.status ?? 1);
}
console.log(r.stdout);
console.log("E2E users ready (password: TestPass123!).");
