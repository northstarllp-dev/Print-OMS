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
   * System transitions order to the next phase (Production) when all items are approved.
3. **Payment milestones** (business gates — not a pipeline stage):
   * Admin may create one or more payment requirements when advancing a stage (fixed or percentage of quotation total).
   * Required payments set `orders.stage_status` to `"Pending Payment Verification"` while keeping `orders.stage` unchanged.
   * Customer submits payment reference on the portal **Payments** tab (`status = paid`).
   * Admin verifies or waives on the staff **Payments** tab; stage unlocks when all required milestones are `verified` or `waived`.
   * See `specs/payments.md` for full detail.

## Workflow States

| State | Description | Next Allowed States |
| ----- | ----------- | ------------------- |
| Pending Quote Approval | Quote is in `Sent` status awaiting customer action | Quote Approved, Quote Rejected |
| Pending Design Approval | Design is in `Sent to Customer` status | Design Approved, Changes Requested |
| Pending Payment Verification | Required payment milestone(s) outstanding (`orders.stage_status`) | Normal (after verify/waive) |

## Business Rules

* Production cannot begin unless BOTH the Quotation (if applicable) and Design (if applicable) are approved by the customer.
* If `workflow_type` is `quote_first`, Quotation approval moves the order to Design.
* If `workflow_type` is `design_first`, Design approval moves the order to Quotation.
* Customer can reject a quote or design by providing mandatory reason/notes.
* Payment gates use the `payments` table. Legacy flags (`quotations.advance_paid`, `designs.payment_verified`) remain for checklist compatibility but do not replace milestones.
* Stage transitions are blocked while any payment has `required_for_next_stage = true` and status is not `verified` or `waived`.

## User Roles

### Customer

Permissions:
* Review `Sent` Quotations and `Sent to Customer` Designs.
* Approve or Reject.
* Submit rejection notes (which become timeline events).
* View payment milestones; submit payment reference and mark as paid.

### Admin

Permissions:
* Override customer approval (force approval if customer confirmed via email/WhatsApp).
* Create, verify, or waive payment milestones.
* Transition order stages when payment gates are clear.

### Staff

Permissions:
* View approval status and payments.
* Record verified payments via quotation/design checklists (`recordVerifiedPayment`).
* Cannot waive/verify unless granted Admin rights (server actions require authenticated staff).

## Database Design

### Relevant Tables

#### quotations
* `status`: Transitions from `Sent` to `Approved` or `Rejected`.
* `rejection_reason`: Populated if `Rejected`.
* `advance_paid` / `advance_percent` / `advance_amount`: Legacy checklist fields.

#### designs
* One row per order (`order_id` unique).
* `items[].versions[].status`: Transitions to `Approved` or `Changes Requested`.
* `payment_verified`: Legacy boolean; gates use `payments`.

#### payments
* Flexible milestones: fixed/percentage, multiple per order, statuses `pending` | `requested` | `paid` | `verified` | `waived`.
* See `specs/payments.md`.

#### orders
* `stage`: Transitions based on `workflow_type`.
* `stage_status`: Includes `"Pending Payment Verification"` for payment locks.

#### order_activity
Logs approval/rejection and payment events.

## API Endpoints

### Handle Quotation Response
Method: Portal client / server updates on `quotations`
Logic: Updates quotation row, logs activity, advances order stage when appropriate.

### Handle Design Response
Method: Server Action (`updateDesignDetailsAction`, `approveAllDesignItemsAction`)
Logic: Updates `designs.items` JSONB; when all items approved, advances stage (subject to payment gates).

### Payments
Method: `src/features/payments/actions/paymentActions.ts`
See `specs/payments.md`.

## UI Components

### Customer Portal
* Quotation / Design tabs for approval.
* **Payments** tab (`PaymentsTab.tsx`): amount, status, instructions, reference submit, Pay Online placeholder.

### Staff Dashboard
* `QuotationModule`, `DesignModule` for work product.
* **Payments** tab (`PaymentsModule.tsx`) and **PaymentRequiredModal** on stage advance.

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
→ Stage may advance (blocked if payment gates outstanding)
→ Next.js `revalidatePath` refreshes portal and staff dashboards

## Error Handling

* Stale state: If a customer tries to approve an already approved document, the server action safely ignores or returns success.
* Missing notes: Rejection buttons are disabled until text is typed into the notes box.
* Payment gate: Stage transitions throw `"Payment verification required before proceeding."`

## Security Rules

* Customer portal routes are protected by a unique token or login session tied to the `customer_id`.
* Portal may read payments and update to `paid` only; create/verify/waive require authenticated staff.

## Edge Cases

* Partial Design Approval: An order might have 3 design items. The customer can approve Item 1 and 2, but reject Item 3. The order stage does NOT move to Production until Item 3 is also approved.
* Multiple payment milestones: All required milestones must be verified or waived before progression.

## Future Enhancements

* Integrated Payment Gateway: Razorpay/PhonePe/Stripe via `payment_method` + `payment_reference` (no schema change).
* PDF Signatures: Implement digital e-signatures on the Quotation PDF.

## Change Log

Version: 1.0
Date: 2026-07-03
Summary: Initial specification for the Customer Approval Workflow.

Version: 1.1
Date: 2026-07-04
Summary: Payment milestones via `payments` table and `Pending Payment Verification` lock; designs on `designs` table; portal Payments tab.
