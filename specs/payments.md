# Payment Milestones Feature Specification

## Overview

* Purpose: Flexible payment milestones as **business gates** between order phases — not a pipeline stage.
* Business objective: Per-client installments (fixed amount, % of quotation, or remaining balance), optional or blocking, manual verification today, future Razorpay/PhonePe/Stripe without schema changes.
* User roles: Admin, Staff, Customer (portal)

## Core Principle

**Payments are not a workflow stage.**

| Field | Behavior |
| ----- | -------- |
| `orders.stage` | Unchanged when a payment gate is created |
| `orders.stage_status` | Set to `"Pending Payment Verification"` while a required payment is outstanding |

Example:

```
stage: Quotation Approved
stage_status: Pending Payment Verification
```

The order cannot advance until all payments with `required_for_next_stage = true` are `verified` or `waived`.

---

## End-to-end workflow

### 1. Admin configures when the payment popup appears

**Path:** Admin → Settings → Payment Gates → **Configure payment gate stages**  
(`/admin/settings/payments`)

Six checkboxes (per company / tenant). Popup only at the **end** of each phase:

| Checkbox | Popup when advancing from |
| -------- | ------------------------- |
| Site Visit | `Site Visit Completed` (also when audit is submitted for approval while stage is still Scheduled) |
| Quotation | `Quotation Approved` |
| Design | `Design Approved` |
| Production | `Ready For Installation` |
| Installation Scheduled | `Installation Scheduled` |
| Completed | `Completed` |

* **Checked:** show payment popup when leaving that phase.  
* **Unchecked:** advance with no popup.  
* Intermediate stages (e.g. Quotation Sent) never show the popup.

Settings are **per `company_id`** (multi-tenant).

### 2. Staff/Admin advances the order

Triggers:

* **Approve & Advance** (order footer / Admin Controls)
* **Move to Design / Move to Production** on an approved quotation (footer next to “Submitted & Locked”)
* After Site Visit approval: **Choose workflow** (Quote First / Design First), then payment popup if Site Visit gate is enabled

If the current phase is **not** enabled in Payment Gate Settings → advance immediately (no popup).

If **enabled** → open `PaymentRequiredModal`.

### 3. Payment popup (`PaymentRequiredModal`)

**Title:** “Do you need to collect a payment before continuing?”  
Shows current stage as subtitle.

**Step A — Yes / No only** (form not expanded yet)

| Choice | Result |
| ------ | ------ |
| **No** | Continue to next stage without creating a payment |
| **Yes** | Expand form to enter installment details |

**Step B — After Yes**

* **Payment name:** auto `1st installment`, `2nd installment`, … (editable)
* **Rest of the amount** (checkbox): amount = quotation `grand_total` − sum of **verified** payments
* Or **Percentage** / **Fixed** amount
* Creating a payment **always** blocks progression (`required_for_next_stage = true`, stage lock)

There is **no** separate “Required before next stage?” checkbox on the popup.

### 4. Order is locked (if payment created)

* `orders.stage` stays the same  
* `orders.stage_status` = `Pending Payment Verification`  
* Header **Payment** button shows a badge; banner links to Payments tab  

### 5. Customer pays (portal)

Portal **Payments** tab (loads from `payments` table):

* Totals: expected, outstanding, paid & verified  
* Each installment: name, amount expected, status  
* Customer enters UTR/reference → **Mark as Paid** (`status = paid`)  
* **Pay Online** is a placeholder for future gateways  

### 6. Admin verifies

Order header → **Payment** tab (`PaymentsModule`):

* **Verify** or **Waive**  
* When no blocking payments remain → `stage_status` = `Normal`  
* Staff/Admin advances again (Approve & Advance / Move to Design)

### 7. Manual installments

On the **Payment** tab, Admin can **Add Payment** anytime:

* Same installment naming (`Nth installment`)
* Percentage, fixed, or **Rest of the amount**
* Optional “Required before next stage” for manually added milestones only

