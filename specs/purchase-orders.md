# Purchase Order Management Specification

## Overview

- Purpose: manage vendor purchases that feed inventory from purchase request through PO, goods receipt, and payment.
- Company-scoped via RLS; applied on PrintOMS-dev-db and PrintOMS-prod-db.

## Workflow

```
Low Stock → Purchase Request → Manager Approval → PO Created
  → Vendor → Material Received → Inventory Updated
  → Payment Pending → Payment Completed
```

## Statuses

- PO status (`doc_type=order`): `Draft | Sent | Approved | Partially Received | Received | Cancelled | Closed`
- PO payment status: `Pending | Partially Paid | Paid`
- Purchase request status (`doc_type=request`): `Pending | Approved | Rejected | Converted`

## Vendor management

- `vendors`: name, GSTIN, address, phone, email, rating (0–5), notes, active flag.

## Purchase documents (`purchase_orders`)

- `doc_type`: `order` | `request` (requests and POs share one table).
- `po_number` auto-generated for orders only (`PO-0001`).
- Lines and receipts stored as jsonb (`lines`, `receipts`) on the PO row.
- Optional soft link `request_id` when converting a request to a PO.

## Goods receipt

- **Receive** appends to `receipts` jsonb, bumps `qty_received` in `lines`, writes `purchase` stock movements, advances status.

## Payments link

- PO payment status syncs into `finance_entries` (`entry_type=payment`) via `syncFinance.ts`.

## Database

### Tables

- `vendors`
- `purchase_orders` (with `doc_type`, `lines`, `receipts` jsonb)

### Migrations

- `supabase/migrations/20260730190000_create_purchase_orders.sql`
- `supabase/migrations/20260730210000_consolidate_module_tables.sql`

## Change Log

| Version | Date | Summary |
| ------- | ---- | ------- |
| 1.1 | 2026-07-30 | Folded requests/lines/receipts into `purchase_orders` jsonb |
| 1.0 | 2026-07-30 | Initial implementation |
