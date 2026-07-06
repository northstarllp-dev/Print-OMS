# Admin Dashboard Feature Specification

## Overview

* Purpose of the feature: Provide a centralized command center for administrators to oversee the entire order pipeline, manage staff assignments, resolve workflow blocks (approvals), and monitor business health.
* Business objective: Ensure no order falls through the cracks, enforce quality control through mandatory admin sign-offs at stage gates, and allow manual overrides when necessary.
* User roles involved: Admin

## Workflow

1. **Pipeline Overview**: Admin logs in and views a Kanban-style or list-view board of all active orders mapped across `PipelineStage` (Enquiry → Site Visit → Quote → Design → Production → Installation → Completed).
2. **Alerts & Locks**: Orders requiring admin intervention (e.g., `stage_status` starts with "Pending Admin Approval") are highlighted with alerts.
3. **Stage Approval (Gatekeeping)**:
   * Staff completes a phase (e.g., finishes physical site visit).
   * Order locks into "Pending Admin Approval".
   * Admin reviews the submitted data (measurements, quotes, files).
   * Admin clicks "Approve Stage" to unlock and move it to the next phase, or "Request Changes" to send it back to staff.
4. **Overrides**: Admin can manually edit an order's stage, health status, workflow type, or assigned employees at any time.
5. **Customer Link Generation**: Admin generates the Magic Link to grant a customer access to the portal for a specific order.

## Workflow States

The Admin Dashboard oversees all states, specifically managing:

| Lock State (`stage_status`) | Admin Action Required | Next Stage upon Approval |
| --------------------------- | --------------------- | ------------------------ |
| Pending Admin Approval: Site Visit Schedule | Verify the time staff agreed upon | (Unlocks schedule) |
| Pending Admin Approval: Site Visit Completed | Verify measurements/photos. Add budget notes. | Quotation or Design |
| Pending Admin Approval: Quote Approval | Review the drafted quotation | Quotation moves to Sent |
| Pending Admin Approval: Design Approval | Review the drafted design proofs | Design moves to Sent |
| Pending Admin Approval: Job Done | Review after-photos and signature | Completed |

## Business Rules

* Only Admins can clear a `stage_status` admin-approval lock.
* Payments are financial tracking only and do not lock stages. See `specs/payments.md`.
* Admins can assign or reassign employees to any order.
* Admins can change the `workflow_type` (Quote First vs Design First) to adapt to specific customer requests.
* Deleting orders is generally restricted or soft-deleted via marking as `Lost`.

## User Roles

### Admin

Permissions:
* Full CRUD access to all orders and users.
* Approve/Reject stage gates.
* View and edit internal administrative notes (budget margins, supplier notes) hidden from regular staff and customers.
* Generate and revoke Customer Portal Magic Links.

## Database Design

### Relevant Tables

#### orders
* `stage_status`: The primary column driving the alert system in the dashboard.
* `stage_admin_notes`: Feedback from the Admin to the staff when rejecting a stage progression.
* `health`: "Active", "Needs Attention", "Lost", "Completed".

#### order_assignments
* Junction table managing which staff members are assigned to which `order_id`.

## API Endpoints

### Admin Approve / Reject Stage
Method: Server Action (`adminApproveStageAction`, `adminRejectStageAction`)
Behavior: Updates `stage_status` to "Normal" and logs the action in `order_activity`. Rejecting requires mandatory `notes`.

### Update Order Assignment
Method: Server Action (`assignEmployeeToOrder`)
Behavior: Upserts `order_assignments` table.

## UI Components

### AdminControlModule
Purpose: Rendered at the top of an order's detail page if the user is an Admin.
Fields:
* Yellow warning banner if stage is pending approval.
* Action buttons (Approve Stage, Request Changes).
* Internal Notes editor (Budget, Product Type, Customer demands).

### Pipeline Board (Kanban / List)
Purpose: High-level view of all orders grouped by stage.
Filters:
* `health`: Active, On Hold, Lost, Completed.
* `assigned_employee`: Staff filtering.
* **Date Range**: Filter orders created within a specific custom date range.

## File Structure

* `src/app/admin/(dashboard)/page.tsx`
* `src/features/order-detail/components/admin/AdminControlModule.tsx`
* `src/features/orders/actions/orderActions.ts`

## Data Flow

Admin clicks "Approve Stage"
→ `adminApproveStageAction` called
→ Updates `orders.stage_status` and `orders.stage`
→ Inserts `order_activity`
→ Supabase realtime or Next.js `revalidatePath` pushes the update to the Staff Dashboard, removing the lock for the assigned employee.

## Error Handling

* Unauthenticated Access: Middleware immediately redirects non-admins away from `/admin/*` routes.
* Concurrency: If an admin approves a stage while a staff member is editing, the staff member receives a toast indicating the stage has advanced.

## Notifications

* Visual badges on the dashboard sidebar indicating how many orders require admin approval.

## Security Rules

* Next.js Middleware checks the `role` claim in the Supabase JWT. If `role !== 'admin'`, the request is denied.
* Supabase Row Level Security (RLS) ensures that even via direct API, non-admin users cannot update `stage_status` to clear their own locks.

## Future Enhancements

* **Bulk Actions**: Allow admin to reassign multiple orders at once (e.g., if an employee goes on leave).
* **Audit Trail Viewer**: A dedicated UI tab to view every single change made to the `orders` table over time.

## Change Log

Version: 1.0
Date: 2026-07-03
Summary: Initial specification for the Admin Dashboard and Control Workflow.

Version: 1.1
Date: 2026-07-04
Summary: Payments are financial tracking only (no stage locks or payment gate modal).

Version: 1.2
Date: 2026-07-06
Summary: Added Custom Date Range filter to the Pipeline Board.
