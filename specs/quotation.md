# Quotation Feature Specification

> **Source of truth:** Implementation in `c:\printec` (Printec OMS). This document reflects actual code behavior as of 2026-07-07.

---

## Overview

The Quotation stage produces a priced estimate for signage work. Staff build line items from the product catalogue and site-visit measurements, optionally route the draft through admin review, send it to the customer portal, and collect approval or revision feedback before the order advances to Design or Production (depending on `workflow_type`).

## Business Goal

- Turn site-visit measurements into an itemized, GST-aware quote.
- Enforce an internal admin gate (optional staff → admin → customer path).
- Let customers approve or request revisions via the portal.
- Feed `grand_total` into the payments module for milestone calculations.

## Workflow

### Order pipeline stages (quotation-related)

| Order `stage` | Meaning |
|---------------|---------|
| `Quotation In Progress` | Quote is being built internally. Entered after site-visit admin approval on **quote_first**, or after design approval on **design_first**. |
| `Quotation Sent` | Admin has sent the quote to the customer (`sendQuotationToCustomer`). |
| `Quotation Negotiation` | Customer declined / requested revision. |
| `Quotation Approved` | Customer approved, or admin overrode approval. Ready to advance. |

`stage_status` is separate. Staff can set `Pending Admin Approval: Quote Approval` via `requestStageAdvancementAction` while still in quotation stages; admin clears it with `adminApproveStageAction`.

### Quotation record `status` (on `quotations.status`)

| Status | Set by | Meaning |
|--------|--------|---------|
| `Draft` | Default / save / admin “Request Changes” | Internal editing. |
| `Pending Approval` | Staff “Push to Admin” | Locked for staff; admin can edit and send. |
| `Sent` | Admin “Push to Customer” (+ `sendQuotationToCustomer`) | Customer-facing; action buttons shown in portal. |
| `Approved` | Customer approve or `adminMarkQuotationApprovedAction` | Costs locked; order can advance. |
| `Rejected` | Customer decline / revision request | UI shows “Sent for Revision”; portal blocks actions until re-sent. |

There is no separate `Negotiation` DB status. The portal maps `Rejected` to the label “Sent for Revision”.

### End-to-end flow

```
Site visit approved → order.stage = Quotation In Progress (workflow-dependent)
        ↓
Staff opens Quotation tab (QuotationModule)
        ↓
Sections auto-created from site_visit_measurements (or saved signage_options)
        ↓
Products selected → rates/measurements filled (client-side calc)
        ↓
[Optional] Staff → Push to Admin (status = Pending Approval)
        ↓
Admin reviews → Request Changes (→ Draft) OR Push to Customer
        (Admin Draft → Submit for Review → Pending Approval first; cannot skip review)
        ↓
upsertQuotation (save) + sendQuotationToCustomer (status → Sent)
        ↓
orders.stage = Quotation Sent + timeline + WhatsApp notification
        ↓
Customer portal: Approve OR Decline/Revise
        ↓
Approve: quotations.status = Approved, orders.stage = Quotation Approved
Decline: quotations.status = Rejected (+ rejection_reason), orders.stage = Quotation Negotiation
        ↓
Staff revises → re-send → cycle repeats
        ↓
Admin/staff: Move to Design or Production (workflow_type + adminApproveStageAction)
```

**Note:** A `quotations` row is **not** auto-created when the order enters `Quotation In Progress`. It is created on the first `upsertQuotation` call.

## Workflow States

### Quotation `status` transitions

| From | Action | To |
|------|--------|-----|
| — | First save | `Draft` |
| `Draft` | Staff Push to Admin | `Pending Approval` |
| `Draft` | Admin Submit for Review | `Pending Approval` |
| `Pending Approval` | Admin Request Changes | `Draft` |
| `Pending Approval` / `Rejected` | Admin Push to Customer (`sendQuotationToCustomer`) | `Sent` |
| `Sent` | Customer approve | `Approved` |
| `Sent` | Customer decline | `Rejected` |
| `Rejected` | Admin re-send | `Sent` |
| Any (admin override) | `adminMarkQuotationApprovedAction` | `Approved` |

