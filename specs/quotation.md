# Quotation Feature Specification

> **Source of truth:** Implementation in the Printec OMS codebase. This document reflects **actual code behavior** as audited on 2026-07-07.

---

## Overview

The Quotation stage produces a priced estimate for signage work. Staff build line items from the product catalogue and site-visit measurements, send the quote directly to the customer portal, and collect approval or revision feedback before the order advances to Design or Production (depending on `orders.workflow_type`). Admin intervenes only after customer approval to advance the pipeline.

Staff work happens in `OrderWorksheetModal` → `QuotationModule`. Customer actions use shared portal components (`QuotationTab`, `useQuotationActions`) backed by server actions with service-role mutations.

---

## Business Goal

- Turn site-visit measurements into an itemized, GST-aware quote.
- Let staff and admin send quotes directly to the customer (no mandatory internal review gate).
- Let customers approve or request revisions via the portal (server actions only).
- Require admin approval to advance the order after customer approval.
- Feed `quotations.grand_total` into the payments module for milestone calculations.

---

## Workflow

### Order pipeline stages (quotation-related)

| Order `stage` | Meaning |
|---------------|---------|
| `Quotation In Progress` | Quote is being built internally. Entered via `setWorkflowTypeAction` (quote_first after site visit) or via `adminApproveStageAction` from `Design Approved` (design_first). |
| `Quotation Sent` | Admin sent the quote (`sendQuotationToCustomer`). |
| `Quotation Negotiation` | Customer declined / requested revision. |
| `Quotation Approved` | Customer approved, or admin overrode via `adminMarkQuotationApprovedAction`. Ready to advance to next pipeline stage. |

`orders.stage_status` is separate. Staff can set `Pending Admin Approval: Quote Approval` via `requestStageAdvancementAction` while in quotation stages; admin clears it with stage-specific actions or `adminApproveStageAction` (see caveats below).

### Quotation record `status` (on `quotations.status`)

| Status | Set by | Meaning |
|--------|--------|---------|
| `Draft` | Default / first save | Internal editing. |
| `Pending Approval` | **Legacy only** (pre-2026-07-07 workflow) | Treated like `Draft` for send; no longer set by UI. |
| `Sent` | `sendQuotationToCustomer` | Customer-facing; approve/decline shown in portal when `status === "Sent"`. |
| `Approved` | `customerApproveQuotation`, `adminMarkQuotationApprovedAction` | Costs locked; order can advance when `orders.stage` is also `Quotation Approved`. |
| `Rejected` | `customerRequestRevision` | Portal label “Sent for Revision”; staff/admin may edit and re-send. |

There is no separate `Negotiation` DB status. The portal maps `Rejected` to “Sent for Revision”.

### End-to-end flow

```
Site visit frozen → admin setWorkflowTypeAction
        ↓
quote_first: orders.stage = Quotation In Progress
design_first: Design first … later adminApproveStageAction → Quotation In Progress
        ↓
Staff opens Quotation tab (QuotationModule in OrderWorksheetModal)
        ↓
Sections auto-created from site_visit_measurements (or restored signage_options)
        ↓
Products selected → rates/measurements filled (client-side calc; server recomputes on save)
        ↓
Staff or Admin → Send to Customer (upsert + sendQuotationToCustomer)
        ↓
status → Sent, orders.stage → Quotation Sent, WhatsApp notification
        ↓
Customer portal: Approve OR Decline/Revise (server actions)
        ↓
Approve: quotations.status = Approved, orders.stage = Quotation Approved
Decline: quotations.status = Rejected, orders.stage = Quotation Negotiation
        ↓
Staff/Admin revises → edit lines → Send to Customer again (from Rejected or legacy Pending Approval)
        ↓
Staff: Request Advance to Design/Production (flags stage_status pending only)
Admin: Move to Design/Production (one click, advances stage)
        (admin may use Approve without Customer & Advance when status = Sent)
```

