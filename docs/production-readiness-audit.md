# Production Readiness Audit — PrintOMS

**Date:** 2026-08-05  
**Scope:** Static analysis of `src/`, `supabase/migrations/`, config, and tests. No dynamic penetration testing or `EXPLAIN ANALYZE` against production.

---

## Assessment: ~65–70% production-grade

This is a **real, deployable multi-tenant SaaS** (Next.js 16 + Supabase) — not a prototype. The architecture is thoughtful, but operational hardening is incomplete.

- **Already strong:** multi-tenancy, RLS/migrations, domain feature modules, specs, unit tests, white-label client config.
- **Still weak:** CI/E2E, env validation, generated DB types, consistent auth on mutations, security headers, hot-path overfetch, no pagination, in-memory rate limiter, no job queue.
- **Remaining effort (rough):** ~7–12 weeks of focused engineering to reach fully production-grade enterprise standards — hardening and standardization, not a rewrite.

| Verdict | Detail |
|---------|--------|
| Beyond MVP | Yes — actively deployed (Vercel, multi-client) |
| Fully production-hardened | No — hygiene, scale, and security High items remain |
| Rewrite needed | No |

---

## Scores (snapshot)

| Dimension | Score | Status |
|-----------|-------|--------|
| Structure / architecture | 7/10 | Beyond MVP; feature modules + specs are strong |
| Security | 5/10 → improving | P0 Critical fixes landed 2026-08-05; High/Medium remain |
| Performance | 6/10 | Hot-path overfetch and missing indexes |
| Scalability | 4/10 | Suitable today for ~single-tenant, &lt;300 orders, &lt;50 concurrent users |

---

## What's already strong

1. Multi-tenant isolation (deploy slug → company UUID → middleware → actions → RLS)
2. Database discipline — 32+ migrations, RLS on 43/43 tables, `current_company_id()`
3. Domain-driven features (23 modules); mature `orders/` workspace + RBAC
4. Specs folder (26 files) and unit tests (55 Vitest files / 500+ tests)
5. White-label client registry (5 clients), env templates, scaffold scripts
6. Real product surface — admin, staff, production, installation, portal, finance, inventory

---

## P0 Critical security — DONE (2026-08-05)

Commit: `aac3700` — `fix(security): P0 critical security fixes`  
Migration: `supabase/migrations/20260805140000_p0_security_lockdown.sql`  
**Apply migration to Supabase before relying on these fixes in production** (`supabase db push` or SQL editor).

| Issue | Fix |
|-------|-----|
| `seed_app_user()` callable by `anon` (SECURITY DEFINER creates auth users) | `REVOKE EXECUTE … FROM anon` |
| 6 permissive anon RLS policies (`USING (true)` / `WITH CHECK (true)`) on customers, enquiries, payments, order_files, app_settings | Dropped |
| `/api/test-db` returned site_visits with no auth | Deleted |
| `resolveWriteCompanyId` fell back to deploy company without a user | Now requires authenticated user + deploy match |
| Public `/quote` `createEnquiry` needed a write path without session | Uses service-role admin client + `getDeployCompanyId()` |

**Note:** Customer portal does **not** need anon RLS. It uses magic-link tokens + `createAdminClient()` (service role). Dropping anon policies does not break the portal.

---

## Security — remaining (High / Medium / Low)

### High

| # | Issue | Location / notes |
|---|--------|------------------|
| S1 | Server actions mutate without explicit `getCurrentUser` / role checks (rely on RLS only) | `customerActions` CRUD; `productActions` CRUD/categories; `employeeActions` create/update; `portalAdminActions.revokePortalAccessAction`; `orderActions.addChatMessageAction` / `flagStalledOrdersAction`; `enquiryActions.flagStalledEnquiriesAction`; `installationActions.scheduleInstallationAction` |
| S2 | No security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options) | `next.config.ts` — headers not configured |
| S3 | Upload routes have no file size limits; MIME/extension only (SVG allowed) | `api/storage/upload`, `api/portal/upload`, `api/public/service-ticket` |
| S4 | Public service-ticket lookup by phone returns customer name + orders (enumeration / PII) | `api/public/service-ticket/lookup` |
| S5 | Unauthenticated / weakly gated APIs | `api/maps/resolve` (SSRF/abuse); `api/whatsapp/test` (secret header or staff) |
| S6 | Portal short tokens ~72 bits (9 random bytes) — weak without strict rate limits | `portal-tokens.ts` |
| S7 | Reports / AI builders may lack admin gate | `getReportData`, `aiReportBuilder` — verify auth |

### Medium