### Order `stage` mutations (quotation-related server actions)

| Trigger | `orders.stage` after |
|---------|----------------------|
| `sendQuotationToCustomer` | `Quotation Sent` |
| Customer approve (portal) | `Quotation Approved` |
| Customer decline (portal) | `Quotation Negotiation` |
| `adminMarkQuotationApprovedAction` | `Quotation Approved` |
| `adminApproveStageAction` (from quotation stages) | Next stage per workflow map |

## Business Rules

1. **One quotation per order** — `upsertQuotation` upserts by `order_id` (`maybeSingle`).
2. **Friendly ID** — `QT-NNN` per tenant (`company_id`); assigned on insert by DB trigger `generate_quotation_id()` (unique on `(company_id, quotation_id)`). Application does not generate IDs.
3. **Pricing types** — `per_unit` or `per_sqft` only (running feet removed).
4. **Qty / measurement** — Single field; `quantity` and `totalSqFt` kept in sync. Formula: `amount = measurement × unitPrice` (`lineAmount.ts`).
5. **Legacy lines** — If `quantity === 1` and `totalSqFt > 1`, measurement is read from `totalSqFt`.
6. **GST** — Per line item (0, 5, 12, 18, 28). Section totals show line amount **including** GST.
7. **Discount** — Flat ₹ amount subtracted from subtotal before grand total. Tax is reduced proportionally: `tax = totalGst × (1 - discount/subtotal)` when `subtotal > 0`.
8. **Shipping** — Optional flat ₹ added after discount and tax.
9. **Grand total** — `round((subtotal - discount + tax + shipping) × 100) / 100`.
10. **Site measurements** — Section headers show `formatSiteMeasurementLabel()` from linked `site_visit_measurements`. Product select pre-fills measurement as `width × height` when both exist.
11. **Staff lock** — Staff cannot edit when status is `Sent`, `Approved`, or `Pending Approval`.
12. **Admin lock** — Admin cannot edit when status is `Sent` or `Approved`; **can** edit when `Pending Approval`, `Draft`, or `Rejected`.
13. **Admin review gate** — Admin **cannot Push to Customer** from `Draft`. Admin must **Submit for Review** (`Draft` → `Pending Approval`) or receive staff submission first. **Push to Customer** is only enabled when status is `Pending Approval` or `Rejected` (`assertCanSendQuotationToCustomer`).
14. **Customer visibility** — Both portal routes (`PortalClient`, `OrderDetailClient`) use `isQuotationVisibleToCustomer` / `getCustomerVisibleQuotationForOrder`. Only `Sent`, `Approved`, and `Rejected` are shown; `Draft` and `Pending Approval` render a “being prepared” state with no line items or action buttons.
15. **Customer actions** — Approve/decline buttons only when `status === "Sent"`. Mutations go through `customerApproveQuotation` / `customerRequestRevision` server actions (portal session + service role), not direct Supabase client updates.
16. **Workflow fork** — `quote_first`: Quotation → Design → Production. `design_first`: Design → Quotation → Production.
17. **Advance without customer** — Admin **Approve without Customer & Advance** (when `status === "Sent"`) calls `adminMarkQuotationApprovedAction` then stage advance. Separate from **Move to Design/Production**.
18. **Stage advance (symmetric)** — Staff and admin **Move to Design/Production** both require quotation `status === "Approved"` **and** order `stage === "Quotation Approved"`.
19. **WhatsApp on send** — `sendQuotationToCustomer` dispatches `quotation_ready` on first send; `revised_quotation_ready` only when resending from `Rejected`. Actor name from `currentUserName` in `QuotationModule`.
20. **Upsert status guard** — `Approved` and `Rejected` cannot be set via `upsertQuotation`; use workflow actions (`customerApproveQuotation`, `customerRequestRevision`, `adminMarkQuotationApprovedAction`, `sendQuotationToCustomer`).
21. **Confirm before push** — `QuotationConfirmModal` shown before staff Push to Admin or admin Push to Customer.