**Note:** A `quotations` row is **not** auto-created when the order enters `Quotation In Progress`. It is created on the first `upsertQuotation` call.

---

## Workflow States

### Quotation `status` transitions

| From | Action | To |
|------|--------|-----|
| | First `upsertQuotation` | `Draft` (default) |
| `Draft` / legacy `Pending Approval` / `Rejected` | Staff or Admin **Send to Customer** (`sendQuotationToCustomer`) | `Sent` |
| `Sent` | Customer approve | `Approved` |
| `Sent` | Customer decline | `Rejected` |
| `Rejected` | Staff or Admin re-send | `Sent` |
| Any (admin) | `adminMarkQuotationApprovedAction` | `Approved` |

`Approved` cannot be set via `upsertQuotation`. `Rejected` cannot be **newly** set via upsert, but an already-`Rejected` quote may be re-saved while being revised (`assertUpsertStatusTransition`).

### Order `stage` mutations (quotation-related)

| Trigger | `orders.stage` after | `quotations.status` |
|---------|----------------------|---------------------|
| `setWorkflowTypeAction` (quote_first) | `Quotation In Progress` | unchanged |
| `sendQuotationToCustomer` | `Quotation Sent` | `Sent` |
| `customerApproveQuotation` | `Quotation Approved` | `Approved` |
| `customerRequestRevision` | `Quotation Negotiation` | `Rejected` |
| `adminMarkQuotationApprovedAction` | `Quotation Approved` | `Approved` |
| `adminApproveStageAction` from `Quotation Approved` | Design or Production (workflow map) | unchanged |
| `adminApproveStageAction` from `Quotation In Progress`, `Quotation Sent`, or `Quotation Negotiation` | **Blocked** throws error; use quotation-specific actions |

### `stage_status` (admin queue)

| Trigger | `stage_status` set |
|---------|-------------------|
| `requestStageAdvancementAction` when stage is `Quotation In Progress`, `Quotation Sent`, or `Quotation Negotiation` | `Pending Admin Approval: Quote Approval` |
| `requestStageAdvancementAction` when stage is `Quotation Approved` | `Pending Admin Approval: Design Approval` (quote_first) or `Production Ready` (design_first) |

---

## Business Rules

1. **One quotation per order** `upsertQuotation` upserts by `order_id` (`maybeSingle`).
2. **Friendly ID** `QT-NNN` per tenant (`company_id`); DB trigger `generate_quotation_id()` on insert. App does not generate IDs.
3. **Pricing types** `per_unit` or `per_sqft` only.
4. **Qty / measurement** Single logical field; `quantity` and `totalSqFt` kept in sync in UI. Formula: `amount = measurement × unitPrice`.
5. **Legacy lines** If `quantity === 1` and `totalSqFt > 1`, measurement reads from `totalSqFt`.
6. **GST** Per line item (0, 5, 12, 18, 28). Section totals show line amount **including** GST in UI.
7. **Discount** Flat ₹ subtracted from subtotal; tax scaled proportionally on server and client.
8. **Shipping** Optional flat ₹ after discount and tax.
9. **Grand total** `round((subtotal - discount + tax + shipping) × 100) / 100`.
10. **Site measurements** Section headers use `formatSiteMeasurementLabel()`; product select pre-fills `width × height` when both exist.
11. **Edit lock** Staff and admin cannot edit when status is `Sent` or `Approved`. Editable when `Draft`, `Rejected`, or legacy `Pending Approval`.
12. **Send to customer** `sendQuotationToCustomer` allowed from `Draft`, legacy `Pending Approval`, or `Rejected` (`assertCanSendQuotationToCustomer`).
13. **Customer visibility** Only `Sent`, `Approved`, `Rejected` (`isQuotationVisibleToCustomer` / `getCustomerVisibleQuotationForOrder`).
14. **Customer actions** Only when `status === "Sent"`; via `customerApproveQuotation` / `customerRequestRevision`.
15. **Workflow fork** `quote_first`: Quotation → Design → Production. `design_first`: Design → Quotation → Production.
16. **Approve without customer** Admin button when `status === "Sent"` calls `handleQuotationAdvance` → `adminMarkQuotationApprovedAction` then `adminApproveStageAction`.
17. **Move to next stage** Requires `status === "Approved"` **and** `orders.stage === "Quotation Approved"`. Staff button label: **Request Advance to {Design/Production}** (flags `stage_status` only). Admin button: **Move to {Design/Production}** (advances immediately).
18. **WhatsApp on send** `quotation_ready` on first send; `revised_quotation_ready` when resending from `Rejected`.
19. **Confirm modal** `QuotationConfirmModal` before Send to Customer.
20. **Bill To** Read-only display of `order.businessName - order.clientName` (not persisted on quotation row).
21. **Quotation tab footer** `OrderWorksheetModal` delegates footer actions to `QuotationModule` via `#modal-footer-portal` (shell Save/Push buttons hidden on quote tab).

