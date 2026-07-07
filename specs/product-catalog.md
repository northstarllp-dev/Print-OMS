# Product Catalog Feature Specification

## Overview

* Purpose of the feature: Manage the standardized list of materials, services, and signage types offered by the company.
* Business objective: Provide a single source of truth for pricing to ensure estimators generate accurate and consistent quotations without relying on manual entry or guesswork.
* User roles involved: Admin, Staff (View-only during quotation)

## Workflow

1. **Creation**: Admin navigates to the Products dashboard and clicks "Add Product".
2. **Configuration**: Admin defines the product name, category, pricing strategy (per sqft or per unit), and base price. Running-feet pricing has been removed.
3. **Usage**: When a staff member builds a Quotation, this catalog populates the dropdown. Selecting a product auto-fills the price based on the selected pricing strategy.
4. **Maintenance**: Admins can update prices as material costs change or toggle products to inactive if they are no longer offered.

## Workflow States

* **Active**: Product appears in quotation dropdowns.
* **Inactive**: Product is hidden from quotation dropdowns but preserved for historical quotes.

## Business Rules

* Only Admins can create, edit, or disable products.
* Changes to a product's base price only affect *future* quotations. Existing draft or sent quotations retain the price they were created with.
* Each product must have at least one defined pricing type (`pricing_type`) to ensure accurate calculation in the quotation module.

## User Roles

### Admin

Permissions:
* Full CRUD (Create, Read, Update, Delete/Deactivate) access to the product catalog.

### Staff

Permissions:
* Read-only access implicitly through the Quotation builder dropdowns.

## Database Design

### Relevant Tables

#### products

| Column | Type | Description |
| ------ | ---- | ----------- |
| id | uuid (PK) | Unique product ID |
| company_id | uuid (FK) | Reference to the tenant company |
| name | text | e.g., "3mm ACP Board" |
| category | text | e.g., "Raw Material", "Finished Sign" |
| pricing_type | text | `"per_sqft"` or `"per_unit"` (running feet removed) |
| price_per_sqft | numeric | Base price if applicable |
| price_per_unit | numeric | Base price if applicable |
| is_active | boolean | Determines visibility in quotes |
| final_prdt | boolean | Marks whether the product is a "Final Product" |
| images | jsonb | Array of product image URLs (optional) |

## API Endpoints

### Manage Products
Method: Server Actions (`createProduct`, `updateProduct`, `deleteProduct`)
Behavior: Standard database operations ensuring `company_id` isolation via RLS policies.

## UI Components

### Product Dashboard (`ProductsView.tsx`)
Purpose: Tabular view for admins to list, search, filter, and manage all products.
Fields:
* Search bar.
* Filter by Category or Status.
* "Add Product" Modal with form inputs for pricing and type.

## File Structure

* `src/features/products/components/ProductsView.tsx`
* `src/features/products/actions/productActions.ts`

## Data Flow

Admin edits price in Product Modal
→ `updateProduct` server action called
→ Updates `products` table
→ Next.js `revalidatePath` updates the UI
→ Subsequent quotes load the new price

## Future Enhancements

* **Cost vs Retail Price**: Track both the internal cost to manufacture and the retail price to automatically calculate profit margins in the Reporting dashboard.
* **Inventory Tracking**: Link products to actual physical stock counts that decrement when an order goes into Production.

## Change Log

Version: 1.0
Date: 2026-07-03
Summary: Initial specification for the Product Catalog.

Version: 1.1
Date: 2026-07-04
Summary: Removed running-feet pricing (`price_per_running_ft` / `per_running_ft`).

Version: 1.2
Date: 2026-07-06
Summary: Added `final_prdt` property to distinguish final packaged products.
