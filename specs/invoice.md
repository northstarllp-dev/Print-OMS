# Invoice Feature Specification

> **Source of truth:** Implementation in the PrintOMS codebase as of 2026-07-28.

---

## Overview

Invoices are tax documents created automatically when a quotation is **Approved**. Staff and admin edit, send, and print them from a dedicated **Invoices** nav section (Zoho Books–style list + builder). Customers see issued invoices read-only in the portal with Print / Save as PDF.

Payments remain keyed off approved quotation totals in v1; invoices do not replace the payments module.

---

## Business Goal

- Auto-create a draft tax invoice when a quotation is approved (customer or admin).
- Give staff/admin a standalone list and editable builder with configurable invoice numbers (never UUIDs).
- Let customers download a printable invoice PDF once staff marks it **Sent**.
- Gate access with an `invoice` RBAC grant, configured like `quotation`.

---

## Workflow

```
Quotation → Approved (customer or admin)
        ↓
ensureDraftInvoiceFromQuotation → invoices row status = Draft (idempotent, one per order)
        ↓
Staff/Admin opens Invoices list → builder (edit lines, dates, notes/terms)
        ↓
Send to Customer → status = Sent (visible on portal)
        ↓
Optional: Mark Paid | Void
```

### Invoice `status`

| Status | Meaning |
|--------|---------|
| `Draft` | Auto-created / internal editing. Hidden from portal PDF. |
| `Sent` | Issued to customer; portal shows document + print. |
| `Paid` | Marked paid by staff/admin; still portal-visible. Locked for edits. |
| `Void` | Cancelled. Locked. Not portal-visible. |

### Invoice numbers (configurable, per company)

Configured in Admin → Settings → **Invoice Number** (`app_settings.invoice_numbering` for the logged-in user's `company_id`):

| Field | Purpose | Example |
|-------|---------|---------|
| Prefix | Leading label | `INV`, `PRT/INV` |
| Separator | Between parts | `-` or `/` |
| Year segment | `calendar` (2026) / `financial` (26-27) / `none` | |
| Starting number | First sequence in a period | `1001` |
| Digit padding | Zero-pad width | `4` → `0001` |
| Reset | `yearly` / `monthly` / `never` | |

Examples: `INV-2026-000001`, `INV/26-27/0001`, `PRT/INV/2026/00001`.

Allocation uses `allocate_invoice_sequence` + `invoice_number_sequences` (never UUIDs). Existing invoices keep their numbers; config applies to newly created drafts.

### Auto-create rules

- Triggered from `customerApproveQuotation` and `adminMarkQuotationApprovedAction`.
- Copies `signage_options`, totals, notes, terms, `company_id`, `customer_id` from the approved quotation.
- Skips insert if an invoice already exists for `order_id` (unique constraint).
- Friendly invoice number allocated via company numbering config (see above).

---

## RBAC

Grant key: `invoice` with `{ canView, canEdit }` in client `stageGrantsByRole` (same shape as quotation).

| Actor | Access |
|-------|--------|
| Admin | Full view + edit (all stages including invoice) |
| Marketer (default) | `invoice` edit (with quotation) |
| Designer (printoms / board co) | `invoice` edit when they also edit quotation |
| Other staff roles | No invoice nav unless granted |

Staff sidebar shows **Invoices** → `/staff/invoices` when `canEdit` for `invoice`.  
Admin sidebar always shows **Invoices** → `/admin/invoices`.

Server mutations call `assertStageEditPermission("invoice")`. List requires view or edit.

---

## Data model (`public.invoices`)

| Column | Notes |
|--------|-------|
| `id` | uuid PK |
| `invoice_id` | `INV-NNN` via trigger |
| `order_id` | FK → orders, **UNIQUE** (one invoice per order) |
| `quotation_row_id` | FK → quotations.id (source) |
| `company_id`, `customer_id` | Tenant + customer |
| `status` | Draft / Sent / Paid / Void |
| `signage_options` | jsonb sections + lines (same shape as quotations) |
| `subtotal`, `discount`, `tax`, `shipping`, `grand_total` | Server-recomputed on upsert |
| `notes`, `terms` | text |
| `invoice_date`, `due_date` | date |

RLS: company-scoped for `authenticated` (same pattern as quotations).

---

## Surfaces

| Surface | Path / component |
|---------|------------------|
| Admin list | `/admin/invoices` → `InvoiceListClient` |
| Admin builder | `/admin/invoices/[id]` → `InvoiceBuilder` |
| Staff list | `/staff/invoices` |
| Staff builder | `/staff/invoices/[id]` |
| Portal | Order detail **Invoice** tab (was Billing stub) → `InvoiceTab` |
| PDF | `InvoiceDocument` (wraps `QuotationDocument` with INVOICE labels) + browser print |

Portal visibility: statuses `Sent` and `Paid` only. Draft shows “being prepared” empty state.

---

## Key files

- Migration: `supabase/migrations/20260728120000_create_invoices.sql`
- Actions: `src/features/invoices/actions/invoiceActions.ts`
- Auto-create: `src/features/invoices/lib/ensureDraftInvoice.ts`
- Security: `src/features/invoices/utils/invoiceSecurity.ts`
- UI: `InvoiceListClient`, `InvoiceBuilder`, `InvoiceDocument`
- Portal: `src/app/portal/components/InvoiceTab.tsx`

---

## Out of scope (v1)

- Multiple invoices per order / partial invoices
- WhatsApp notification on invoice send
- Linking payments installments to invoice rows
- Standalone create-without-quotation flow