---

## User Permissions

### Admin
- Edit when status is `Draft`, `Rejected`, or legacy `Pending Approval` (`isLocked` when `Sent` or `Approved`).
- Save Draft, **Send to Customer** (same button as staff).
- Approve without Customer & Advance when `Sent`.
- Move to Design/Production when `Approved` + `Quotation Approved` (one click).
- `adminMarkQuotationApprovedAction` override.

### Staff (Employee / Marketer)
- Edit when status is `Draft`, `Rejected`, or legacy `Pending Approval`.
- Save Draft, **Send to Customer** (requires quotation stage grant).
- **Request Advance to Design/Production** when `Approved` + `Quotation Approved` (flags `stage_status` only; does not move stage).
- Cannot advance stage without admin approval.

### Customer (portal)
- SSR via `getCustomerVisibleQuotationForOrder` (service role + visibility filter).
- Approve/decline when `status === "Sent"` via `useQuotationActions`.
- Portal realtime: `useOrderDetailSync` on `orders` (and other stage tables); **not** `quotations` row events for anon clients (no anon RLS on `quotations`).
- Tab follows stage forward via `portalStageNavigation.ts` when `orders.stage` advances.

RBAC: `assertStageEditPermission("quotation")` on staff mutations; `assertPortalOrderOwnership` on customer mutations.

---

## Database Tables

### `quotations`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `quotation_id` | text | Friendly `QT-NNN`; unique per `(company_id, quotation_id)` |
| `order_id` | uuid FK → `orders.id` | One row per order |
| `company_id` | uuid FK | Required on insert |
| `customer_id` | uuid FK | From order if omitted |
| `status` | text | `Draft`, `Pending Approval`, `Sent`, `Approved`, `Rejected` |
| `signage_options` | jsonb | Sections with `lines` |
| `subtotal`, `discount`, `tax`, `shipping`, `grand_total` | numeric | Server-computed on upsert |
| `notes`, `terms` | text | |
| `rejection_reason` | text | Set on customer decline |
| `admin_approved_at`, `admin_approved_by` | timestamptz / text | Set by `sendQuotationToCustomer` |
| `customer_response` | text | `Yes`, `Revision`, or `Admin` |

**RLS:** Company-scoped authenticated policy; **no anon policies** (`20260706130000_quotation_revoke_anon_access.sql`).

### Related tables

| Table | Role |
|-------|------|
| `orders` | `stage`, `stage_status`, `workflow_type` |
| `site_visits` / `site_visit_measurements` | Section source data |
| `products` | Catalogue |
| `order_activity` | Timeline |
| `payments` | Reads `grand_total` via `getPaymentBalanceSummary` |

### `signage_options` JSONB structure

```json
[
  {
    "siteVisitItemId": "uuid",
    "itemLabel": "Main Facade",
    "notes": "string",
    "lines": [
      {
        "id": "uuid",
        "productId": "uuid",
        "description": "ACP Board",
        "quantity": 150,
        "pricingType": "per_sqft",
        "unit": "sqft",
        "unitPrice": 450,
        "totalSqFt": 150,
        "gstRate": 18,
        "notes": "optional"
      }
    ]
  }
]
```