---

## Payment statuses (`payments.status`)

| Status | Meaning |
| ------ | ------- |
| `pending` | Optional / not yet requested |
| `requested` | Customer should pay (blocking gate) |
| `paid` | Customer submitted reference; awaiting staff verification |
| `verified` | Staff confirmed receipt |
| `waived` | Staff waived requirement |

---

## Amount types

| Type | Calculation |
| ---- | ----------- |
| `fixed` | `calculated_amount = amount` |
| `percentage` | `calculated_amount = quotation.grand_total × percentage / 100` |
| Rest of amount (UI) | Stored as `fixed` where `amount = grand_total − sum(verified payments)` |

Helper: `getPaymentBalanceSummary(orderId)` → `{ grandTotal, paidTotal, remaining }`.

Installment names: `nextInstallmentName(existingCount)` → `"1st installment"`, `"2nd installment"`, …

---

## Database

### `payments`

| Column | Type | Notes |
| ------ | ---- | ----- |
| `id` | uuid PK | |
| `order_id` | uuid FK → `orders.id` | ON DELETE CASCADE |
| `payment_name` | text | e.g. `1st installment` |
| `trigger_stage` | text | Pipeline stage when gate was created |
| `amount_type` | text | `fixed` \| `percentage` |
| `amount` | numeric | Fixed amount |
| `percentage` | numeric | % of quotation total |
| `calculated_amount` | numeric | Amount to collect |
| `required_for_next_stage` | boolean | Blocks advance when true |
| `status` | text | See statuses above |
| `payment_method` | text | `manual` today; future gateways |
| `payment_reference` | text | UTR / gateway id |
| `notes` | text | |
| `requested_at` / `paid_at` / `verified_at` | timestamptz | |
| `verified_by` | uuid | |
| `created_at` / `updated_at` | timestamptz | |

Indexes: `order_id`, `status`, `trigger_stage`.

### `payment_gate_stages` (per company)

| Column | Type | Notes |
| ------ | ---- | ----- |
| `id` | uuid PK | |
| `company_id` | uuid FK → `companies.id` | **Required** (multi-tenant) |
| `stage` | text | Phase key (see below) |
| `is_enabled` | boolean | Show popup for that phase |
| `created_at` / `updated_at` | timestamptz | |

Unique: `(company_id, stage)`.

Phase keys:

| Key | Label |
| --- | ----- |
| `site_visit` | Site Visit |
| `quotation` | Quotation |
| `design` | Design |
| `production` | Production |
| `installation_scheduled` | Installation Scheduled |
| `installation_completed` | Completed |

### Related order fields

| Column | Role |
| ------ | ---- |
| `orders.stage` | Pipeline phase (never a “Payment” stage) |
| `orders.stage_status` | `Pending Payment Verification` while gates are open |

### Migrations

* `20260704000003_create_payments.sql`
* `20260704000004_payments_portal_policies.sql`
* `20260704000006_payment_gate_stages.sql`
* `20260704000007_payment_gate_phases.sql`
* `20260704000008_payment_gate_company_and_install_split.sql`

---

## Server actions

`src/features/payments/actions/paymentActions.ts`

| Action | Who | Behavior |
| ------ | --- | -------- |
| `createPaymentRequirement` | Staff | Create milestone; lock stage when required |
| `getPaymentBalanceSummary` | Staff | Quotation total − verified payments |
| `getPaymentsByOrder` | Portal / staff | List milestones |
| `markPaymentPaid` | Customer | `status = paid` only |
| `verifyPayment` / `waivePayment` | Staff | Clear gate; unlock when no blockers |
| `getBlockingPayments` / `assertNoBlockingPayments` | System | Block stage transitions |

`src/features/settings/actions/paymentGateSettingsActions.ts`

