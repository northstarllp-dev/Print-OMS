# Portal & Storage Security Hardening Plan

> **Status:** Planned — not implemented.  
> **Created:** 2026-07-06  
> **Context:** Follow-up from Site Visit workflow audit. Mutation auth (#2–#3, #7, `updateOrderStageAction`) is largely fixed; these items are defense-in-depth gaps.

---

## Security posture today

These three issues are **defense-in-depth gaps**, not broken auth on mutations (those are mostly fixed now). They matter because:

- The **anon key is public** (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) — anyone can call Supabase directly.
- **Portal pages** use the browser anon client for realtime and uploads.
- **Staff pages** also upload from the browser, but usually with an authenticated Supabase session.

---

## 1. Client-side storage uploads

### What exists today

`SiteVisitModule.tsx` (same pattern in `DesignModule`, `DesignTab`, `InstallationModule`):

```ts
const supabase = createClient();
const path = `${order.id}/${Date.now()}-${Math.random()}.ext`;
await supabase.storage.from("site-visit-photos").upload(path, file, ...);
const { data } = supabase.storage.from("site-visit-photos").getPublicUrl(path);
```

| Setting | Current |
|--------|---------|
| Bucket | `site-visit-photos` |
| Visibility | Public URLs via `getPublicUrl` |
| MIME / size | All types, 50MB (`20260704000000_update_site_visit_photos_bucket.sql`) |
| Upload auth | Browser client → whatever `storage.objects` RLS allows |
| DB stores | Full public URLs in `photos` jsonb |

Target architecture already documented in [`docs/secure-storage-architecture.md`](./secure-storage-architecture.md) (private buckets + signed URLs + server mediation).

### Risk

- **Public bucket:** anyone with a URL can read the file forever (URLs live in DB, chat, logs).
- **Weak write RLS:** anon/authenticated user could upload to arbitrary paths if policies are loose.
- **No app-level validation:** client can send any file type; only bucket limits apply.
- **Path guessing:** `{orderUuid}/...` is predictable if order UUIDs leak.

### Recommended plan (phased)

#### Phase A — Stop the bleeding (migration + policies, no UI rewrite)

1. Add `storage.objects` RLS migration:
   - **INSERT:** `authenticated` only; path must match `(storage.foldername(name))[1] = order_id` for an order the user's company owns (join `orders` on `company_id`).
   - **DELETE:** same scope.
   - **SELECT:** deny for `anon` on this bucket (or make entire bucket private).
2. Set bucket `public = false` in Supabase.
3. Tighten bucket `allowed_mime_types` for site-visit **photos** only (see Phase C for shared-bucket issue).

#### Phase B — Server-mediated uploads (correct long-term fix)

1. Add server actions, e.g.:
   - `uploadSiteVisitPhotoAction(orderId, FormData)` — `assertStageEditPermission("site_visit")`
   - `uploadPortalDesignAssetAction(orderId, FormData)` — `assertStageEditOrPortalOrder(...)`
2. Server validates:
   - Max size (e.g. 10MB photos, 50MB design files)
   - MIME + magic bytes (`image/jpeg`, `image/png`, `image/webp` for site photos)
   - Filename/extension sanity
3. Server uploads with **service role** or authenticated server client to a **scoped path**.
4. Return **relative path** only; stop writing public URLs to DB.
5. Replace `getPublicUrl` with `createSignedUrl` (staff client or server on render).

#### Phase C — Bucket split (recommended)

`site-visit-photos` is shared with design PDFs/CDRs. Split:

| Bucket | Use | MIME policy |
|--------|-----|-------------|
| `site-visit-photos` | Field photos only | `image/*` |
| `order-design-assets` | Proofs, PDFs, CDR | broader list |

### Flow impact

| Area | Today | After |
|------|-------|-------|
| Staff photo upload | Instant client upload → public URL in state → Save Draft | Upload action → relative path → signed URL for preview → Save Draft stores path |
| Portal design upload | Same, anon client | Portal-validated server action |
| Viewing old photos | Static public URL | Signed URL (expires ~15 min); may need refresh on long sessions |
| Existing data | Public URLs in DB | One-time migration: strip URL → path; or dual-read during transition |

**User-visible change:** slightly slower uploads; images may need refresh after signed URL expiry (staff + portal).

---

## 2. Portal anon SELECT policies (realtime)

### What exists today

`supabase/migrations/20260706130000_order_detail_realtime.sql`:

```sql
create policy "Portal anon read site_visits"
  on public.site_visits for select
  to anon
  using (true);
```

Same pattern for `orders`, `site_visit_measurements`, `designs`, `productions`, `installations`, `order_activity`.

`useOrderDetailSync` subscribes from the **browser anon client**. Portal access is gated by the **HMAC magic link** in Next.js, but **Supabase RLS does not see that token** — so anon can `SELECT` all rows on those tables if they use the public anon key.

### Risk

- Customer A's order data, measurements, designs, internal activity visible to anyone who can query Supabase as `anon`.
- This is the **largest data-exposure issue** of the three.
- Documented as a tradeoff for realtime without a Supabase session.

### Recommended plan (pick one track)

#### Track 1 — Portal-scoped Supabase JWT (best balance)

1. On portal page load (server): verify magic link → mint a **short-lived custom Supabase JWT** with claims:
   - `customer_id` and/or `order_id`
   - `role: portal`
2. Browser `createClient` uses that session instead of raw anon.
3. Replace `using (true)` with scoped policies, e.g.:

```sql
-- Example shape (exact SQL depends on claim format)
using (
  order_id in (
    select id from orders
    where customer_id = (auth.jwt() ->> 'customer_id')::uuid
  )
)
```

4. Realtime subscriptions keep working, but only for that customer's rows.

#### Track 2 — No anon DB access for portal (simplest security, more work)

1. Remove portal anon `SELECT` policies.
2. Portal detail uses **server-rendered data + `router.refresh()`** or a server SSE/polling endpoint.
3. `useOrderDetailSync` **disabled on portal**; staff/admin keep realtime with `authenticated` JWT.

#### Track 3 — Keep tradeoff (not recommended for production)

- Document + accept risk; rely on UUID obscurity.
- Minimum: remove `order_activity` from anon read (internal comms leak).

### Flow impact

| Track | Portal realtime | Staff realtime | Effort |
|-------|-----------------|----------------|--------|
| 1 JWT | Yes, scoped | Unchanged | Medium |
| 2 Server-only | Polling / refresh | Unchanged | Medium–high |
| 3 Status quo | Yes, all data | Unchanged | None |

**Recommended:** Track 1 for portal; staff already uses authenticated sessions and tenant RLS (`20260704000011_tenant_isolation_rls.sql`).

---

## 3. No server file validation

### What exists today

- Validation = bucket `file_size_limit` (50MB) + `allowed_mime_types = NULL` (anything).
- Client sets `contentType: file.type` (spoofable).
- No check in `updateSiteVisitDetailsAction` that URLs/paths belong to the order.

### Risk

- Malware / executables stored in your bucket.
- Storage abuse (large files).
- Attacker uploads to a path, then references URL in `photos` jsonb if save path doesn't verify ownership.

### Recommended plan

**With Phase B uploads (preferred):**

```ts
// In uploadSiteVisitPhotoAction
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

if (file.size > MAX_BYTES) throw new Error("File too large");
if (!ALLOWED.has(file.type)) throw new Error("Invalid file type");
// optional: file-type npm package for magic-byte check
```

**On save (`updateSiteVisitDetailsAction`):**

- Reject `photos[]` entries that aren't owned paths for this `order_id` (prefix check or lookup in `storage.objects`).

**Bucket config:**

- Re-enable `allowed_mime_types` for photo bucket after split.

### Flow impact

- Unsupported files fail fast with a clear error (staff + portal).
- Design PDFs/CDRs need the separate bucket with a wider allowlist.
- No change to scheduling / freeze / admin workflow.

---

## Suggested implementation order

```
Priority 1 — Portal data leak (highest impact)
  └─ Portal JWT + scoped anon/authenticated RLS (or disable portal realtime)

Priority 2 — Storage exposure
  └─ Private bucket + storage.objects RLS
  └─ Server upload actions + signed URLs
  └─ Migrate URL → path in DB

Priority 3 — File validation
  └─ Server-side MIME/size checks in upload actions
  └─ Path ownership check on save

Priority 4 — Hardening
  └─ Split site-visit vs design buckets
  └─ Storage orphan cleanup cron
  └─ Align all modules with docs/secure-storage-architecture.md
```

---

## What does *not* change in the business workflow

- Schedule → audit → Save Draft → freeze → admin workflow choice: **same steps**.
- Portal quote/design approve flows: **same UX**, different transport for files and sync.
- Staff realtime on order detail: **unchanged** if using authenticated client (already tenant-scoped).

What **does** change:

- Uploads go through server actions (one extra round-trip).
- Images use expiring signed URLs instead of permanent public links.
- Portal realtime either gets a scoped session or falls back to refresh/poll.

---

## Rough effort

| Item | Migrations | Server | Client | Risk if skipped |
|------|------------|--------|--------|-----------------|
| Portal scoped RLS | 1 | Portal session exchange | `useOrderDetailSync` portal path | Cross-customer data leak |
| Private bucket + RLS | 1 | Upload actions | All upload/preview components | Public file leak |
| File validation | 0 | Upload + save checks | Error UI | Abuse / malware hosting |
| URL → path migration | 1 script | — | Mapper dual-read | Broken old images if rushed |

---

## Related files

| Area | Path |
|------|------|
| Site visit spec (security gaps section) | `specs/site-visit.md` |
| Target storage architecture | `docs/secure-storage-architecture.md` |
| Portal anon RLS | `supabase/migrations/20260706130000_order_detail_realtime.sql` |
| Tenant RLS (authenticated) | `supabase/migrations/20260704000011_tenant_isolation_rls.sql` |
| Bucket MIME/size | `supabase/migrations/20260704000000_update_site_visit_photos_bucket.sql` |
| Client uploads | `SiteVisitModule.tsx`, `DesignModule.tsx`, `DesignTab.tsx`, `InstallationModule.tsx` |
| Realtime hook | `src/features/orders/realtime/useOrderDetailSync.ts` |
| Portal token verify | `src/utils/portal-tokens.ts` |
| Server permissions | `src/features/orders/workspace/shared/serverPermissions.ts` |

---

## Decision log (fill in when implementing)

| Decision | Choice | Date | Notes |
|----------|--------|------|-------|
| Portal realtime track | _TBD: JWT vs polling_ | | |
| Bucket split | _TBD: yes/no_ | | |
| Photo max size | _TBD: e.g. 10MB_ | | |
