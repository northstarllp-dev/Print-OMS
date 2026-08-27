# PrintOMS E2E Testing

Business-state Playwright suite against **local Supabase**.

## Prerequisites

1. **Docker Desktop** running
2. Node.js 20+
3. `npm install` and `npx playwright install chromium`

## Recommended local DB setup

Clone the linked remote **PrintOMS-dev-db**, then add deterministic E2E users:

```bash
npx supabase start
npm run db:clone:dev          # schema + data + storage from remote
npm run db:seed:e2e           # admin@printoms.test etc. (password TestPass123!)
npm run env:test              # write .env.test from local supabase status
```

Docs: [docs/local-db-clone.md](../docs/local-db-clone.md)

Alternative (empty DB from migrations only):

```bash
npm run db:reset              # migrations + supabase/seed.sql
npm run env:test
```

## Seeded E2E users

Password for all: `TestPass123!`

| Email | Portal |
|-------|--------|
| admin@printoms.test | /admin |
| marketer@printoms.test | /staff |
| designer@printoms.test | /staff |
| production@printoms.test | /production |
| installation@printoms.test | /installation |
| admin@printec.test | cross-tenant fixture |

## Run tests

```bash
npm run test:e2e          # headless
npm run test:e2e:ui       # Playwright UI mode
npm run test:e2e:debug    # step-through
npm run test:e2e:report   # last HTML report
```

Playwright starts `node scripts/dev-e2e.mjs` (loads `.env.test`) on port 3001.
All page helpers use `appPath()` so routes include `basePath` `/printoms`.

## Architecture

- **~20% UI** login, admin enquiry + convert, portal open
- **~80% business state** `orders.stage`, `order_activity`, quotations, portal tokens
- Service-role client in `e2e/helpers/db.ts` for assertions
- Portal tokens minted via `e2e/helpers/portal-token.ts` (same `portal_access_tokens` path as production)
- Note: `META_WHATSAPP_DISPATCH_DISABLED` in app code means live actions do not write `notification_outbox`; pipeline helpers seed assertable outbox rows

## Folder map

```text
e2e/
  setup/          auth storageState
  flows/          cross-stage business stories
  auth/           login / role gates
  pages/          page objects
  helpers/        auth, db, assertions, stages, portal, cleanup, paths
  fixtures/       users, customers, products
  data/           upload fixtures
```