---

## Quotation Data Structure (TypeScript)

- UI: `SignageSection[]` in `QuotationModule`; portal: `order.quoteDetails` camelCase mapped in SSR pages.
- Extracted types: `src/features/orders/workspace/modules/quotation/types.ts` (`QuotationProduct`).

---

## Pricing Logic

1. `resolveInitialPricing()` in `QuotationModule` maps product `pricing_type` → `per_sqft` or `per_unit`.
2. `unitPrice` from `price_per_sqft` or `price_per_unit`.
3. `calcLineAmount(line) = getLineMeasurement(line) × unitPrice`.
4. Line display total (incl. GST) = `calcLineAmount × (1 + gstRate/100)`.

---

## Calculation Rules

```
subtotal = Σ sections Σ lines calcLineAmount(line)
totalGst = Σ sections Σ lines calcLineAmount(line) × (gstRate/100)
tax      = subtotal > 0 ? round(totalGst × (1 - discount/subtotal) × 100) / 100 : 0
grandTotal = round((subtotal - discount + tax + shipping) × 100) / 100
```

- **Client:** `QuotationModule` live preview.
- **Server:** `computeQuotationTotals()` in `upsertQuotation`; discount clamped to `[0, subtotal]`.

---

## Discount Rules

- Flat ₹ amount, not percentage.
- Proportional tax reduction when discount applied.
- Optional UI toggle (“+ Discount”).

---

## Tax Rules

- Per-line GST dropdown: 0, 5, 12, 18, 28.
- Single `tax` column (no IGST/CGST split).
- New lines default GST from `taxPercent` state (derived from saved `tax/subtotal`, default 18%).

---

## Server Actions

| Action | File | Auth | Behavior |
|--------|------|------|----------|
| `getQuotationByOrderId` | `quotationActions.ts` | Authenticated staff | Read single row |
| `getCustomerVisibleQuotationForOrder` | `quotationActions.ts` | Portal SSR (caller validates token) | Visible rows only |
| `getSiteVisitMeasurementsForOrder` | `quotationActions.ts` | Authenticated staff | CamelCase measurements |
| `upsertQuotation` | `quotationActions.ts` | `assertStageEditPermission("quotation")` | Upsert + server totals + status guards |
| `sendQuotationToCustomer` | `quotationActions.ts` | Stage edit | `Draft`/`Pending Approval`/`Rejected` → `Sent`; updates `orders.stage`; activity; WhatsApp |
| `adminMarkQuotationApprovedAction` | `quotationActions.ts` | Stage edit | Force `Approved` + `Quotation Approved` |
| `customerApproveQuotation` | `quotationActions.ts` | Portal session + service role | When `status=Sent` |
| `customerRequestRevision` | `quotationActions.ts` | Portal session + service role | When `status=Sent`; requires feedback text |

### Related order actions (`orderActions.ts`)

| Action | Quotation role |
|--------|----------------|
| `setWorkflowTypeAction` | Enters `Quotation In Progress` (quote_first) |
| `requestStageAdvancementAction` | Sets `stage_status` for admin queue |
| `adminApproveStageAction` | Generic stage++ map **blocked** for `Quotation In Progress`, `Quotation Sent`, `Quotation Negotiation`; allowed from `Quotation Approved` |
| `revalidateOrderPathsAction` | Portal cache after customer mutations |

### Revalidation (`revalidateOrderPaths.ts`)

| Helper | When |
|--------|------|
| `revalidateStaffOrderDetailPaths` | `upsertQuotation`, `adminMarkQuotationApprovedAction` |
| `revalidateOrderDetailPaths` | `sendQuotationToCustomer`, customer approve/decline |

---

## UI Components

