# Production Feature Specification

## Overview

* Purpose of the feature: Track the manufacturing milestones of an approved order in the workshop.
* Business objective: Ensure visibility into the fabrication timeline (procurement, cutting, wiring, QC) and ensure all steps are marked complete before the item is dispatched for installation.
* User roles involved: Production Manager / Workshop Staff, Admin, Customer (View Only)

## Workflow

1. **Initialization**: Order transitions to `Production Pending` or `Production In Progress` once design and quotation are fully approved by the customer.
2. **Accessing Final Files**: Production staff navigate to the Design Tab to download the final approved production files (CDR, DXF, PNG, JPG, etc.) uploaded by the Designer.
3. **Tracking Milestones**: As fabrication proceeds, the workshop staff checks off the following milestones:
   * Procurement of Materials
   * ACP & Acrylic Cutting
   * Lighting & Wiring
4. **Deadline Tracking**: Admin can set and edit a production deadline which dictates when fabrication must be complete.
5. **Completion**: Once all checkboxes are checked, the staff clicks "Submit/Request Stage Advancement".
5. **Admin Approval**: Admin verifies the production completion, clears the lock, and transitions the order to `Installation Pending`.

## Workflow States

| State | Description | Next Allowed States |
| ----- | ----------- | ------------------- |
| Production Pending | Awaiting workshop assignment/initiation | Production In Progress |
| Production In Progress| Workshop is actively fabricating the items | Installation Pending |

*Note: Order can be locked in `Pending Admin Approval: Production Ready` when the workshop finishes.*

## Business Rules

* All production milestones should ideally be checked off before the stage is advanced.
* Workshop staff cannot edit checkboxes if the stage is locked (e.g., pending admin approval).
* Final vector files are securely accessed from the Design Module, enforcing a single source of truth for fabrication.

## User Roles

### Workshop Staff / Production Manager

Permissions:
* View approved site measurements.
* Download final production vector files.
* Toggle milestone checkboxes.
* Request stage advancement to Installation.

### Admin

Permissions:
* All Workshop Staff permissions.
* Approve the stage progression from Production to Installation.
* Set and edit the production deadline.

### Customer

Permissions:
* Track high-level production status via the Customer Portal progress bar (detailed checkboxes are hidden from the customer).

## Database Design

### Tables

#### productions

| Column | Type | Description |
| ------ | ---- | ----------- |
| id | uuid (PK) | Unique production record ID |
| order_id | uuid (FK) | Reference to `orders` table |
| procurementOfMaterials | boolean | Milestone flag |
| acpAndAcrylicCutting | boolean | Milestone flag |
| lightingAndWiring | boolean | Milestone flag |
| qualityCheck | boolean | Milestone flag |
| deadline | timestamptz | Admin-editable deadline for production |

*(Note: Data is mapped to `productionDetails` on the Order object in the frontend.)*

## API Endpoints

### Update Production Details
Method: Server Action (e.g., `updateProductionDetails(orderId, details)`)
Request:
```json
{
  "orderId": "uuid",
  "details": {
    "acpAndAcrylicCutting": true
  }
}
```
Behavior: Upserts the `productions` table with the toggled boolean states.

## UI Components

### ProductionModule (Staff Dashboard)
Purpose: A simple checklist UI for the workshop floor.
Fields:
* 4 distinct checkboxes corresponding to the production milestones.
* Status locks to prevent editing when pending admin approval.

## File Structure

* `src/features/order-detail/components/production/ProductionModule.tsx`
* `src/types/index.ts`

## Data Flow

Checkbox Toggled
→ `updateProductionDetails` called immediately
→ Supabase `productions` table upserted
→ Next.js Route Revalidated
→ UI reflects checked state

## Error Handling

* Optimistic updates or loading states (spinners) prevent double-clicking checkboxes.
* If a database error occurs, the checkbox state reverts and a toast alert is shown.

## Notifications

* Timeline event recorded when Production is fully completed and sent to admin for approval.

## Security Rules

* Checkboxes are disabled for customers (they don't see this module).
* Role-based checks ensure only authorized staff can toggle production flags.

## Inventory Integration

* **Materials & Yield panel** (`ProductionMaterialsPanel`) sits in the Production module below Production Notes.
* **Consume Materials**: search or barcode-scan a catalog product, set quantity + usage kind (`normal` | `wastage` | `damaged` | `returned` | `scrap`). Deducts stock via the ledger (`production_consumption`) and accumulates `orders.material_cost`.
* **Record Final Yield**: for Final Products (`final_prdt`), adds finished quantity into a warehouse via the ledger (`production_yield`).
* Both actions write order timeline notes. See `specs/inventory.md`.

## Future Enhancements

* **QR Code Tracking**: Generate a QR code per item. Workshop staff scans it at each station (Cutting, Wiring, QC) to auto-update the milestone.
* **Photo Proof**: Require staff to upload a photo of the completed sign at the "Quality Check" stage before it can be marked done.

## Change Log

Version: 1.0
Date: 2026-07-03
Summary: Initial specification for the Production Workflow.

Version: 1.1
Date: 2026-07-30
Summary: Added inventory integration — material consumption with usage kinds and final yield into stock; order material cost accumulation.