## User Permissions

### Admin
- Full quotation stage edit (`resolveStagePermission("quotation")` → `canEdit`).
- **Submit for Review** (`Draft` → `Pending Approval`), **Request Changes** (`Pending Approval` → `Draft`), **Push to Customer** (only from `Pending Approval` or `Rejected`).
- **Approve without Customer & Advance** when `Sent`; **Move to Design/Production** when `Approved` + `Quotation Approved`.
- `adminMarkQuotationApprovedAction` override.

### Staff (Employee)
- Edit quotation if `staff_role` grant includes `quotation` (default: **Marketer** via `STAGE_GRANTS_BY_STAFF_ROLE`).
- Save Draft, Push to Admin.
- Cannot Push to Customer.
- Locked when `Pending Approval`, `Sent`, or `Approved`.

### Customer (portal)
- Read quotation via SSR (`getCustomerVisibleQuotationForOrder` with service role after token validation). No anon RLS on `quotations`.
- Approve or decline when `status === "Sent"` via `useQuotationActions` → `customerApproveQuotation` / `customerRequestRevision`.
- Cannot modify line items or financial fields.
- Approve sets `status = "Approved"`, `customer_response = "Yes"`, `orders.stage = "Quotation Approved"`, and timeline entry.
- Decline sets `status = "Rejected"`, `customer_response = "Revision"`, `rejection_reason`, `orders.stage = "Quotation Negotiation"`, and timeline entry.

## Database Tables

### `quotations`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `quotation_id` | text | Friendly `QT-NNN`; unique per `(company_id, quotation_id)` |
| `order_id` | uuid FK → `orders.id` | One row per order |
| `company_id` | uuid FK → `companies.id` | Required on insert |
| `customer_id` | uuid FK → `customers.id` | Auto-filled from order if omitted |
| `status` | text | `Draft`, `Pending Approval`, `Sent`, `Approved`, `Rejected` |
| `signage_options` | jsonb | Array of sections with `lines` (see below) |
| `subtotal` | numeric | Pre-discount sum of line amounts (ex-GST) |
| `discount` | numeric | Flat ₹ discount |
| `tax` | numeric | GST total after proportional discount |
| `shipping` | numeric | Flat ₹ shipping |
| `grand_total` | numeric | Final payable |
| `notes` | text | Customer-facing notes |
| `terms` | text | Terms & conditions |
| `rejection_reason` | text | Set on customer decline (`PortalClient`); not always set in `OrderDetailClient` |
| `admin_approved_at` | timestamptz | Set by `sendQuotationToCustomer` |
| `admin_approved_by` | text | Actor name passed to `sendQuotationToCustomer` |
| `customer_response` | text | `Yes`, `Revision`, or `Admin` on approve/decline/override |
| `created_at` | timestamptz | |

**Dropped columns (migrations):** `items`, `customer_name`, `valid_until`, `payment_status`, advance payment columns, `advance_paid`.

### Related tables

