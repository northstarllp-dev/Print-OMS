# Finance Module Specification

## Overview

- Purpose: full accounting layer on top of orders/invoices incoming receipts, outgoing payments, expenses, other income, and a profit/cash dashboard.
- Extends the existing invoices module (`specs/invoice.md`) rather than replacing it.
- Company-scoped via RLS; applied on PrintOMS-dev-db and PrintOMS-prod-db.

## A. Invoice types

`invoices.invoice_type` (default `Tax Invoice`):

- GST Invoice | Tax Invoice | Actual Invoice | Proforma Invoice | Credit Note | Debit Note

Type is selectable from the invoice builder header. Existing statuses remain `Draft | Sent | Paid | Void` (Void maps to Cancelled; Overdue is derived from `due_date`).

## B. Proforma

- Proforma invoices are **excluded from accounts totals** (revenue, receivables, GST output).
- One-click **Convert to Invoice** in the builder: switches type to Tax Invoice, resets status to Draft, and allocates a fresh invoice number via the existing numbering config.

## C. Unified ledger (`finance_entries`)

Single table with `entry_type`:

| entry_type | UI label | Key fields |
| --- | --- | --- |
| `receipt` | Sales Income | `entry_no` (`RCP-0001`), customer / order / invoice, mode, `entry_date` |
| `payment` | PO Purchase / outgoing | category, payee/vendor, optional `po_id`, amount + GST, due date, status |
| `expense` | Expenses | category, `entry_date`, amount + GST, attachment |
| `other_income` | Other income | category, `entry_date`, amount |

Order payment receipts and PO payment status sync into this table via `syncFinance.ts`.

## Finance dashboard (`/admin/finance`)

Tabs: **Overview**, **Receipts**, **Payments**, **Expenses**, **Other Income**, **Reports**.

## Database

### Tables / changes

- `invoices.invoice_type` column (+ check constraint)
- `finance_entries` (replaces `finance_receipts`, `finance_payments`, `finance_expenses`, `finance_other_income`)

### Migrations

- `supabase/migrations/20260730200000_create_finance.sql`
- `supabase/migrations/20260730210000_consolidate_module_tables.sql`

## File structure

```
src/features/finance/types.ts
src/features/finance/syncFinance.ts
src/features/finance/actions/financeActions.ts
src/features/finance/components/FinanceDashboard.tsx
src/app/admin/(dashboard)/finance/page.tsx
```

## Change Log

| Version | Date | Summary |
| ------- | ---- | ------- |
| 1.1 | 2026-07-30 | Consolidated four finance tables into `finance_entries` |
| 1.0 | 2026-07-30 | Initial implementation |