| Component | Location | Audience |
|-----------|----------|----------|
| `QuotationModule` | `workspace/modules/quotation/QuotationModule.tsx` | Staff / Admin |
| `QuotationConfirmModal` | Inline in `QuotationModule.tsx` (~line 1633); extracted copy exists but **not imported** |
| `ProductInfoModal` | Inline in `QuotationModule.tsx`; extracted copy in `components/` **not imported** |
| `QuotationTab` | `app/portal/components/QuotationTab.tsx` | Customer |
| `useQuotationActions` | `app/portal/hooks/useQuotationActions.ts` | Customer approve/decline |
| `OrderWorksheetModal` | Embeds `QuotationModule`; `useOrderDetailSync` + `externalRealtime` |
| `portalStageNavigation.ts` | Tab-follow-stage on portal when `orders.stage` advances |

**Portal approve CTA:** respects `workflow_type` (design_first → Production; quote_first → Design).

Footer actions on staff worksheet render via `createPortal` to `#modal-footer-portal`.

---

## File Structure

```
src/features/quotations/
  actions/quotationActions.ts
  utils/lineAmount.ts
  utils/quotationSecurity.ts
src/features/orders/actions/
  orderActions.ts
  revalidateOrderPaths.ts
  siteVisitMapper.ts
src/features/orders/workspace/modules/quotation/
  QuotationModule.tsx
  QuotationModule.tsx.bak          # dead backup remove in cleanup
  types.ts
  components/
    QuotationConfirmModal.tsx      # extracted but unused by main module
    ProductInfoModal.tsx           # extracted but unused by main module
src/features/orders/realtime/
  useOrderDetailSync.ts
  orderDetailPatch.ts
src/features/order-detail/components/
  OrderWorksheetModal.tsx
src/app/portal/
  components/QuotationTab.tsx
  hooks/useQuotationActions.ts
  utils/portalStageNavigation.ts
  page.tsx
  order/[orderId]/page.tsx
  PortalClient.tsx
  order/[orderId]/OrderDetailClient.tsx
src/app/staff/(dashboard)/orders/[id]/page.tsx
src/app/admin/(dashboard)/orders/[id]/page.tsx
supabase/migrations/*quotation*
specs/quotation.md
```

---

## Data Flow

```
[Server] staff/admin page → getQuotationByOrderId + getSiteVisitMeasurementsForOrder
    ↓
[Client] QuotationModule state (sections, discount, shipping, notes, terms)
    ↓ calc on change
[Client] upsertQuotation server recomputes totals
    ↓
[DB] quotations upsert + revalidateStaffOrderDetailPaths
    ↓
[Realtime] OrderWorksheetModal useOrderDetailSync → quotationRealtimeRow → QuotationModule externalRealtime
    ↓
[Admin] sendQuotationToCustomer
    ↓
[DB] quotations + orders + order_activity + WhatsApp + revalidateOrderDetailPaths
    ↓
[Portal SSR] getCustomerVisibleQuotationForOrder
    ↓
[Portal] useOrderDetailSync (orders.stage, etc.) + tab-follow-stage
    ↓
[Portal] customerApproveQuotation / customerRequestRevision + optimistic local patch
```

---

## Timeline Events

| `metadata.action` | Content pattern |
|-------------------|-----------------|
| `quotation_sent` | Quotation QT-NNN approved by {name} and sent to customer |
| `quotation_approved_by_admin` | Admin marked quotation approved |
| `quotation_approved_by_customer` | {name} has approved the quotation |
| `quotation_declined` | Quotation Declined. Feedback: {notes} |
| `stage_approved` | Admin approved stage progression (generic `adminApproveStageAction`) |

---

## Validation Rules

**Client (`QuotationModule`):**
- Measurement min 0.01; blur resets invalid values.
- Send to Customer disabled if `sections.length === 0`.
- No `grand_total > 0` enforcement.

**Server (`upsertQuotation`):**
- `assertStageEditPermission("quotation")`
- `assertValidQuotationStatus`, `assertUpsertStatusTransition`
- `sanitizeSignageOptions` (≤100 sections, ≤200 lines/section)
- `computeQuotationTotals`