| Table | Role |
|-------|------|
| `orders` | `stage`, `stage_status`, `workflow_type` |
| `site_visits` | Parent for measurements |
| `site_visit_measurements` | Drives quotation sections |
| `products` | Catalogue pricing |
| `order_activity` | Timeline entries |
| `payments` | Reads `quotations.grand_total` for balance summary |

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
        "notes": "optional line note"
      }
    ]
  }
]
```

## Quotation Data Structure (TypeScript)

- Runtime shape in UI: `SignageSection[]` inside `signage_options` (`QuotationModule`, portal clients).

## Pricing Logic

1. Resolve product pricing via `resolveInitialPricing()` — maps `products.pricing_type` strings to `per_sqft` or `per_unit`.
2. `unitPrice` from `price_per_sqft` or `price_per_unit`.
3. `calcLineAmount(line) = getLineMeasurement(line) × unitPrice`.
4. Line display total (incl. GST) = `calcLineAmount × (1 + gstRate/100)`.

## Calculation Rules

```
subtotal = Σ sections Σ lines calcLineAmount(line)
totalGst = Σ sections Σ lines calcLineAmount(line) × (gstRate/100)
tax      = subtotal > 0 ? round(totalGst × (1 - discount/subtotal) × 100) / 100 : 0
grandTotal = round((subtotal - discount + tax + shipping) × 100) / 100
```

Calculations run **client-side** in `QuotationModule` for live preview; **`upsertQuotation` recomputes** `subtotal`, `tax`, `discount`, `shipping`, and `grand_total` server-side via `computeQuotationTotals()` (discount clamped to `[0, subtotal]`).

## Discount Rules

- Flat currency amount (₹), not percentage.
- Reduces taxable base proportionally (all line GST rates scaled by same factor).
- Optional; hidden until “+ Discount” clicked.

## Tax Rules

- Per-line GST rate (dropdown: 0, 5, 12, 18, 28).
- No IGST/CGST split; single GST total stored in `tax`.
- New lines default GST from `taxPercent` state (derived from saved `tax/subtotal` on load, default 18%).

## Server Actions

| Action | File | Auth | Behavior |
|--------|------|------|----------|
| `getQuotationByOrderId` | `quotationActions.ts` | Authenticated staff | Read single row |
| `getCustomerVisibleQuotationForOrder` | `quotationActions.ts` | Portal SSR (caller validates token) | Customer-visible quotation only |
| `getSiteVisitMeasurementsForOrder` | `quotationActions.ts` | Authenticated staff | Maps measurements to camelCase |
| `upsertQuotation` | `quotationActions.ts` | `assertStageEditPermission("quotation")` | Insert/update by `order_id`; server recomputes totals; `assertUpsertStatusTransition` |
| `sendQuotationToCustomer` | `quotationActions.ts` | Stage edit | Requires `Pending Approval` or `Rejected`; sets `status=Sent`, `orders.stage=Quotation Sent`, activity, WhatsApp |
| `adminMarkQuotationApprovedAction` | `quotationActions.ts` | Stage edit | Force `Approved` + `Quotation Approved` |
| `customerApproveQuotation` | `quotationActions.ts` | Portal session + service role | Customer approve when `status=Sent` |
| `customerRequestRevision` | `quotationActions.ts` | Portal session + service role | Customer decline when `status=Sent` |

Related order actions (`orderActions.ts`):
- `requestStageAdvancementAction` — sets `stage_status` for admin approval queue.
- `adminApproveStageAction` — advances `orders.stage` along workflow map.
- `setWorkflowTypeAction` — sets `quote_first` / `design_first` and first post-site-visit stage.
- `revalidateOrderPathsAction` — scoped portal revalidation after customer mutations.

Path revalidation helpers (non–server-action module `revalidateOrderPaths.ts`):
- `revalidateOrderDetailPaths` — admin/staff order detail + portal order page.
- `revalidateStaffOrderDetailPaths` — staff/admin order detail only (quotation saves).

## UI Components

| Component | Location | Audience |
|-----------|----------|----------|
| `QuotationModule` | `src/features/orders/workspace/modules/quotation/QuotationModule.tsx` | Admin / Staff |
| `QuotationTab` | `src/app/portal/components/QuotationTab.tsx` | Customer (shared by both portal routes) |
| `useQuotationActions` | `src/app/portal/hooks/useQuotationActions.ts` | Customer approve/decline |
| `usePortalOrderRealtime` | `src/app/portal/hooks/usePortalOrderRealtime.ts` | Customer order/quotation realtime |
| `PortalClient` | `src/app/portal/PortalClient.tsx` | Customer (multi-order) |
| `OrderDetailClient` | `src/app/portal/order/[orderId]/OrderDetailClient.tsx` | Customer (single order) |
| `ProductionModule` | reads `quotation.signage_options` | Staff |
| `OrderWorksheetModal` | embeds `QuotationModule`, owns quotations realtime channel | Admin / Staff |

`QuotationModule` extracted subcomponents (in progress): `components/QuotationConfirmModal.tsx`, `components/ProductInfoModal.tsx` (+ `types.ts`). Main module still contains inline modal fallbacks.

**Portal approve CTA copy:** `QuotationTab` respects `workflow_type` (`design_first` → “proceed to Production”; `quote_first` → “proceed to Design”).

Footer actions render via portal to `#modal-footer-portal` when mounted.

