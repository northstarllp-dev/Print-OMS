# Session Changelog — Quotation Workflow Audit & Fixes

> **Date:** 2026-07-06 / 2026-07-07  
> **Scope:** Quotation security, portal mutations, staff workflow logic, performance, technical debt, build fixes, and specification updates.  
> **Primary spec:** [`specs/quotation.md`](../specs/quotation.md) v2.2

---

## Summary

This session audited the full quotation workflow end-to-end, fixed security and logic bugs, unified the customer portal quotation experience, reduced over-broad cache invalidation, began splitting the monolithic `QuotationModule`, and brought documentation in line with the codebase.

---

## 1. Security & RLS

### Database migrations

| Migration | Purpose |
|-----------|---------|
| `supabase/migrations/20260706120000_quotation_portal_rls.sql` | Interim: scoped anon SELECT to `Sent`/`Approved`/`Rejected`; dropped anon UPDATE |
| `supabase/migrations/20260706130000_quotation_revoke_anon_access.sql` | **Final:** removed all anon policies on `quotations` |

**Live DB state (verified via Supabase MCP):** RLS enabled on `quotations`; one authenticated company-scoped policy; no anon policies.

### Portal mutations

- **Before:** `PortalClient` / `OrderDetailClient` updated `quotations` via anon Supabase client (permissive RLS).
- **After:** `customerApproveQuotation` and `customerRequestRevision` in `quotationActions.ts`:
  - Validate portal session + order ownership (`assertPortalOrderOwnership`)
  - Mutate via **service role** with `status = 'Sent'` guard
  - Set `customer_response`, `rejection_reason`, `orders.stage`, and `order_activity` consistently

### Server-side total validation

- **`upsertQuotation`** now calls `computeQuotationTotals()` and persists server-computed `subtotal`, `discount`, `tax`, `shipping`, `grand_total` (discount clamped to `[0, subtotal]`).
- Client preview in `QuotationModule` still uses the same formulas for UX; server is authoritative on save.

### `quotationSecurity.ts` (new)

| Export | Role |
|--------|------|
| `assertValidQuotationStatus` | Whitelist status values |
| `assertUpsertStatusTransition` | Block `Approved`/`Rejected` via save; lock `Sent`/`Approved` edits |
| `assertCanSendQuotationToCustomer` | Only `Pending Approval` or `Rejected` → send |
| `sanitizeSignageOptions` | Bounds check sections/lines |
| `toCustomerVisibleQuotation` | Strip Draft/Pending Approval for portal SSR |

### Portal visibility

- `isQuotationVisibleToCustomer` — only `Sent`, `Approved`, `Rejected`
- `getCustomerVisibleQuotationForOrder` — SSR via service role + visibility filter
- Both portal routes hide draft/internal quotes behind “being prepared” UI

---

## 2. Staff workflow logic (`QuotationModule`)

| Change | Before | After |
|--------|--------|-------|
| Admin **Push to Customer** | Allowed from `Draft` (bypass review) | Only from `Pending Approval` or `Rejected` |
| Admin from `Draft` | Push to Customer | **Submit for Review** → `Pending Approval` |
| **Move to next stage** | Asymmetric staff/admin rules | Both require `status === Approved` and `stage === Quotation Approved` |
| Admin override | Mixed into stage advance | Separate **Approve without Customer & Advance** when `status === Sent` |
| WhatsApp on resend | `revised_quotation_ready` when prior was `Sent` | `revised_quotation_ready` **only** when resending from `Rejected` |
| Friendly `quotation_id` | App-side generator (removed) | DB trigger `generate_quotation_id()` per `company_id` |

---

## 3. Portal unification

### New shared modules

| File | Purpose |
|------|---------|
| `src/app/portal/components/QuotationTab.tsx` | Shared quotation UI (line items, totals, approve/decline) |
| `src/app/portal/hooks/useQuotationActions.ts` | Approve/decline → server actions + `revalidateOrderPathsAction` |
| `src/app/portal/hooks/usePortalOrderRealtime.ts` | Single realtime channel for order/quotation updates |

### Consumers updated

- `src/app/portal/PortalClient.tsx` — multi-order wizard
- `src/app/portal/order/[orderId]/OrderDetailClient.tsx` — single-order detail
- `src/app/portal/order/[orderId]/page.tsx` — SSR `getCustomerVisibleQuotationForOrder`

### Removed / secured dead code

- `getAllQuotations` removed (unused list action)
- Legacy direct portal Supabase quotation updates removed

---

## 4. Performance

### Scoped path revalidation

- **New:** `src/features/orders/actions/revalidateOrderPaths.ts` (sync helpers, **no** `"use server"`)
  - `revalidateOrderDetailPaths` — admin/staff order detail + portal order page
  - `revalidateStaffOrderDetailPaths` — staff/admin detail only (internal saves)
