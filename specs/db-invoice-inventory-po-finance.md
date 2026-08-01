# Database reference: Invoice, Inventory, Purchase Orders, Finance

Tables and operations used by each admin section for **view** (read) and **edit** (write).  
Consolidated schema after `20260730210000_consolidate_module_tables.sql`.

---

## Summary matrix

| Section | Primary tables | Also reads | Also writes |
| --- | --- | --- | --- |
| **Invoice** | `invoices` | `orders`, `customers`, `quotations`, `app_settings`, `products` | `invoice_number_sequences` (RPC), `order_activity`, `app_settings` (settings UI) |
| **Inventory** | `warehouses`, `stock_balances`, `stock_movements` | `products`, `orders` | `products.min_stock`, `orders.material_cost` |
| **Purchase Orders** | `vendors`, `purchase_orders` | `products`, `warehouses` | `stock_*` (on receive), `finance_entries` (PO payment sync), `products` (PDF confirm) |
| **Finance** | `finance_entries` | `invoices`, `payments`, `orders`, `customers`, `vendors`, `purchase_orders` | `invoices.invoice_type`, `purchase_orders.payment_status` |

---

## 1. Invoice

**Routes:** `/admin/invoices`, `/staff/invoices`, portal Invoice tab  
**Code:** `src/features/invoices/`  
**Spec:** `specs/invoice.md`

### Tables

| Table | Purpose |
| --- | --- |
| `invoices` | Invoice document (lines, totals, status, type) |
| `orders` | Order link / list display |
| `customers` | Bill-to name and address |
| `quotations` | Source when auto-creating draft on quote approve |
| `app_settings` | `invoice_profile` (letterhead), `invoice_numbering` |
| `invoice_number_sequences` | Period sequence counters (via `allocate_invoice_sequence` RPC) |
| `order_activity` | Timeline on create / send / void / paid |
| `products` | Line-item picker in builder |

### View (READ)

| Table | What is read |
| --- | --- |
| `invoices` | List, get by id, get by order; status, type, lines (`signage_options`), totals, dates, notes/terms |
| `orders` | `order_id`, `business_name`, `client_name` (joins) |
| `customers` | `name`, `billing_address`, `city` |
| `app_settings` | `invoice_profile` for print/PDF |
| `products` | Active catalog for editor line picker |
| `quotations` | Lines/totals when ensuring draft exists |

### Edit (WRITE)

| Table | Operations |
| --- | --- |
| `invoices` | **INSERT** draft from quotation; **UPDATE** lines/totals/notes/dates (Draft/Sent); status → Sent / Paid / Void; regenerate `invoice_id`; set `invoice_type`; convert proforma |
| `invoice_number_sequences` | Upsert via RPC on allocate / regenerate / proforma convert |
| `order_activity` | Insert on auto-create, send, void, mark paid |
| `app_settings` | Update `invoice_profile` / `invoice_numbering` (Settings UI, not builder) |

No DELETE of invoice rows in feature code.

### Key `invoices` columns

`id`, `invoice_id`, `order_id`, `quotation_row_id`, `company_id`, `customer_id`, `status` (Draft / Sent / Paid / Void), `invoice_type`, `signage_options` (jsonb), `subtotal`, `discount`, `tax`, `shipping`, `grand_total`, `notes`, `terms`, `invoice_date`, `due_date`, `created_at`, `updated_at`

---

## 2. Inventory

**Routes:** `/admin/inventory` (+ production materials panel on orders)  
**Code:** `src/features/inventory/`  
**Spec:** `specs/inventory.md`

### Tables

| Table | Purpose |
| --- | --- |
| `warehouses` | Locations (`main`, `production_floor`, `vehicle`, `branch`) |
| `stock_balances` | Qty per company + product + warehouse |
| `stock_movements` | Immutable stock ledger (includes production consumption via `usage_kind`) |
| `products` | SKU master (track flag, min/max, barcode, purchase price) |
| `orders` | Material cost when consuming stock against an order |

**Dropped (do not use):** `order_material_consumptions` → folded into `stock_movements`.

### View (READ)

| Table | What is read |
| --- | --- |
| `warehouses` | List for overview, transfers, production |
| `stock_balances` | Current quantities |
| `stock_movements` | Ledger history + order consumptions |
| `products` | Overview, barcode lookup, production context |
| `orders` | Validate order when consuming / yielding |

### Edit (WRITE)

| Table | Operations |
| --- | --- |
| `warehouses` | Insert warehouse; update `is_active` |
| `stock_balances` | Upsert quantity via stock movement apply |
| `stock_movements` | **INSERT only** (immutable ledger) |
| `products` | Update `min_stock` from inventory UI |
| `orders` | Update `material_cost` on consume |

### Key columns

- **warehouses:** `id`, `company_id`, `code`, `name`, `kind`, `is_active`
- **stock_balances:** `company_id`, `product_id`, `warehouse_id`, `quantity`
- **stock_movements:** `direction` (`in`/`out`), `txn_type`, `quantity`, `balance_after`, `unit_cost`, `reference`, `order_id`, `usage_kind`, `actor_id`, `warehouse_id`, `product_id`
- **products (inventory-related):** `track_inventory`, `min_stock`, `max_stock`, `barcode`, `purchase_price`, `default_warehouse_id`

---

## 3. Purchase Orders

**Routes:** `/admin/purchase-orders`  
**Code:** `src/features/purchases/`  
**Spec:** `specs/purchase-orders.md`