## File Structure

```
src/features/quotations/
  actions/quotationActions.ts
  utils/lineAmount.ts          # calcLineAmount, computeQuotationTotals, isQuotationVisibleToCustomer
  utils/quotationSecurity.ts   # status guards, sanitizeSignageOptions, toCustomerVisibleQuotation
src/features/orders/actions/
  orderActions.ts
  revalidateOrderPaths.ts      # sync revalidatePath helpers (not a server-action module)
src/features/orders/workspace/modules/quotation/
  QuotationModule.tsx
  quotationModuleHelpers.ts
  applyQuotationRealtime.ts
  types.ts
  components/
    QuotationConfirmModal.tsx
    ProductInfoModal.tsx
src/features/orders/workspace/shared/
  stageGrants.ts, permissions.ts, serverPermissions.ts, registry.tsx
src/features/order-detail/components/OrderWorksheetModal.tsx
src/app/admin/(dashboard)/orders/[id]/page.tsx
src/app/staff/(dashboard)/orders/[id]/page.tsx
src/app/portal/page.tsx
src/app/portal/PortalClient.tsx
src/app/portal/components/QuotationTab.tsx
src/app/portal/hooks/useQuotationActions.ts
src/app/portal/hooks/usePortalOrderRealtime.ts
src/app/portal/order/[orderId]/page.tsx
src/app/portal/order/[orderId]/OrderDetailClient.tsx
src/types/index.ts
supabase/migrations/*quotation*
```

## Data Flow

```
[Server] page.tsx loads getQuotationByOrderId + getSiteVisitMeasurementsForOrder
    ↓
[Client] QuotationModule state (sections, discount, shipping, notes, terms)
    ↓ calc on change
[Client] upsertQuotation(orderId, payload)  — server action
    ↓
[DB] quotations upsert + revalidatePath
    ↓
[Realtime] supabase channel on quotations (staff UI sync)
    ↓
[Admin] sendQuotationToCustomer(quotationUuid, adminName)
    ↓
[DB] quotations + orders + order_activity + WhatsApp
    ↓
[Portal SSR] getCustomerVisibleQuotationForOrder (null until Sent)
    ↓
[Portal] customerApproveQuotation / customerRequestRevision via useQuotationActions
    ↓
[DB] service role update + order_activity + revalidateOrderPathsAction
```

## Timeline Events

| `metadata.action` | Content pattern |
|-------------------|-----------------|
| `quotation_sent` | Quotation QT-NNN approved by {name} and sent to customer |
| `quotation_approved_by_admin` | Admin marked quotation approved |
| `quotation_approved_by_customer` | {name} approved / Client approved |
| `quotation_revision_requested` | Revision Requested: {notes} (server action only) |
| `quotation_declined` | Quotation Declined. Feedback: {notes} (portal) |
| `stage_approved` | Admin approved stage progression (includes quotation → next) |

## Validation Rules

**Client (`QuotationModule`):**
- Measurement input min 0.01; blur resets to 1 if ≤ 0.
- Push to Admin / Push to Customer disabled if `sections.length === 0`.
- No validation that `grand_total > 0` or descriptions non-empty.

**Server (`upsertQuotation`):**
- `assertStageEditPermission("quotation")`.
- `assertValidQuotationStatus`, `assertUpsertStatusTransition` (blocks `Approved`/`Rejected` via save).
- `sanitizeSignageOptions` (array bounds: ≤100 sections, ≤200 lines/section).
- `computeQuotationTotals` — server-authoritative financial fields (discount clamped).
- `company_id` required on insert.

