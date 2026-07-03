# Quotation Feature Specification

## Overview

* Purpose of the feature: Generate and manage cost estimates for signage projects based on site visit measurements and products.
* Business objective: Create accurate quotations by calculating per-sqft or per-unit costs, apply GST, send to customers for approval, and seamlessly convert approved quotes into active production orders.
* User roles involved: Admin, Staff (Sales/Estimator), Customer

## Workflow

1. **Initialization**: Once an order reaches `Quotation In Progress`, the system automatically fetches site visit measurements and available product catalogs.
2. **Drafting**: Estimator maps products (e.g., "ACP Signage", "Acrylic Letters") to the measured locations. The system auto-calculates totals based on `price_per_sqft`, `price_per_unit`, or `price_per_running_ft`.
3. **Internal Review**: The quotation is saved as `Draft`. Admin reviews the subtotal, taxes, and applies any necessary discounts.
4. **Sending to Customer**: Admin clicks "Send to Customer", changing the quotation status to `Sent`. An activity log is recorded.
5. **Customer Review**: Customer views the itemized quote via the portal. They can approve it or reject/request changes.
6. **Approval**: If approved, the quotation becomes `Approved`. The order transitions to the next stage (`Design Pending` or `Production Pending` based on `workflow_type`).

## Workflow States

| State | Description | Next Allowed States |
| ----- | ----------- | ------------------- |
| Draft | Being prepared internally by staff | Sent |
| Sent | Delivered to customer for review | Approved, Rejected |
| Approved | Customer signed off on the costs | N/A (Order stage progresses) |
| Rejected | Customer declined or requested changes | Draft (New iteration) |

## Business Rules

* Quotations must have a unique identifier format `QT-NNN`.
* Line items can use three pricing types: `per_sqft`, `per_running_ft`, or `per_unit`.
* Site visit measurements (Width × Height) auto-populate the total square footage for line items mapped to them.
* Discounts are applied before tax calculation.
* Standard GST rates (0%, 5%, 12%, 18%, 28%) are applicable per line item.
* Quotations can only be sent to the customer if the order stage is `Quotation In Progress`.

## User Roles

### Staff (Estimator)

Permissions:
* View site visit measurements.
* Add line items and apply products.
* Adjust pricing and quantities.
* Save as Draft.

### Admin

Permissions:
* All Staff permissions.
* Send quotation to customer.
* Apply global discounts and edit terms.
* Override quotation status.

### Customer

Permissions:
* View quotations in `Sent` status.
* Download quotation PDF.
* Approve or reject the quotation with notes.

## Database Design

### Tables

#### quotations

| Column | Type | Description |
| ------ | ---- | ----------- |
| id | uuid (PK) | Unique quote ID |
| order_id | uuid (FK) | Reference to `orders` table |
| quotation_id | varchar | Auto-generated friendly ID (e.g., QT-001) |
| status | text | "Draft", "Sent", "Approved", "Rejected" |
| signage_options | jsonb | Array of locations containing line items |
| subtotal | numeric | Sum of line amounts before tax/discount |
| discount | numeric | Total discount amount |
| tax | numeric | Total calculated tax |
| grand_total | numeric | Final amount payable |
| notes | text | Customer-facing notes |
| terms | text | Terms and conditions text |
| rejection_reason| text | Populated if status is Rejected |

**`signage_options` JSONB Structure**:
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
        "quantity": 1,
        "pricingType": "per_sqft",
        "unit": "sqft",
        "unitPrice": 450,
        "totalSqFt": 150,
        "gstRate": 18
      }
    ]
  }
]
```

## API Endpoints

### Upsert Quotation
Method: Server Action (`upsertQuotation`)
Request: `QuotationPayload` object containing subtotal, tax, grand_total, and `signage_options`.
Behavior: Auto-generates `quotation_id` if new. Updates existing row if `id` is present.

### Send Quotation to Customer
Method: Server Action (`sendQuotationToCustomer`)
Behavior: Updates quotation status to `Sent`. Adds timeline log in `order_activity`. Optionally transitions the order `stage_status` to "Pending Admin Approval" or directly to next step depending on workflow configuration.

## UI Components

### QuotationModule (Staff Facing)
Purpose: Complex tabular editor for estimators to build the quote.
Fields:
* Accordions for each `SiteVisitItem`.
* Product dropdown to auto-fill pricing data.
* Dynamic calculation rows (Subtotal, Discount, Tax, Grand Total).

### QuotationTab (Customer Facing)
Purpose: Read-only summary view for the customer to review line items, totals, and terms.
Fields:
* Action buttons: "Approve Quotation", "Request Changes".

## File Structure

* `src/features/order-detail/components/quotation/QuotationModule.tsx`
* `src/features/quotations/actions/quotationActions.ts`
* `src/types/index.ts`

## Data Flow

`QuotationModule` (React State)
→ Auto-calculates totals on the client
→ User clicks Save
→ `upsertQuotation` server action called
→ Supabase `quotations` table updated

## Error Handling

* Invalid math state: The UI prevents saving if required fields (like Price) are negative.
* Database constraint: Ensure `order_id` is a valid UUID before upserting.

## Notifications

* Timeline entries logged when quotes are drafted, sent, approved, or rejected.

## Security Rules

* Customers can only see the quote once status is `Sent`.
* Customers cannot modify the quote, only the `status` (via approval/rejection endpoints).
* RLS policies restrict read/write to users within the same `company_id`.

## Edge Cases

* Flat rate items vs Area items: The code dynamically changes the formula `(Qty * Price)` vs `(Qty * SqFt * Price)` based on the selected `pricingType`.
* Blank/Manual rows: Staff can add rows without selecting a product from the database, entering a custom description and price manually.

## Future Enhancements

* Export to PDF: Server-side PDF generation of the quote document using Puppeteer or react-pdf.
* Payment Gateway Integration: Allow the customer to pay the advance amount directly upon clicking "Approve Quotation".

## Change Log

Version: 1.0
Date: 2026-07-03
Summary: Initial specification for the Quotation Workflow.
