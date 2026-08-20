#!/usr/bin/env node
/**
 * Restore supabase/remote-dump/{schema,data}.sql onto local Supabase.
 * Wipes public schema and auth/storage data, then loads the remote dump.
 *
 * Usage: node scripts/restore-remote-dump.mjs
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const schemaPath = resolve(root, "supabase/remote-dump/schema.sql");
const dataPath = resolve(root, "supabase/remote-dump/data.sql");
const container = "supabase_db_Print-OMS";

if (!existsSync(schemaPath) || !existsSync(dataPath)) {
  console.error("Missing dumps. Run:");
  console.error(
    "  npx supabase db dump --linked -f supabase/remote-dump/schema.sql --yes"
  );
  console.error(
    "  npx supabase db dump --linked --data-only --use-copy -f supabase/remote-dump/data.sql --yes"
  );
  process.exit(1);
}

function psql(sql) {
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
    throw new Error(`psql failed (exit ${r.status})`);
  }
  return r.stdout;
}

function psqlFile(filePath) {
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
    {
      input: readFileSync(filePath),
      maxBuffer: 100 * 1024 * 1024,
    }
  );
  if (r.status !== 0) {
    console.error(r.stderr?.toString() || r.stdout?.toString());
    throw new Error(
      `psql file restore failed for ${filePath} (exit ${r.status})`
    );
  }
}

console.log("1/4 Dropping and recreating public schema...");
psql(`
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON SCHEMA public TO supabase_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres, anon, authenticated, service_role;
`);

console.log("2/4 Loading remote schema.sql...");
psqlFile(schemaPath);

console.log("3/4 Clearing auth + storage data for clean COPY...");
psql(`
TRUNCATE TABLE auth.refresh_tokens CASCADE;
TRUNCATE TABLE auth.sessions CASCADE;
TRUNCATE TABLE auth.mfa_amr_claims CASCADE;
TRUNCATE TABLE auth.mfa_challenges CASCADE;
TRUNCATE TABLE auth.mfa_factors CASCADE;
TRUNCATE TABLE auth.identities CASCADE;
TRUNCATE TABLE auth.one_time_tokens CASCADE;
TRUNCATE TABLE auth.flow_state CASCADE;
TRUNCATE TABLE auth.audit_log_entries CASCADE;
TRUNCATE TABLE auth.users CASCADE;
TRUNCATE TABLE storage.s3_multipart_uploads_parts CASCADE;
TRUNCATE TABLE storage.s3_multipart_uploads CASCADE;
TRUNCATE TABLE storage.objects CASCADE;
TRUNCATE TABLE storage.buckets CASCADE;
`);

console.log("4/4 Loading remote data.sql (auth + public + storage)...");
psqlFile(dataPath);

console.log("Done. Re-granting API roles on public...");
psql(`
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;
NOTIFY pgrst, 'reload schema';
`);

const counts = psql(`
SELECT 'companies' AS t, count(*)::text AS n FROM public.companies
UNION ALL SELECT 'users', count(*)::text FROM public.users
UNION ALL SELECT 'customers', count(*)::text FROM public.customers
UNION ALL SELECT 'orders', count(*)::text FROM public.orders
UNION ALL SELECT 'auth.users', count(*)::text FROM auth.users
UNION ALL SELECT 'storage.buckets', count(*)::text FROM storage.buckets
UNION ALL SELECT 'storage.objects', count(*)::text FROM storage.objects
ORDER BY 1;
`);
console.log(counts);
console.log("Local DB now mirrors PrintOMS-dev-db (sfzicqxanlgulgtswcqz).");
console.log(
  "Note: storage *files* are metadata-only unless you sync buckets separately."
);
