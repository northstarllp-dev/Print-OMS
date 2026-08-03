# Payment Tracking Feature Specification

## Overview

* Purpose: Simple **financial tracking** for orders — expected amounts, amounts received, and outstanding balances.
* Payments are **not** workflow stages and **do not** block stage progression.
* All payment communication happens **outside** the OMS (phone, WhatsApp, bank transfer, UPI, cash, etc.).
* The OMS only **records** payment information.
* No payment gateway, UTR tracking, verification workflow, or stage locking.

## Core Principle

Payments are a visibility module only.

| Concern | Behavior |
| ------- | -------- |
| Stage progression | Unaffected by payments |
| Payment popup | **Removed** |
| Stage-wise payment settings | **Removed** |
| Verification / waive | **Removed** |
| Customer actions | View-only |

## Business workflow

Payments can be recorded at any time (advance after quote, after design, during production, final settlement, etc.).

1. Staff open the order header **Payment** tab.
2. Staff **Add Payment** (installment name, fixed / % / rest of amount). The "GST / Without GST" dropdown has been removed for simplicity.
3. Payments added are considered logged/received. The "Expected" button and status toggling have been removed.
4. Customer portal **Payments** tab shows the same records as information only.

## Payment statuses

| Status | Meaning |
| ------ | ------- |
| `expected` | Amount is expected but not yet received |
| `received` | Amount has been received |

## Amount types

| Type | Calculation |
| ---- | ----------- |
| `fixed` | `calculated_amount = amount` |
| `percentage` | `calculated_amount = quotation.grand_total × percentage / 100` |
| Rest of amount (UI) | Fixed amount = quotation total − sum of **received** payments |

Installment names auto-number: `1st installment`, `2nd installment`, …

## Database

### `payments`

| Column | Type | Notes |
| ------ | ---- | ----- |
| `id` | uuid PK | |
| `order_id` | uuid FK | ON DELETE CASCADE |
| `payment_name` | text | e.g. `1st installment` |
| `trigger_stage` | text | Optional note of order stage when recorded |
| `amount_type` | text | `fixed` \| `percentage` |
| `amount` / `percentage` / `calculated_amount` | numeric | |
| `status` | text | `expected` \| `received` |
| `notes` | text | Optional |
| `paid_at` | timestamptz | Set when marked received |
| `created_at` / `updated_at` | timestamptz | |

### Removed

* `payment_gate_stages` table (stage-wise popup config)
* `payment_notification_rules` table
* Gate columns on `payments` (`required_for_next_stage`, `payment_reference`, `verified_*`, etc.)
* Legacy checklist columns (`designs.payment_verified`, `quotations.advance_*`)
* `orders.stage_status = Pending Payment Verification` (cleared on migrate)
* Portal UPDATE policy on `payments` (view-only)

### Migrations

* `20260704000003_create_payments.sql` — original table
* `20260704000004_payments_portal_policies.sql` — portal read access
* `20260704000009_simplify_payments_tracking.sql` — statuses + drop gates
* `20260704000010_drop_unused_payment_columns.sql` — drop unused columns/tables

## Server actions

`src/features/payments/actions/paymentActions.ts`

| Action | Who | Behavior |
| ------ | --- | -------- |
| `createPayment` | Staff | Create expected (or received) record |
| `markPaymentReceived` | Staff | Mark received |
| `markPaymentExpected` | Staff | Revert to expected |
| `deletePayment` | Staff | Remove record |
| `updatePayment` | Staff | Edit name/amount/notes |
| `getPaymentsByOrder` | Staff / portal | List records |
| `getPaymentBalanceSummary` | Staff / portal | Quotation total, received, outstanding |

## UI

| Surface | Purpose |
| ------- | ------- |
| Order header **Payment** | Staff tracking: add, delete |
| Portal **Payments** tab | Customer read-only: totals + installment list |
| Quotation **Move to Design/Production** | Advances stage only (no payment popup) |

## Data flow

```
Staff: Add Payment → status = received, paid_at set
Customer: view totals and line items only
Stage advance: never checks payments
```

## Security

* Staff create/update/delete require authenticated session.
* Portal may read payments only.

## Removed logic

* PaymentRequiredModal (stage advance popup)
* Payment gate settings (`/admin/settings/payments` redirects away)
* `assertNoBlockingPayments` on stage transitions
* Verify / waive / UTR / mark-as-paid customer flow
* `Pending Payment Verification` locks and banners

## Admin Collections Dashboard (`/admin/payments`)

Company-wide payments overview powered by `getCompanyCollectionsData`.

### KPIs

| Chip | Value | Click action |
| ---- | ----- | ------------ |
| Collected | Sum of received amounts | Filter → paid |
| Outstanding | Sum of (quoted − received) where > 0 | Filter → outstanding |
| Expected | Sum of expected-status amounts | Filter → outstanding |
| Fully Paid | Count of orders with zero balance | Filter → paid |

### Aging buckets

Outstanding orders are bucketed by days since last activity (last payment `paid_at` or `order.created_at`, whichever is newer):

| Bucket | Filter chip |
| ------ | ----------- |
| 0–30 days | Current |
| 31–60 days | Overdue |
| 61–90 days | At risk |
| 90+ days | Critical |

### Inline Record Receipt

Admin can record a receipt directly from the collections row without navigating to the order. Modal fields: installment name (auto-numbered), amount type (fixed / % / rest), amount, notes. Calls `createPayment` with `status = received`.

### Invoice badge

When an invoice exists for an order, its status badge (Draft / Sent / Paid / Void) appears on the collections row with a link to `/admin/invoices/[id]`.

### CSV export

Download the filtered list as CSV: Order Code, Client, Stage, Quoted Total, Received, Outstanding, Aging Days, Last Paid Date.

## Future enhancements

* Optional payment gateway (out of scope)
* Export payment summary PDF

## File structure

```
src/features/payments/actions/paymentActions.ts
src/features/payments/utils/installmentName.ts
src/features/payments/components/PaymentsCollectionsClient.tsx
src/features/order-detail/components/payments/PaymentsModule.tsx
src/app/admin/(dashboard)/payments/page.tsx
src/app/portal/components/PaymentsTab.tsx
specs/payments.md
```

## Change Log

| Version | Date | Summary |
| ------- | ---- | ------- |
| 1.0–1.4 | 2026-07-04 | Gate-based payment workflow (superseded) |
| 2.0 | 2026-07-04 | Simplified to financial tracking only: expected / received, no gates or verification |
| 2.1 | 2026-07-29 | Admin collections dashboard: aging buckets, inline record receipt, CSV export, invoice badge |
