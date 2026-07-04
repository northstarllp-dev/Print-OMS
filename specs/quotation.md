# Quotation Feature Specification

## Overview

* Purpose of the feature: Generate and manage cost estimates for signage projects based on site visit measurements and products.
* Business objective: Create accurate quotations by calculating per-sqft or per-unit costs, apply GST, send to customers for approval, and seamlessly convert approved quotes into active production orders.
* User roles involved: Admin, Staff (Sales/Estimator), Customer

## Workflow

1. **Initialization**: Once an order reaches `Quotation In Progress`, the system automatically fetches site visit measurements and available product catalogs.
2. **Drafting**: Estimator maps products (e.g., "ACP Signage", "Acrylic Letters") to the measured locations. The system auto-calculates totals based on `price_per_sqft` or `price_per_unit` (running-feet pricing removed). Each signage section shows site measurements with units from `site_visit_measurements` (`width_unit`, `height_unit`, `depth_unit`).
3. **Internal Review**: The quotation is saved as `Draft`. Admin reviews the subtotal, taxes, and applies any necessary discounts.
4. **Sending to Customer**: Admin clicks "Send to Customer", changing the quotation status to `Sent`. An activity log is recorded.
5. **Customer Review**: Customer views the itemized quote via the portal. They can approve it or reject/request changes.
6. **Approval**: If approved, the quotation becomes `Approved`. The order transitions to the next stage (`Design Pending` or `Production Pending` based on `workflow_type`).

## Workflow States

| State | Description | Next Allowed States |
| ----- | ----------- | ------------------- |
| Draft | Being prepared internally by staff | Sent |
| Sent | Delivered to customer for review | Approved, Rejected (displayed to customer as "Sent for Revision") |
| Approved | Customer signed off on the costs | N/A (Order stage progresses) |
| Rejected | Customer requested revisions. UI displays "Sent for Revision" and disables customer action buttons until a revised quote is sent. | Draft (New iteration) |

## Business Rules

* Quotations must have a unique identifier format `QT-NNN`.
* Line items use two pricing types: `per_unit` or `per_sqft` (running feet removed from products and quotations).
* A single **Qty / Measurement** field applies to both types. Amount is always `measurement × unitPrice` (`getLineMeasurement` / `calcLineAmount` in `src/features/quotations/utils/lineAmount.ts`).
* `quantity` and `totalSqFt` are kept in sync with the same measurement value. Legacy lines that stored measurement only in `totalSqFt` (with `quantity = 1`) are still resolved correctly.
* Site visit measurements (Width × Height × Depth) display under each signage section with units from the DB (`formatSiteMeasurementLabel`). Selecting a product pre-fills measurement from site visit width × height when available.
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
* Dynamic Status Badges: Shows "Sent for Revision" in amber when status is Rejected or Negotiation.
* Action Panel: Shows "Approve Quotation" / "Decline / Revise" buttons only when status is `Sent`. If Rejected/Negotiation, renders a banner indicating the revision request is being processed.

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

* Flat rate vs area: Both use the same Qty/Measurement field and formula `measurement × rate`. Pricing type only affects the rate source (`price_per_unit` vs `price_per_sqft`) and unit label (`nos` vs `sqft`).
* Blank/Manual rows: Staff can add rows without selecting a product from the database, entering a custom description and price manually.
* Stage advance after quote approval uses **Approve & Advance** with the payment gate modal (see `specs/payments.md`). The old quotation checklist (“Advance payment received / Move to Design”) has been removed.

## Future Enhancements

* Export to PDF: Server-side PDF generation of the quote document using Puppeteer or react-pdf.
* Payment Gateway Integration: Allow the customer to pay milestones online (Razorpay/PhonePe) via the Payments tab.

## Change Log

Version: 1.0
Date: 2026-07-03
Summary: Initial specification for the Quotation Workflow.

Version: 1.1
Date: 2026-07-04
Summary: Unified Qty/Measurement for unit and sqft; removed running feet; site measurement units on section headers; payment checklist integrates with `payments` milestones.
