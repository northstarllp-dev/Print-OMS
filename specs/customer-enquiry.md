# Customer Enquiry Feature Specification

## Overview

* Purpose of the feature: Capture and manage initial customer leads and enquiries before they become full production orders.
* Business objective: Centralize leads from various sources (Meta Ads, website, phone calls, walk-ins), assign them to sales staff, and track conversion to active orders.
* User roles involved: Admin, Sales Representative (Staff)

## Workflow

1. **Lead Capture**: An enquiry is received either via external integration or manual entry by staff on the `/staff/enquiries` page.
2. **Enquiry Creation**: A new record is created in the `enquiries` table, holding the customer's contact details, source, and initial notes.
3. **Customer Association**: If a matching customer is found, they are linked. Otherwise, a new customer record is automatically generated.
4. **Action / Conversion**: Staff contacts the customer. If the lead is qualified, the staff member clicks "Convert to Order". 
5. **Stage Progression**: Converting creates an actual order in the `orders` table, moving the project to a pipeline stage like `Site Visit`, `Quotation`, or `Design`.

## Workflow States

| State (Status) | Description | Next Allowed States |
| -------------- | ----------- | ------------------- |
| Pending | Initial capture of customer interest | Converted, Lost |
| Converted | Lead became a paying order | - |
| Lost | Customer decided not to proceed | Pending |

## Business Rules

* Every new order must be associated with a `company_id` for multi-tenant data isolation.
* `health` status defaults to "Active" upon creation. Allowed values: Active, Needs Attention, On Hold, Lost.
* Active orders with no stage progress for `needsAttentionAfterDays` (client config, default 6) auto-move to Needs Attention on admin list/dashboard load.
* System logs an automated timeline event ("Order created manually by Admin") upon creation.

## User Roles

### Admin

Permissions:
* Full enquiry access (view + edit) via `adminGrantMap`.
* Create new orders manually.
* Reassign employees to orders.
* Update pipeline stages.

### Staff (stage grant: `enquiry`)

Grant key: `enquiry` with `{ canView, canEdit }` in client `stageGrantsByRole` (same shape as invoice).

| Grant | Allowed |
| ----- | ------- |
| `canView` only | Open Enquiries list/detail at `/staff/enquiries`; no Add, Convert, or status updates |
| `canEdit` | Add enquiry, update enquiry, convert to order |
| neither | No Enquiries nav item; redirect away from `/staff/enquiries` |

* Staff sidebar shows **Enquiries** when `canView` or `canEdit` for `enquiry` (view-only roles still see the tab).
* Default / Marketer grants include `edit("enquiry")` where Marketer exists.
* Public `/quote` create remains open without a staff session.
* Server: `createEnquiry` (authenticated), `updateEnquiry`, `convertEnquiryToOrderAction` assert `assertStageEditPermission("enquiry")`.

### Sales Representative (Staff) order pipeline

Permissions:
* View orders assigned to them.
* Update order requirements and notes.
* Add chat history/internal notes.
* Move order to next pipeline stage.

## Database Design

### Tables

#### enquiries

| Column | Type | Description |
| ------ | ---- | ----------- |
| id | uuid (PK) | Unique internal ID |
| enquire_id | varchar | Friendly display ID (e.g., ENQ-1001) |
| company_id | uuid (FK) | Tenant isolation |
| lead_name | text | Name of the lead |
| business_name | text | Company Name |
| phone | text | Contact number |
| email | text | Email |
| status | text | "Pending", "Converted", "Lost" |
| order_id | uuid (FK) | Links to created order on conversion |
| customer_id | uuid (FK) | Links to customer record |

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

### Create Enquiry

Method: Server Action
Route: `createEnquiry(formData: any)`

Request Payload includes:
* `lead_name`, `business_name`, `phone`, `email`
* `source` (e.g., "Website", "Walk-ins")
* `notes`

Validation Rules:
* Server validates edit grants.
* Public form (`/quote`) can create without session, utilizing default deployment `company_id`.
* Associates user's `company_id` to the enquiry automatically if authenticated.

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
→ Server Action `createEnquiry`
→ Look up current user's `company_id`
→ Check if Customer exists (create if not)
→ Insert into `enquiries` table
→ Revalidate paths `/admin/enquire` and `/staff/enquiries`

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