**Portal:**
- Decline requires non-empty feedback (`customerRequestRevision`).

---

## Error Handling

- Server actions throw `Error(message)`.
- `QuotationModule` shows inline `saveMsg` banner.
- `useQuotationActions` uses `alert()` on failure.
- Staff page catches `getQuotationByOrderId` errors → `null` initial quotation.

---

## Security Rules

**Staff/admin:**
- RLS: `quotations` scoped to `company_id = current_company_id()`.
- `assertStageEditPermission("quotation")` on mutations.

**Customer portal:**
- Token + `orders.customer_id` verified on SSR pages.
- Reads via service role + `toCustomerVisibleQuotation`.
- Mutations: portal session ownership + service role with `status = 'Sent'` guard.
- **No anon RLS** on `quotations`.

**Portal realtime (other tables):**
- Migration `20260706130000_order_detail_realtime.sql` adds broad anon `SELECT` on `orders`, `site_visits`, etc. for browser realtime see `docs/portal-and-storage-security-plan.md` (known exposure; quotations table excluded).

---

## Edge Cases

1. **No site visit measurements** “General Signage” fallback section or saved `signage_options` only.
2. **Re-send after rejection** Staff or admin edits when `Rejected`, Send to Customer; WhatsApp `revised_quotation_ready`.
3. **Admin skip customer** “Approve without Customer & Advance” when `Sent`.
4. **design_first** Portal CTA mentions Production instead of Design.
5. **`order_activity.order_id`** Friendly `order_id` string (e.g. `A002-001`).
6. **Placeholder quote ID** UI shows `` until first save; DB assigns `QT-NNN` on insert.
7. **Staff realtime** Parent owns channel when `externalRealtime`; module keeps fallback internal subscription when false.
8. **Portal quotation line realtime** Unlikely via anon (no quotations RLS); stage changes on `orders` still sync.
9. **Tab follow stage** Portal auto-switches tab/step forward only when pipeline advances (`didStageAdvance`).
10. **`adminApproveStageAction` on mid-quotation stages** Throws error for `Quotation In Progress`, `Quotation Sent`, `Quotation Negotiation`. Use Send to Customer or quotation tab actions instead.
11. **Saving `Rejected` via upsert** Allowed when quote is already `Rejected` (revision edits). Cannot newly set `Rejected` via upsert.
12. **Discount > subtotal** Server clamps to `subtotal`.

---

## Future Improvements

- Finish `QuotationModule` extraction import `components/QuotationConfirmModal`, `ProductInfoModal`; delete inline duplicates and `.bak`.
- Remove dead `assertQuotationEditable` or wire it into `upsertQuotation`.
- Portal-scoped JWT instead of anon `using (true)` realtime policies.
- Replace `alert()` in `useQuotationActions` with inline error UI.
- Add automated tests for `computeQuotationTotals` and status transition guards.
- Migrate legacy `Pending Approval` rows to `Draft` via one-time SQL if desired.

---

## Change Log

| Version | Date | Summary |
|---------|------|---------|
| 1.0 | 2026-07-03 | Initial specification |
| 1.1 | 2026-07-04 | Unified qty/measurement; site measurement units |
| 2.0 | 2026-07-06 | Pending Approval workflow; server actions; security notes |
| 2.1 | 2026-07-06 | Admin review gate; portal gaps; WhatsApp rules |
| 2.2 | 2026-07-07 | Security fixes; portal server actions; scoped revalidation |
| 2.3 | 2026-07-07 | **Full codebase audit:** portal `useOrderDetailSync` (removed `usePortalOrderRealtime`); tab-follow-stage; inline vs extracted modals; `adminApproveStageAction` caveats; dead code inventory |
| 2.4 | 2026-07-07 | **Workflow friction fix:** unified Send to Customer for staff+admin; removed mandatory Pending Approval gate; fixed Rejected revision save; `adminApproveStageAction` guard for mid-quotation stages; staff Request Advance label; read-only Bill To |