- `revalidateOrderPathsAction` — portal mutations; no longer invalidates full staff queue
- `upsertQuotation` → `revalidateStaffOrderDetailPaths` only
- `sendQuotationToCustomer` / customer actions → `revalidateOrderDetailPaths`

### Realtime consolidation

- `OrderWorksheetModal` owns the quotations realtime channel
- `QuotationModule` accepts `externalRealtime` / `realtimeQuotation` props
- Portal uses one `usePortalOrderRealtime` hook per client

---

## 5. Technical debt (partial)

### `QuotationModule` extraction (in progress)

| File | Status |
|------|--------|
| `components/QuotationConfirmModal.tsx` | Extracted |
| `components/ProductInfoModal.tsx` | Extracted (+ `types.ts`) |
| `components/ProductSearch.tsx` | Extracted |
| `quotationModuleHelpers.ts` | Extracted |
| `applyQuotationRealtime.ts` | Extracted |
| `QuotationModule.tsx` | Still ~1,100+ lines; inline modal fallbacks remain |

### Build fix (Next.js 16)

**Error:** `Server Actions must be async functions` — sync `revalidateStaffOrderDetailPaths` / `revalidateOrderDetailPaths` exported from `"use server"` file `orderActions.ts`.

**Fix:** Moved sync revalidate helpers to `revalidateOrderPaths.ts`; only async actions remain in `orderActions.ts`.

**Also:** Added missing `types.ts` for `ProductInfoModal.tsx` (TypeScript `Cannot find module '../types'`).

---

## 6. Files touched (code)

### Created

```
src/features/orders/actions/revalidateOrderPaths.ts
src/features/quotations/utils/quotationSecurity.ts
src/app/portal/components/QuotationTab.tsx
src/app/portal/hooks/useQuotationActions.ts
src/app/portal/hooks/usePortalOrderRealtime.ts
src/features/orders/workspace/modules/quotation/types.ts
src/features/orders/workspace/modules/quotation/components/QuotationConfirmModal.tsx
src/features/orders/workspace/modules/quotation/components/ProductInfoModal.tsx
src/features/orders/workspace/modules/quotation/components/ProductSearch.tsx
src/features/orders/workspace/modules/quotation/quotationModuleHelpers.ts
src/features/orders/workspace/modules/quotation/applyQuotationRealtime.ts
supabase/migrations/20260706120000_quotation_portal_rls.sql
supabase/migrations/20260706130000_quotation_revoke_anon_access.sql
```

### Modified (primary)

```
src/features/quotations/actions/quotationActions.ts
src/features/quotations/utils/lineAmount.ts
src/features/orders/actions/orderActions.ts
src/features/orders/workspace/modules/quotation/QuotationModule.tsx
src/app/portal/PortalClient.tsx
src/app/portal/order/[orderId]/OrderDetailClient.tsx
src/app/portal/order/[orderId]/page.tsx
```

---

## 7. Documentation updated

| File | Version | Summary |
|------|---------|---------|
| `specs/quotation.md` | 2.2 | Full alignment with implemented security, workflow, portal, and revalidation behavior |
| `specs/customer-portal.md` | 1.3 | Shared quotation UI, server actions, visibility gating |
| `docs/DATABASE_SCHEMA.md` | 2026-07-07 | `quotations` columns, trigger, RLS (no anon) |
| `specs/readme.md` | 1.4 | Master spec changelog + §4.2 calculations + §6.1 action catalog |

---

## 8. Verification

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | Pass (after `types.ts` + `revalidateOrderPaths.ts` fixes) |
| Dev build (Turbopack) | Compiles after Server Actions fix |
| Supabase MCP — `quotations` RLS | RLS on; company-scoped authenticated policy; no anon |
| Migration history vs live DB | DB state matches goal; some local migration files not yet in remote `supabase_migrations` history |

---

## 9. Known follow-ups (not done in session)

1. **Migration history sync** — Register `20260706120000`, `20260706130000`, and other local-only migrations in remote `supabase_migrations` (idempotent `apply_migration` if desired).
2. **Finish `QuotationModule` extraction** — Remove inline modal duplicates; extract section builder grid.
3. **Other anon policies** — `orders`, `site_visits`, `order_files`, `payments` SELECT still flagged by advisors (out of quotation scope).
4. **Runtime edge case** — Saving with `status: "Rejected"` via `upsertQuotation` throws by design; staff must use customer decline flow or workflow actions.

---

## 10. Related specifications

- [`specs/quotation.md`](../specs/quotation.md) — canonical quotation feature spec (v2.2)
- [`specs/customer-portal.md`](../specs/customer-portal.md) — portal architecture (v1.3)
- [`docs/DATABASE_SCHEMA.md`](./DATABASE_SCHEMA.md) — schema reference