**Portal:**
- Decline requires non-empty feedback text.

## Error Handling

- Server actions throw `Error(message)` on Supabase failures.
- UI shows inline `saveMsg` banner (success/error).
- `getQuotationByOrderId` failures on order pages are caught → `null` initial quotation.

## Security Rules

**Authenticated staff/admin:**
- RLS: `quotations` rows scoped to `company_id = current_company_id()`.
- Mutations gated by `assertStageEditPermission("quotation")`.

**Customer portal:**
- Page routes verify portal token + `orders.customer_id` match.
- SSR reads via service role + `toCustomerVisibleQuotation` (only `Sent`/`Approved`/`Rejected`).
- Mutations: `customerApproveQuotation` / `customerRequestRevision` validate portal session ownership, then use service role with `status = 'Sent'` guard.
- **No anon RLS** on `quotations` (migration `20260706130000_quotation_revoke_anon_access.sql`). Authenticated staff use company-scoped policy from `20260704000011_tenant_isolation_rls.sql`.

## Edge Cases

1. **No site visit measurements** — Single “General Signage” section with empty line, or restored `signage_options` only.
2. **Manual line items** — Description/rate without `productId`.
3. **Re-send after rejection** — Admin edits when `Rejected` (unlocked), re-pushes via Push to Customer. WhatsApp uses `revised_quotation_ready` when prior status was `Rejected`.
4. **Admin skip customer** — **Approve without Customer & Advance** when `Sent` via `adminMarkQuotationApprovedAction` + stage advance.
5. **Legacy `items` JSON** — `QuotationTab` still renders flat `items[]` if no `signage_options` (historical rows only).
6. **design_first** — Portal approve CTA: “proceed to Production” instead of Design.
7. **Customer name field** — Editable in `QuotationModule` but **not persisted** (display only).
8. **`order_activity.order_id`** — Uses friendly `order_id` string (e.g. `A002-001`) consistently in server actions.
9. **Placeholder quote ID** — Before first save, UI shows derived placeholder; real `QT-NNN` assigned on insert by DB trigger.
10. **Realtime** — Staff: `OrderWorksheetModal` owns quotations channel; `QuotationModule` accepts `externalRealtime`. Portal: `usePortalOrderRealtime` on orders/quotations.
11. **Discount > subtotal** — Server clamps discount to `subtotal` in `computeQuotationTotals`.
12. **Saving Rejected status** — Cannot set `Rejected` via `upsertQuotation`; customer decline must use `customerRequestRevision`.

## Future Improvements

- Finish `QuotationModule` extraction (section builder grid, remove inline modal duplicates).
- Register local migrations in remote `supabase_migrations` history (DB state already matches).
- Consolidate `getAllQuotations` removal — list views use order-scoped queries only.

## Change Log

| Version | Date | Summary |
|---------|------|---------|
| 1.0 | 2026-07-03 | Initial specification |
| 1.1 | 2026-07-04 | Unified qty/measurement; removed running feet; site measurement units |
| 2.0 | 2026-07-06 | Full audit rewrite: Pending Approval workflow, shipping, admin/customer paths, actual server actions, security notes, dead code, calculation formulas |
| 2.1 | 2026-07-06 | Audit pass 2: admin Draft bypass, portal Pending Approval visibility, portal mutation gaps, WhatsApp template rules, stage-advance preconditions, OrderDetailClient gaps |
| 2.2 | 2026-07-07 | Security & logic fixes: server-side `computeQuotationTotals`, portal server actions (no anon RLS), unified `QuotationTab` + hooks, admin review gate (no Draft→Sent skip), symmetric stage advance, scoped `revalidateOrderPaths`, `quotationSecurity.ts`, DB trigger IDs, WhatsApp `revised_quotation_ready` on rejection resend |
