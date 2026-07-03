# Customer Approval Feature Specification

## Overview

* Purpose of the feature: Handle the formal sign-off from the customer for the Quotation (cost) and Design (visuals) phases, and capture any advance payments required.
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
   * System transitions order to the next phase (Production).
3. **Payment Verification**:
   * Following approval (usually Quotation), the customer may be required to pay an advance.
   * Admin verifies the payment manually and checks the "Payment Verified" flag.

## Workflow States

| State | Description | Next Allowed States |
| ----- | ----------- | ------------------- |
| Pending Quote Approval | Quote is in `Sent` status awaiting customer action | Quote Approved, Quote Rejected |
| Pending Design Approval | Design is in `Sent to Customer` status | Design Approved, Changes Requested |
| Payment Pending | Quote/Design approved but advance payment not cleared | Payment Verified |

## Business Rules

* Production cannot begin unless BOTH the Quotation (if applicable) and Design (if applicable) are approved by the customer.
* If `workflow_type` is `quote_first`, Quotation approval moves the order to Design.
* If `workflow_type` is `design_first`, Design approval moves the order to Quotation.
* Customer can reject a quote or design by providing mandatory reason/notes.
* Payment verification is a manual toggle by Admin/Finance to acknowledge receipt of bank transfer / UPI.

## User Roles

### Customer

Permissions:
* Review `Sent` Quotations and `Sent to Customer` Designs.
* Approve or Reject.
* Submit rejection notes (which become timeline events).

### Admin

Permissions:
* Override customer approval (force approval if customer confirmed via email/WhatsApp).
* Toggle the "Payment Verified" flag.
* Transition order to Production upon full approval.

### Staff

Permissions:
* View approval status.
* Cannot force approval unless granted Admin rights.

## Database Design

### Relevant Tables

#### quotations
* `status`: Transitions from `Sent` to `Approved` or `Rejected`.
* `rejection_reason`: Populated if `Rejected`.

#### orders
* `stage`: Transitions based on the `workflow_type`.
* `designDetails.paymentVerified`: Boolean flag inside the JSONB.
* `designDetails.items[].versions[].status`: Transitions to `Approved` or `Changes Requested`.

#### order_activity
Logs all approval/rejection events:
* `"Customer approved the quotation."`
* `"Customer rejected the quotation. Reason: [Notes]"`
* `"Customer approved the design proof."`

## API Endpoints

### Handle Quotation Response
Method: Server Action (e.g., `updateQuotationStatus(quotationId, "Approved")`)
Logic: Updates quotation row, logs activity, automatically calls `updateOrderStageAction` to move order forward.

### Handle Design Response
Method: Server Action (e.g., `updateDesignItemStatus(orderId, itemId, versionId, "Approved")`)
Logic: Modifies JSONB array, checks if *all* items are approved. If yes, logs activity and calls `updateOrderStageAction`.

## UI Components

### Customer Portal (`app/portal/page.tsx`)
Purpose: Provides distinct tabs (Quotation, Design) that unlock linearly based on the order stage. Action buttons at the bottom of the active tab.

### Staff Dashboard (`QuotationModule.tsx`, `DesignModule.tsx`)
Purpose: Displays the current approval status. Contains an Admin-only "Mark Payment as Verified" checkbox.

## File Structure

* `src/app/portal/page.tsx`
* `src/app/portal/components/QuotationTab.tsx`
* `src/app/portal/components/DesignTab.tsx`
* `src/features/quotations/actions/quotationActions.ts`

## Data Flow

Customer clicks Approve in Portal
→ Server Action receives API call
→ Database updates (`quotations` or `orders.designDetails`)
→ `order_activity` inserted
→ Next.js `revalidatePath` refreshes the portal and staff dashboards in real-time.

## Error Handling

* Stale state: If a customer tries to approve an already approved document, the server action safely ignores or returns success.
* Missing notes: Rejection buttons are disabled until text is typed into the notes box.

## Notifications

* The system automatically generates a timeline event in `order_activity`.
* A banner appears on the staff dashboard indicating "Action Required: Customer Rejected Quote" or similar.

## Security Rules

* Customer portal routes are protected by a unique token or login session tied to the `customer_id`.
* Payment verification toggle is strictly disabled for non-Admin users.

## Edge Cases

* Partial Design Approval: An order might have 3 design items. The customer can approve Item 1 and 2, but reject Item 3. The order stage does NOT move to Production until Item 3 is also approved.

## Future Enhancements

* Integrated Payment Gateway: Allow the customer to pay via Stripe/Razorpay directly on the Approval screen, automating the `Payment Verified` flag.
* PDF Signatures: Implement digital e-signatures (DocuSign style) on the Quotation PDF.

## Change Log

Version: 1.0
Date: 2026-07-03
Summary: Initial specification for the Customer Approval Workflow.
