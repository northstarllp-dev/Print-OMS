# Clone PrintOMS-dev-db → local Supabase

Fully replicates the linked remote project (`sfzicqxanlgulgtswcqz` / **PrintOMS-dev-db**) onto Docker local Supabase.

## What gets cloned

| Layer | Included |
|-------|----------|
| `public` schema + data | Yes |
| `auth.users` + identities | Yes (same passwords as remote) |
| `storage.buckets` + `storage.objects` metadata | Yes |
| Storage file blobs | Yes (via `db:sync-storage`) |
| Edge functions / secrets | No — configure locally separately |

## Prerequisites

- Docker Desktop running
- `npx supabase start`
- Linked project: `npx supabase link --project-ref sfzicqxanlgulgtswcqz` (already linked in this repo)

## One command

```bash
npm run db:clone:dev
```

That runs:

1. `db:dump:remote` — schema + data dump into `supabase/remote-dump/` (gitignored)
2. `db:restore:local` — wipe local `public` + auth/storage rows, load dump
3. `db:sync-storage` — download remote files (if not already present) is separate; files already under `remote-dump/storage` are uploaded to local

To refresh storage downloads from remote first:

```bash
# per bucket example
npx supabase storage cp -r --linked --experimental ss:///site-visit-photos supabase/remote-dump/storage/site-visit-photos --yes
npm run db:sync-storage
```

## Point the app at local

Generate / refresh `.env.test` (and copy keys into `.env.local` for `npm run dev`):

```bash
npm run env:test
```

Use:

- `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`
- anon + service_role keys from `npx supabase status`

Studio: http://127.0.0.1:54323

## Important notes

- **Destructive:** restore drops local `public` schema and replaces auth users.
- **`npm run db:reset`** re-applies *repo migrations + seed.sql*, which **overwrites** this clone. Prefer `db:clone:dev` when you want remote parity.
- Dumps under `supabase/remote-dump/` contain real customer data — never commit them (gitignored).