### Tables

| Table | Purpose |
| --- | --- |
| `vendors` | Supplier master |
| `purchase_orders` | POs and purchase requests (`doc_type`: `order` \| `request`); lines + receipts as jsonb |
| `products` | Line labels, PDF parse/confirm, catalog picks |
| `warehouses` | Receive-into warehouse options |
| `stock_balances` / `stock_movements` | Side effect when receiving goods / reversing on PO delete |
| `finance_entries` | Sync/delete PO payment rows (`source_ref = po_payment:…`) |

**Dropped (do not use):** `purchase_requests`, `purchase_order_lines`, `purchase_receipts` → `purchase_orders.doc_type` / `.lines` / `.receipts`.

### View (READ)

| Table | What is read |
| --- | --- |
| `vendors` | Vendor list + outstanding derived from open POs |
| `purchase_orders` | Orders (`doc_type=order`) and requests (`doc_type=request`) |
| `products` | Line enrichment, PDF confirm |
| `warehouses` | Receive modal warehouse list |

### Edit (WRITE)

| Table | Operations |
| --- | --- |
| `vendors` | Insert / update vendor |
| `purchase_orders` | Insert/update status, lines, receipts, payment_status; delete PO |
| `products` | Insert products / update `purchase_price` (PDF confirm flow) |
| `stock_balances` + `stock_movements` | Stock in on receive; reverse movements on PO delete |
| `finance_entries` | Sync payment entries from PO payment status; delete on PO delete |

### Key columns

- **vendors:** `name`, `gstin`, `address`, `phone`, `email`, `rating`, `notes`, `is_active`
- **purchase_orders:** `po_number`, `vendor_id`, `doc_type`, `status`, `payment_status`, `order_date`, `expected_date`, `subtotal`, `tax`, `grand_total`, `lines` (jsonb), `receipts` (jsonb), `request_id`, `requested_by`, `approved_by`, `attachments`
- **lines jsonb:** `id`, `product_id`, `qty_ordered`, `qty_received`, `unit_cost`, `tax_rate`
- **receipts jsonb:** `warehouse_id`, `lines[]`, `notes`, `received_by`, `received_at`

---

## 4. Finance

**Routes:** `/admin/finance`  
**Code:** `src/features/finance/`  
**Spec:** `specs/finance.md`

### Tables

| Table | Purpose |
| --- | --- |
| `finance_entries` | Unified ledger: `receipt` \| `payment` \| `expense` \| `other_income` |
| `invoices` | Receivables / GST / invoice type / proforma convert |
| `payments` | Order sales payments → synced receipts + revenue |
| `orders` | Sync context and form options |
| `customers` | Form options + receipt joins |
| `vendors` | Form options + payment joins |
| `purchase_orders` | Payables; mark Paid when finance payment Paid |

**Dropped (do not use):** `finance_receipts`, `finance_payments`, `finance_expenses`, `finance_other_income` → all in `finance_entries`.

### View (READ)

| Table | What is read |
| --- | --- |
| `finance_entries` | Lists by entry type; summary KPIs |
| `invoices` | Totals, types, form options |
| `payments` | Sync sources + revenue rollup |
| `orders` | Sync + picker options |
| `customers` / `vendors` | Joins and form options |
| `purchase_orders` | Payables and PO payment sync context |

### Edit (WRITE)

| Table | Operations |
| --- | --- |
| `finance_entries` | Insert/update entries (status, amount, links); sync from order/PO payments; delete via PO delete path |
| `invoices` | Update `invoice_type`; convert proforma → tax invoice |
| `purchase_orders` | Update `payment_status` when linked finance payment marked Paid |

Order `payments` rows are written by the **Payments** module; Finance syncs from them into `finance_entries`.

### Key `finance_entries` columns

`entry_type`, `entry_no`, `amount`, `gst_amount`, `category`, `mode`, `status`, `entry_date`, `due_date`, `paid_at`, `customer_id`, `order_id`, `invoice_id`, `vendor_id`, `po_id`, `payee`, `attachment_url`, `attachments`, `notes`, `source_ref` (`order_payment:…` / `po_payment:…`), `created_by`, `approved_by`

Also: `invoices.invoice_type` — `GST Invoice` | `Tax Invoice` | `Actual Invoice` | `Proforma Invoice` | `Credit Note` | `Debit Note`

---

## Cross-module write edges

```
Quotation Approved  →  invoices (draft)
PO Receive          →  stock_movements + stock_balances
PO payment status   →  finance_entries (sync)
Order payment       →  finance_entries (sync via payments module)
Finance mark Paid   →  purchase_orders.payment_status
Consume materials   →  stock_movements + orders.material_cost
```

---

## Migrations (schema source)

| Migration | Domain |
| --- | --- |
| `20260728120000_create_invoices.sql` | Invoices |
| `20260728140000_invoice_numbering_config.sql` | Sequences + numbering |
| `20260714130000_app_settings_invoice_profile.sql` | Invoice profile |
| `20260730180000_create_inventory.sql` | Inventory |
| `20260730190000_create_purchase_orders.sql` | Vendors + POs |
| `20260730200000_create_finance.sql` | Finance + invoice_type |
| `20260730210000_consolidate_module_tables.sql` | Collapse split tables → live model |
| `20260730220000_finance_entries_source_ref.sql` | Sync idempotency |
