# Clone PrintOMS-dev-db → local Supabase

Fully replicates the linked remote project (`sfzicqxanlgulgtswcqz` / **PrintOMS-dev-db**) onto Docker local Supabase.
This is useful when you want to achieve remote parity with the development database.

## What gets cloned

| Layer | Included | Notes |
|-------|----------|-------|
| `public` schema + data | Yes | Dumped via `db:dump:remote` and restored via `db:restore:local` |
| `auth.users` + identities | Yes | Identical passwords as remote |
| `storage.buckets` + `storage.objects` metadata | Yes | |
| Storage file blobs | Yes | Synced via `db:sync-storage` |
| Edge functions / secrets | No | Configure locally separately |

## Prerequisites

- Docker Desktop running
- `npx supabase start`
- Linked project: `npx supabase link --project-ref sfzicqxanlgulgtswcqz` (already linked in this repo)

## Core Commands

### The all-in-one command
```bash
npm run db:clone:dev
```
This runs three internal scripts sequentially: `db:dump:remote`, `db:restore:local`, and `db:sync-storage`.

### Under the Hood

1. **`npm run db:dump:remote`**
   Runs `supabase db dump` to output the remote schema into `supabase/remote-dump/schema.sql` and the remote data into `supabase/remote-dump/data.sql`. These dumps are gitignored as they contain real customer data.
2. **`npm run db:restore:local`** (via `scripts/restore-remote-dump.mjs`)
   Executes `psql` within the local `supabase_db_Print-OMS` Docker container. It drops and recreates the `public` schema, loads `schema.sql`, truncates local auth and storage tables, and loads `data.sql`. Lastly, it re-grants API roles and notifies PostgREST.
3. **`npm run db:sync-storage`** (via `scripts/sync-storage-to-local.mjs`)
   Reads files downloaded to `supabase/remote-dump/storage/` and uses the local Supabase Storage API to upload them, preserving object keys. Targets specific buckets like `product-images`, `installation-photos`, `site-visit-photos`, `service-ticket-photos`, and `service-ticket-resolution-photos`. Uses `SUPABASE_SERVICE_ROLE_KEY` from `.env.test`.

To refresh storage downloads from remote first (before syncing locally):
```bash
# per bucket example
npx supabase storage cp -r --linked --experimental ss:///site-visit-photos supabase/remote-dump/storage/site-visit-photos --yes
npm run db:sync-storage
```

## Point the app at local

Generate or refresh your `.env.test` file (which contains local-only keys) by running:

```bash
npm run env:test
```

This runs `scripts/generate-env-test.mjs`, which pulls your local keys using `npx supabase status -o env` and generates an `.env.test` file with:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- Defaults for Playwright (`PLAYWRIGHT_ORIGIN`) and placeholders for WhatsApp integration.

You can then copy these generated keys into your `.env.local` to use them with `npm run dev`.

The local endpoints will be:
- **API URL**: `http://127.0.0.1:54321`
- **Studio URL**: `http://127.0.0.1:54323`

## Seeding E2E Users

If you need deterministic users for end-to-end testing (e.g. for Playwright) after cloning, you can run:

```bash
npm run db:seed:e2e
```

This runs `scripts/seed-e2e-users.mjs`, which safely inserts or updates standard test users (like `admin@printoms.test`, `designer@printoms.test`) into `auth.users` and `public.users` without wiping existing data. Passwords are set to `TestPass123!`.

## Important notes

- **Destructive:** `db:restore:local` drops the local `public` schema and replaces auth users.
- **`npm run db:reset` vs `db:clone:dev`**: `db:reset` re-applies the local repository migrations + `seed.sql`, which will **overwrite** the clone from remote. If you want remote parity, stick to `db:clone:dev`.
- **Data Privacy**: Dumps under `supabase/remote-dump/` contain real customer data never commit them.
