# Customer Approval Feature Specification

## Overview

* Purpose of the feature: Handle the formal sign-off from the customer for the Quotation (cost) and Design (visuals) phases.
* Business objective: Ensure no production begins without explicit customer consent on cost and design to avoid disputes and rework.
* User roles involved: Customer, Admin, Sales/Designer (Staff)

## Workflow

1. **Quotation Approval**: 
   * Order reaches `Quotation In Progress` and a quote is sent.
   * Customer reviews the quote in the portal.
   * Customer clicks "Approve Quotation".
   * System transitions order to the next phase (Design or Production).
2. **Design Approval**:
   * Order reaches `Design In Progress` and design proofs are sent.
   * Customer reviews proofs, adds comments if necessary.
   * Customer clicks "Approve Design" for all items.
   * System transitions order to the next phase (Production) when all items are approved.
3. **Payments** (financial tracking only — not part of approval gates):
   * Staff record expected/received amounts on the order **Payment** tab.
   * Customers view the same records on the portal **Payments** tab (read-only).
   * Payments never block stage progression. See `specs/payments.md`.

## Workflow States

| State | Description | Next Allowed States |
| ----- | ----------- | ------------------- |
| Pending Quote Approval | Quote is in `Sent` status awaiting customer action | Quote Approved, Quote Rejected |
| Pending Design Approval | Design is in `Sent to Customer` status | Design Approved, Changes Requested |

## Business Rules

* Production cannot begin unless BOTH the Quotation (if applicable) and Design (if applicable) are approved by the customer.
* If `workflow_type` is `quote_first`, Quotation approval moves the order to Design.
* If `workflow_type` is `design_first`, Design approval moves the order to Quotation.
* Customer can reject a quote or design by providing mandatory reason/notes.
* Payments are financial tracking only and do not affect approval or stage transitions.

## User Roles

### Customer

Permissions:
* Review `Sent` Quotations and `Sent to Customer` Designs.
* Approve or Reject.
* Submit rejection notes (which become timeline events).
* View payment records (read-only).

### Admin

Permissions:
* Override customer approval (force approval if customer confirmed via email/WhatsApp).
* Record payments and mark them received.
* Transition order stages after customer approval (payments do not block).

### Staff

Permissions:
* View approval status and payments.
* Create payment records and mark them received.

## Database Design

### Relevant Tables

#### quotations
* `status`: Transitions from `Sent` to `Approved` or `Rejected`.
* `rejection_reason`: Populated if `Rejected`.

#### designs
* One row per order (`order_id` unique).
* `items[].versions[].status`: Transitions to `Approved` or `Changes Requested`.

#### payments
* Financial tracking: fixed/percentage, statuses `expected` | `received`.
* See `specs/payments.md`.

#### orders
* `stage`: Transitions based on `workflow_type`.
* `stage_status`: Admin approval locks only (`Normal` or `Pending Admin Approval: …`).

#### order_activity
Logs approval/rejection and payment events.

## API Endpoints

### Handle Quotation Response
Method: Portal client / server updates on `quotations`
Logic: Updates quotation row, logs activity, advances order stage when appropriate.

### Handle Design Response
Method: Server Action (`updateDesignDetailsAction`, `approveAllDesignItemsAction`)
Logic: Updates `designs.items` JSONB; when all items approved, advances stage.

### Payments
Method: `src/features/payments/actions/paymentActions.ts`
See `specs/payments.md`.

## UI Components

### Customer Portal
* Quotation / Design tabs for approval.
* **Payments** tab (`PaymentsTab.tsx`): read-only totals and installment list.

### Staff Dashboard
* `QuotationModule`, `DesignModule` for work product.
* Header **Payment** tab (`PaymentsModule.tsx`) for financial tracking.

## File Structure

* `src/app/portal/page.tsx`, `PortalClient.tsx`
* `src/app/portal/components/DesignTab.tsx`, `PaymentsTab.tsx`
* `src/features/designs/actions/designActions.ts`
* `src/features/payments/actions/paymentActions.ts`
* `src/features/quotations/actions/quotationActions.ts`

## Data Flow

Customer clicks Approve in Portal
→ Database updates (`quotations` or `designs`)
→ `order_activity` inserted
→ Stage may advance
→ Next.js `revalidatePath` refreshes portal and staff dashboards

## Error Handling

* Stale state: If a customer tries to approve an already approved document, the server action safely ignores or returns success.
* Missing notes: Rejection buttons are disabled until text is typed into the notes box.

## Security Rules

* Customer portal routes are protected by a unique token or login session tied to the `customer_id`.
* Portal may read payments only; create/update/delete require authenticated staff.

## Edge Cases

* Partial Design Approval: An order might have 3 design items. The customer can approve Item 1 and 2, but reject Item 3. The order stage does NOT move to Production until Item 3 is also approved.

## Future Enhancements

* Optional payment gateway (out of scope for tracking module).
* PDF Signatures: Implement digital e-signatures on the Quotation PDF.

## Change Log

Version: 1.0
Date: 2026-07-03
Summary: Initial specification for the Customer Approval Workflow.

Version: 1.1
Date: 2026-07-04
Summary: Designs on `designs` table; payments as financial tracking only (portal view-only).
