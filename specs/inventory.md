# Inventory & Warehouse Specification

## Overview

- Purpose: track stock for all catalog products (regular and Final Products) across multiple warehouses, with an immutable movement ledger and production material consumption.
- Products are the inventory master — every material exists once in `products`; stock is keyed by `products.id`.
- Company-scoped via RLS (`company_id = current_company_id()`); applied on PrintOMS-dev-db and PrintOMS-prod-db.

## Product inventory attributes

Added to `products`:

| Column | Type | Description |
| ------ | ---- | ----------- |
| unit | text | Base unit (pcs, sqft, kg, ...) |
| brand | text | Brand / make |
| supplier_name | text | Default supplier |
| purchase_price | numeric | Default cost price |
| min_stock | numeric | Low-stock threshold |
| max_stock | numeric | Overstock threshold |
| hsn_code | text | HSN for GST |
| gst_rate | numeric | Default GST % |
| barcode | text | Scanner-friendly code (indexed) |
| qr_code | text | Optional QR payload |
| default_warehouse_id | uuid | Default receive/issue warehouse |
| track_inventory | boolean | Excludes services etc. when false |

Selling price maps to existing `price_per_sqft` / `price_per_unit`.

## Warehouses

- `warehouses`: `code`, `name`, `kind` (`main` | `production_floor` | `vehicle` | `branch`), `is_active`.
- Main + Production Floor are seeded per company.
- Admin can create warehouses and toggle active state.

## Stock model

- `stock_balances` — one row per `(company_id, product_id, warehouse_id)`, holds current `quantity`.
- `stock_movements` — immutable ledger. Every change writes a row with:
  - `direction` (`in` | `out`), `txn_type`, `qty`, `balance_after`, `unit_cost`, `reference`, `actor_id`, optional `order_id` / `warehouse_id`.
- Incoming txn types: `purchase`, `customer_return`, `adjustment_in`, `transfer_in`, `production_return`, `production_yield`.
- Outgoing txn types: `production_consumption`, `damage`, `scrap`, `sample_usage`, `adjustment_out`, `transfer_out`.
- Negative stock is rejected at the action layer.

## Admin Inventory UI (`/admin/inventory`)

Tabs:

1. **Stock** — search by name / SKU / barcode / supplier / category / brand; filters for low stock, out of stock, Final vs Regular; per-warehouse quantities; barcode label print (Code39 SVG, no external dependency).
2. **Stock Ledger** — movement history with direction, type, qty, balance after, reference, actor.
3. **Warehouses** — CRUD + active toggle.

Actions: **Receive**, **Issue**, **Transfer** (between warehouses), barcode lookup (`findProductByBarcodeAction`) for scanner workflows.

## Production integration

In the order Production module (`ProductionMaterialsPanel`):

- **Consume Materials** — search or scan a product, set qty + usage kind (`normal` | `wastage` | `damaged` | `returned` | `scrap`), deducts stock (ledger `production_consumption`), and accumulates `orders.material_cost`.
- **Record Final Yield** — for `final_prdt` products only, adds finished goods to stock (ledger `production_yield`). No by-product concept exists.
- Both write order timeline notes.

## Costing

- `orders.material_cost` accumulates from consumptions (returned qty credits back).
- `orders.labour_cost`, `transport_cost`, `installation_cost`, `overhead_cost` columns exist for later P&L.

## Database

### Tables

- `warehouses`
- `stock_balances`
- `stock_movements` (production consumptions use `usage_kind`; no separate consumptions table)

### Migrations

- `supabase/migrations/20260730170000_product_catalog_cleanup.sql`
- `supabase/migrations/20260730180000_create_inventory.sql`
- `supabase/migrations/20260730210000_consolidate_module_tables.sql`

## File structure

```
src/features/inventory/types.ts
src/features/inventory/stockCore.ts
src/features/inventory/actions/inventoryActions.ts
src/features/inventory/actions/productionStockActions.ts
src/features/inventory/components/InventoryDashboard.tsx
src/features/inventory/components/ProductionMaterialsPanel.tsx
src/app/admin/(dashboard)/inventory/page.tsx
```

## Change Log

| Version | Date | Summary |
| ------- | ---- | ------- |
| 1.1 | 2026-07-30 | Folded `order_material_consumptions` into `stock_movements.usage_kind` |
| 1.0 | 2026-07-30 | Initial implementation: multi-warehouse stock, movement ledger, receive/issue/transfer, barcode labels, production consume + final yield |