| # | Issue | Location / notes |
|---|--------|------------------|
| S8 | Zod used in ~2/28 server action files (~7%); most accept `any` / FormData | Widespread |
| S9 | In-memory rate limiter — broken across Vercel instances | `src/utils/rate-limiter.ts` (8 call sites) |
| S10 | Portal session cookie `secure` only when `NODE_ENV === "production"`; Supabase cookie flags implicit | Portal session route; SSR client |
| S11 | PostgREST filter injection risk if phone not sanitized | `service-ticket/lookup` `.or(\`phone.eq.${phone}…\`)` |
| S12 | Middleware catch may proceed with stale session on error | `utils/supabase/middleware.ts` |
| S13 | Shared `PORTAL_SECRET` across deploys amplifies forgery blast radius | Docs updated to require unique per project; rotate live secrets if still shared |

### Low

| # | Issue | Notes |
|---|--------|-------|
| S14 | `dangerouslySetInnerHTML` ×2 — static CSS only | Low XSS risk today |
| S15 | Generic `signIn` without role/tenant gate (unlike portal-specific sign-ins) | `authActions` |
| S16 | Rate limiter disabled in development | By design; don't ship that pattern to prod |

### Security metrics (at audit)

- 43/43 tables RLS enabled
- ~54 RLS policies (post-fix: 6 fewer anon policies)
- 0 hardcoded secrets in `src/`
- 0 CSP/HSTS at app level (still open)

---

## Performance

### High impact

| # | Issue | Location | Why it hurts |
|---|--------|----------|--------------|
| P1 | Admin layout loads full `getOrders()` + enquiries + customers for sidebar badges | `admin/(dashboard)/layout.tsx:24` | Every navigation; only needs counts |
| P2 | Orders page loads full graph again + sequential awaits | `orders/page.tsx` | Double-fetch with layout |
| P3 | `getOrders()` — `select *` + 6 nested `*` embeds, no LIMIT | `orderActions.ts:177-193` | DB + serialize + browser cost |
| P4 | `flagStalledOrdersAction` on every orders page load; N sequential `insertOrderActivity` | `orderActions.ts:1193+`, `orders/page.tsx:9` | Write amplification |
| P5 | ~10+ missing indexes on hot columns | `orders.stage`, `health`, `stage_changed_at`, `date_created`; `order_assignments.employee_id`; `notifications(user_id, created_at)`; etc. | Seq scans as data grows |
| P6 | No read caching (`unstable_cache` / tags = 0); ~80+ broad `revalidatePath` | Actions across features | Every page = full Supabase round-trips |
| P7 | Realtime: up to 4 channels / 9+ listeners per order view; duplicate quotation + activity channels | `useOrderDetailSync`, `QuotationModule`, `OrderCommunicationCenter` | Connection + CPU waste |
| P8 | Notification Realtime with no `user_id` filter | `AdminLayoutClient.tsx` | Broadcast storm — all events to all clients |

### Medium impact

| # | Issue | Notes |
|---|--------|-------|
| P9 | ~45 `select("*")` call sites | Overfetch |
| P10 | 111/319 files `"use client"` (~35%); large modules not dynamic-imported | QuotationModule ~1932 lines, SiteVisitModule ~1445 — static on order detail |
| P11 | 0 `React.memo`; Customers/Products lists weak memoization | Keystroke re-renders |
| P12 | 12 raw `<img>` vs 2 `next/image`; logos up to ~170KB | No WebP/srcset |
| P13 | Portal page re-fetches site_visits after embed | Redundant work |
| P14 | Storage path ownership checks in a loop | `storageActions.ts` |

### Largest hot-path files (refactor candidates)

| File | ~Lines |
|------|--------|
| `OrderWorksheetModal.tsx` | 2326 |
| `QuotationModule.tsx` | 1932 |
| `PurchasesDashboard.tsx` | 1893 |
| `SiteVisitModule.tsx` | 1445 |
| `OrdersManagementDashboard.tsx` | 1397 |
| `orderActions.ts` | 1389 |

---

## Scalability

**Today's practical envelope:** one busy tenant, &lt;~300 orders, &lt;~50 concurrent staff — before UX/timeouts degrade.

