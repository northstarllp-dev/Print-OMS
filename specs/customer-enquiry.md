# Customer Enquiry Feature Specification

## Overview

* Purpose of the feature: Capture and manage initial customer leads and enquiries before they become full production orders.
* Business objective: Centralize leads from various sources (Meta Ads, website, phone calls, walk-ins), assign them to sales staff, and track conversion to active orders.
* User roles involved: Admin, Sales Representative (Staff)

## Workflow

1. **Lead Capture**: An enquiry is received either via external integration (e.g., webhook from website/Meta) or manual entry by staff.
2. **Order Creation**: A new `Order` record is created with the initial stage `Enquiry` or `Lead`.
3. **Staff Assignment**: The Admin or Sales Manager assigns a sales representative to the order.
4. **Initial Contact**: Sales rep contacts the customer, logs chat history or notes.
5. **Stage Progression**: 
   * If the project requires a site visit, the stage is moved to `Site Visit`.
   * If the customer provides details directly, the stage is moved to `Quotation` or `Design` depending on the `workflow_type`.
   * If the lead goes cold, it is marked as `Lost` with a corresponding `lost_reason`.

## Workflow States

| State | Description | Next Allowed States |
| ----- | ----------- | ------------------- |
| Enquiry / Lead | Initial capture of customer interest | Site Visit, Quotation, Design, Lost |
| Lost | Customer decided not to proceed | Enquiry (if resurrected) |

## Business Rules

* Every new order must be associated with a `company_id` for multi-tenant data isolation.
* `health` status defaults to "Active" upon creation. Allowed values: Active, Needs Attention, On Hold, Lost.
* Active orders with no stage progress for `needsAttentionAfterDays` (client config, default 6) auto-move to Needs Attention on admin list/dashboard load.
* System logs an automated timeline event ("Order created manually by Admin") upon creation.

## User Roles

### Admin

Permissions:
* Create new orders manually.
* Reassign employees to orders.
* Update pipeline stages.

### Sales Representative (Staff)

Permissions:
* View orders assigned to them.
* Update order requirements and notes.
* Add chat history/internal notes.
* Move order to next pipeline stage.

## Database Design

### Tables

#### orders

| Column | Type | Description |
| ------ | ---- | ----------- |
| id | uuid (PK) | Unique internal ID |
| order_id | varchar | Friendly display ID (e.g., ORD-1001) |
| company_id | uuid (FK) | Tenant isolation |
| project_name | text | Name of the project |
| customer_id | text | Reference to customer record/phone |
| stage | text | Current pipeline stage (e.g., "Enquiry") |
| health | text | Status indicator (Active, Needs Attention, On Hold, Lost) |
| lost_reason | text | Reason if the order is marked lost |
| stage_changed_at | timestamptz | Last pipeline stage change (stall clock) |
| workflow_type | text | "quote_first" or "design_first" |

#### order_activity

| Column | Type | Description |
| ------ | ---- | ----------- |
| id | uuid (PK) | Unique ID |
| order_id | varchar (FK) | References `orders.order_id` or `id` |
| activity_type | text | e.g., "timeline" |
| actor_name | text | Who performed the action |
| content | text | Display text for the timeline |
| metadata | jsonb | Extra context (e.g., method: "manual") |

#### order_assignments

| Column | Type | Description |
| ------ | ---- | ----------- |
| order_id | uuid (FK) | References `orders.id` |
| employee_id | uuid (FK) | References `users.id` (staff) |

## API Endpoints

### Create Order

Method: Server Action (Next.js)
Route: `createOrder(formData: any)`

Request (FormData):
```json
{
  "project_name": "string",
  "customer_id": "string",
  "stage": "Enquiry",
  "workflow_type": "quote_first"
}
```

Validation Rules:
* Authenticated user session required.
* Associates user's `company_id` to the order automatically.

## UI Components

### New Order Form (Dashboard)

Purpose: Allow staff to manually enter new walk-in or phone enquiries.
Fields:
* Project Name
* Customer Name / ID
* Initial Workflow Route (Quote First vs Design First)

## File Structure

* `src/features/orders/actions/orderActions.ts` (Backend creation logic)
* `src/types/index.ts` (Order and PipelineStage types)

## Data Flow

UI Form 
→ Server Action `createOrder`
→ Look up current user's `company_id`
→ Insert into `orders` table
→ Insert timeline event into `order_activity`
→ Revalidate paths `/admin/orders` and `/staff/orders`

## Error Handling

Possible errors:
* Database insertion failure (e.g., missing required constraints).

Expected behavior:
* Server action throws error. UI should catch and display toast notification to user.

## Notifications

* Timeline event created upon successful insertion.

## Security Rules

* RLS ensures users can only create orders for their own `company_id`.
* Route protection prevents unauthorized access to the `/orders/new` page (if exists) or the underlying Server Action.

## Future Enhancements

* Webhook integrations to automatically create orders from Meta Lead Ads.
* Web-to-lead form generation for embedding on public websites.
* Duplicate checking based on customer phone number.

## Change Log

Version: 1.0
Date: 2026-07-03
Summary: Initial specification for the Customer Enquiry Workflow.