| Action | Behavior |
| ------ | -------- |
| `isPaymentGateEnabledForStage(stage, orderId?, stageStatus?)` | Whether popup should show |
| `listPaymentGateStages` | Admin settings list (current company) |
| `setPaymentGateStageEnabled` | Toggle phase for current company |

Stage transitions call `assertNoBlockingPayments` before changing `orders.stage`.

Site Visit note: completion is often approved while `stage` is still `Site Visit Scheduled` and `stage_status` is `Pending Admin Approval: Site Visit Completed`. Gate detection uses both `stage` and `stage_status`.

---

## UI map

| Surface | Location | Purpose |
| ------- | -------- | ------- |
| Payment gate settings | `/admin/settings/payments` | Phase checkboxes per company |
| Payment popup | `PaymentRequiredModal` | Yes/No then installment details |
| Order Payment tab | Header **Payment** (next to Admin Controls) | List / add / verify / waive |
| Quotation footer | After customer approval | **Move to Design** / **Move to Production** (same gate flow) |
| Portal Payments | Portal Payments tab | Expected amounts, submit reference |

Workflow choice modal (Quote First / Design First) does **not** mention payment; payment is asked only via the gate popup when configured.

---

## Data flows

### Create gate

```
Approve & Advance / Move to Design
  → isPaymentGateEnabledForStage? 
      No  → advance stage
      Yes → PaymentRequiredModal
            No  → advance stage
            Yes → expand form → createPaymentRequirement
                 → stage unchanged, stage_status = Pending Payment Verification
                 → open Payment tab
```

### Customer pay

```
Portal Payments tab
  → markPaymentPaid (status = paid)
```

### Unlock

```
Payment tab → verifyPayment / waivePayment
  → if no blockers: stage_status = Normal
  → Approve & Advance / Move to Design again
```

---

## Security

* Staff create/verify/waive require authenticated session (`requireStaffUser` / admin for settings).
* Portal may SELECT payments and UPDATE to `paid` only.
* `payment_gate_stages` RLS: admins manage their `company_id`; staff can read their company.

---

## Removed / legacy

* Quotation “Advance payment received / Move to Design” checklist — **removed**; use **Move to Design** + payment popup.
* Workflow cards “Design + Payment” / “PAYMENT HERE” — **removed**.
* Email/WhatsApp automated notification rules — **removed** (not part of this workflow).
* Popup “Required Before Next Stage?” checkbox — **removed**; Yes always creates a blocking payment.

---

## Future enhancements

* Razorpay / PhonePe / Stripe on portal Payments tab (`payment_method` + `payment_reference`)
* Webhooks calling `markPaymentPaid` / `verifyPayment`
* Invoice PDF linked to installments

---

## File structure

```
src/features/payments/actions/paymentActions.ts
src/features/payments/actions/paymentReporting.ts
src/features/payments/utils/installmentName.ts
src/features/settings/paymentGateStages.ts
src/features/settings/actions/paymentGateSettingsActions.ts
src/features/settings/components/PaymentGateSettings.tsx
src/features/order-detail/components/payments/PaymentsModule.tsx
src/features/order-detail/components/payments/PaymentRequiredModal.tsx
src/app/portal/components/PaymentsTab.tsx
src/app/admin/(dashboard)/settings/payments/page.tsx
src/types/index.ts
specs/payments.md
```

---

## Change Log

| Version | Date | Summary |
| ------- | ---- | ------- |
| 1.0 | 2026-07-04 | Payment milestones as gates via `stage_status` |
| 1.1 | 2026-07-04 | Admin payment gate settings; removed email/WhatsApp notification rules |
| 1.2 | 2026-07-04 | Phase-level gates; rest of amount |
| 1.3 | 2026-07-04 | Installation Scheduled / Completed separate; `company_id` on gate settings |
| 1.4 | 2026-07-04 | Full workflow doc: Yes/No-first popup, installment naming, Move to Design, site-visit status match |