| # | Issue | Breaks around | Fix direction |
|---|--------|---------------|---------------|
| X1 | Layout `getOrders()` every navigation | ~300–800 orders | `getOrderCounts()` / head count only |
| X2 | Load-all lists; 0 server pagination; unused `paginate*` helpers | ~500–2,000 rows | Cursor pagination + slim columns |
| X3 | Client-side search only (0 SQL `ILIKE` / FTS / Meilisearch) | ~2,000+ rows UX | Server search or FTS |
| X4 | In-memory rate limiter | ≥2 Vercel instances | Upstash Redis / DB-backed |
| X5 | Reports load ALL orders/enquiries/… in request | ~1,000+ orders / 10s timeout | Async jobs + pagination |
| X6 | Realtime channel duplication + shared connection pool | ~80–100 concurrent staff | Dedupe channels; filter notifications |
| X7 | `parseVendorPoPdf` sync Gemini in server action | >10s default Vercel | Background job / raise `maxDuration` |
| X8 | No job queue (0 Redis/BullMQ/Supabase Queues) | Burst traffic | Queue for WA, reports, stall flagging |
| X9 | Public storage URLs only (0 signed URLs) | 100k+ files / security | Signed URLs + lifecycle |
| X10 | MAX()-based ID generators (order/customer/enquiry) | ~5–10 concurrent inserts same customer | Sequences / `allocate_*` pattern (invoices already good) |
| X11 | Shared DB for many tenants | ~30–50 active tenants / project | Per-client Supabase or stronger isolation |
| X12 | `vercel.json` has no `maxDuration` | Heavy actions hit 10s | Configure per-route limits |
| X13 | `flagStalled*` on page load | Write load with traffic | Cron / queue |

### Counts (at audit)

| Metric | Value |
|--------|-------|
| Registered tenants | 5 |
| `getOrders()` call sites | ~18 |
| Rate limiter call sites | 8 |
| SQL ILIKE / FTS | 0 |
| Signed URL usages | 0 |
| Queue workers | 0 |
| Paginate helpers used in UI | 0 |
| `maxDuration` configured | 0 |

---

## Structure / engineering hygiene

| # | Issue | Notes |
|---|--------|-------|
| H1 | No CI (`.github/workflows`) — lint/tests not enforced on merge | P0 for ship safety |
| H2 | No E2E (Playwright/Cypress); empty `integration_test/` | Critical journeys unverified |
| H3 | No coverage thresholds | — |
| H4 | No runtime env validation (zod / t3-env) | Fail-fast at boot |
| H5 | No Supabase-generated `database.types.ts` | Manual types + ~170 `any` matches |
| H6 | `getSupabase()` duplicated in ~35 action files | Prefer `utils/supabase/server.ts` |
| H7 | Inconsistent feature folder layout | orders rich vs products/enquiries minimal |
| H8 | No `error.tsx` / `not-found.tsx` | Poor failure UX |
| H9 | No Prettier / Husky / root README | Tooling gap |
| H10 | Monolith `orderActions.ts` (~1550 lines) | Split by domain |
| H11 | `allowJs: true` in tsconfig | Weakens guarantees |
| H12 | Stale `QuotationModule.tsx.bak` | Delete |

---

## Recommended fix order

### Tier A — Ship safety (1–2 weeks)

1. ~~P0 Critical security (anon RLS, seed_app_user, test-db, resolveWriteCompanyId)~~ **DONE**
2. Apply migration `20260805140000_p0_security_lockdown.sql` to all environments
3. Explicit auth on mutating server actions (S1)
4. Security headers + upload size limits (S2, S3)
5. CI: lint + vitest on PR
6. Guard or remove weak public APIs (S4, S5)

### Tier B — Scale past 300 orders / 50 users (1–2 weeks)

1. Layout `getOrderCounts()` instead of `getOrders()` (P1 / X1)
2. Paginate + slim `getOrders()` list path (P2, P3 / X2)
3. Indexes on orders + notifications (P5)
4. Dedupe Realtime + `user_id` filter on notifications (P7, P8 / X6)
5. Upstash (or equivalent) rate limiter (S9 / X4)

### Tier C — Quality bar (2–4 weeks)

1. Supabase typegen; reduce `any`
2. Zod on server actions
3. E2E for login, order create, portal magic link
4. Move reports / PDF / stall-flagging off request path
5. Prettier, husky, root README, error boundaries

### Tier D — Multi-tenant scale (when approaching 30+ tenants)

1. Per-client Supabase projects (already one Vercel project per slug)
2. Signed storage URLs
3. Server-side search / FTS
4. Background job infrastructure

---

## Portal / anon RLS clarification

| Layer | Mechanism |
|-------|-----------|
| Auth | Magic-link portal token (opaque or legacy HMAC), not Supabase Auth login |
| Data access | `createAdminClient()` (service role) after token + tenant checks |
| Anon RLS | **Not required** for portal reads; previously exposed PII to anyone with the public anon key |

---

## Related files

- Migration: `supabase/migrations/20260805140000_p0_security_lockdown.sql`
- Company write helper: `src/lib/resolveWriteCompanyId.ts`
- Public enquiry path: `src/features/enquiries/actions/enquiryActions.ts` (`createEnquiry`)
- Multi-tenant docs: `specs/multi-tenant-config.md`, `config/env/README.md`

---

## Changelog

| Date | Note |
|------|------|
| 2026-08-05 | Initial audit documented; P0 Critical security fixes committed (`aac3700`) |
| 2026-08-05 | Clarified portal does not need anon RLS (service-role + magic links) |
