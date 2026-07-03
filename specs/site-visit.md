# Site Visit Feature Specification

## Overview

* Purpose of the feature: Schedule and execute a physical site visit, capture precise measurements, environmental data, and structural/electrical assessments for one or multiple signage locations.
* Business objective: Ensure accurate data collection prior to quotation and design phases, minimizing errors in production and installation.
* User roles involved: Customer, Assigned Staff, Admin

## Workflow

1. **Customer Scheduling**: Order enters `Site Visit Pending` stage. Customer selects date/time and provides GPS coordinates via the Customer Portal.
2. **Staff Verification**: Assigned staff member reviews the requested time. Staff approves, triggering a "Pending Admin Approval" lock. (Staff can also schedule manually, bypassing customer).
3. **Admin Review (Schedule)**: Admin approves the schedule. Stage moves to `Site Visit Completed` (indicating schedule is confirmed, despite the confusing stage name).
4. **Physical Audit & Data Entry**: Staff visits the site. Using the Staff Dashboard, they record measurements per location, upload site photos, and assess electrical/structural readiness.
5. **Stage Advancement Request**: Staff completes the audit and requests stage advancement. This locks the order in `Pending Admin Approval: Site Visit Completed`.
6. **Admin Final Approval**: Admin reviews all submitted data, adds internal administrative notes (budget, product suggestions), and approves the stage progression.
7. **Next Stage**: Order transitions to `Quotation In Progress` (or Design, depending on `workflow_type`).

## Workflow States

| State | Description | Next Allowed States |
| ----- | ----------- | ------------------- |
| Site Visit Pending | Awaiting customer to pick a schedule | Site Visit Scheduled |
| Site Visit Scheduled | Customer picked a date/time, pending internal review | Site Visit Completed |
| Site Visit Completed | Schedule confirmed, audit in progress / done | Quotation In Progress, Design |

*Note: The `stage_status` field acts as an independent lock (e.g., "Pending Admin Approval: Site Visit Schedule", "Pending Admin Approval: Site Visit Completed") which prevents progression until Admin clears it.*

## Business Rules

* Customer can only schedule if no valid `audit_date` exists.
* All data points (measurements, structural, electrical) must be saved dynamically as the staff enters them.
* Site photos are uploaded directly to a storage bucket and their URLs are stored in JSON.
* A site visit must be approved by an Admin before moving to Quotation.

## User Roles

### Customer

Permissions:
* View order in "Site Visit Pending".
* Select date, time, and address/GPS for the visit.
* View read-only confirmation once scheduled.

### Assigned Staff

Permissions:
* Approve customer's chosen date/time.
* Schedule the visit manually.
* Enter location measurements, electrical, and structural data.
* Upload site photos.
* Request stage advancement upon audit completion.

### Admin

Permissions:
* All Staff permissions.
* Approve "Pending Admin Approval" locks for scheduling and completion.
* Reject stage progression (sends order back with notes).
* Add internal notes (Customer Preferences, Budget Notes, Suggested Style).

## Database Design

### Tables

#### site_visits

| Column | Type | Description |
| ------ | ---- | ----------- |
| id | uuid (PK) | Unique site visit ID |
| order_id | varchar (FK) | Reference to `orders` |
| audit_date / time | text | Scheduled date/time |
| customer_address | text | Text address |
| gps_location | jsonb | `{ lat, lng }` |
| power_available | boolean | Electrical assessment |
| distance_to_power | text | Electrical assessment |
| electrical_notes | text | Electrical assessment |
| wall_type | text | Structural assessment |
| photo_categories | jsonb | URLs of uploaded site photos |
| internal_notes | jsonb | Admin notes (budget, preferences) |
| review_status | text | "Pending", "Staff Approved" |
| completed | boolean | Audit completion flag |

#### site_visit_measurements (Child Table)

| Column | Type | Description |
| ------ | ---- | ----------- |
| id | uuid (PK) | Unique measurement ID |
| site_visit_id | uuid (FK) | Reference to `site_visits` |
| name | text | Location identifier (e.g., "Main Facade") |
| width / height / depth | numeric | Physical dimensions |
| ground_clearance | numeric | Height from ground |
| notes | text | Specific notes for this location |
| photos | jsonb | Specific photos for this location |

## API Endpoints

### Schedule Site Visit
Method: Server Action
Route: `scheduleSiteVisitAction(orderId, scheduleData)`
Updates: Upserts `site_visits` with date/time/gps, updates `orders.stage`.

### Update Site Visit Details
Method: Server Action
Route: `updateSiteVisitDetailsAction(orderId, details)`
Updates: Upserts `site_visits` (power, structural, notes) and recreates/upserts rows in `site_visit_measurements`.

### Approve / Reject Stage
Method: Server Action
Route: `adminApproveStageAction(orderId)` / `adminRejectStageAction(orderId, notes)`
Updates: Unlocks `stage_status` in `orders` and progresses `stage` if applicable.

## UI Components

### OrderDetailClient (Customer Portal)
Purpose: Schedule the visit (Date picker, Time slots, Map selector).

### SiteVisitModule (Staff Dashboard)
Purpose: Staff UI to review schedule, enter measurements via tabs for different locations, assess electrical/structural readiness, and upload photos.

### AdminControlModule
Purpose: Displays yellow alert boxes for pending approvals. Contains the internal administrative settings panel for budget and preferences.

## File Structure

* `src/features/order-detail/components/site-visit/SiteVisitModule.tsx`
* `src/features/order-detail/components/site-visit/ScheduleVisitModal.tsx`
* `src/features/orders/actions/orderActions.ts` (State transition actions)
* `src/features/orders/actions/siteVisitMapper.ts`

## Data Flow

UI (Staff Input)
→ `updateSiteVisitDetailsAction`
→ Replaces existing `site_visit_measurements` for the visit with the new array.
→ Updates `site_visits` scalar fields.
→ Timeline entry added via `order_activity` table.

## Error Handling

* Concurrent editing issues: Measurements are entirely replaced based on the UI array. If multiple users edit simultaneously, the last save wins.
* Missing GPS: Falls back to manual address entry.

## Notifications

* Timeline entries in `order_activity` for scheduling, staff approval, and admin approval.

## Security Rules

* Only Admin can clear `stage_status` locks.
* Staff can only view/edit site visits for orders they are assigned to.

## Edge Cases

* Staff bypassing customer scheduling completely (e.g., agreed over phone). The UI provides a "Schedule by yourself" button to handle this.
* Legacy single-item orders: The UI/mapping logic handles mapping older single measurement data into a default "Main Signage" item in the measurements array.

## Future Enhancements

* Offline mode support for the Staff Dashboard when visiting areas with poor internet connection.
* Integration with Google Maps API for automated route planning for staff.

## Change Log

Version: 2.0
Date: 2026-07-03
Summary: Consolidated architecture and workflow specs into standard format.
