# Installation Feature Specification

## Overview

* Purpose of the feature: Schedule and execute the physical installation of fabricated signs at the customer's site.
* Business objective: Ensure on-time delivery, capture post-installation photo proofs, verify quality via a checklist, and collect final customer sign-off (signature) and pending payments.
* User roles involved: Admin, Installation Staff, Customer

## Workflow

1. **Scheduling**: Once Production is complete and approved, the order enters `Installation Pending`. The staff or admin uses the `InstallationScheduleModule` to select a date and time slot for the installation crew.
2. **Dispatch & Execution**: The installation crew travels to the site (referencing GPS/Address from the Site Visit).
3. **Site Work**: The crew installs the items according to the finalized designs.
4. **Completion Checklist**: The crew completes a mandatory UI checklist (e.g., "Cleaned area", "Tested electricals") via the Staff Dashboard.
5. **Photo Proof**: The crew uploads `afterPhotos` (photos of the finished installation).
6. **Customer Sign-Off**: The crew hands the device to the customer to capture their digital signature on the HTML canvas.
7. **Payment Collection**: The crew collects any final pending amount and inputs a payment reference/code.
8. **Finalization**: Order moves to `Job Done` pending admin approval, then to `Completed`.

## Workflow States

| State | Description | Next Allowed States |
| ----- | ----------- | ------------------- |
| Installation Pending | Production done, waiting to be scheduled | Installation Scheduled |
| Installation Scheduled | Date/time set, crew dispatched | Installation Completed |
| Job Done | Post-install data captured | Completed |

## Business Rules

* Installation cannot be scheduled on Sundays (Sunday dates are excluded from the picker).
* Installation cannot be marked complete without providing `afterPhotos` and checking off all items in the checklist (if enforced by UI).
* Customer signature is captured as a base64 Data URL and uploaded to the `site-visit-photos` storage bucket as an image file.

## User Roles

### Installation Staff

Permissions:
* View order details, address, and production files.
* Schedule or Reschedule the installation time.
* Upload after photos.
* Fill out the completion checklist.
* Capture customer signature.

### Admin

Permissions:
* All Staff permissions.
* Final approval of the "Job Done" stage to close the order.

### Customer

Permissions:
* View the scheduled installation date and time on their portal (`InstallationLayoutClient.tsx`).
* Provide physical signature on-site.

## Database Design

### Tables

#### installations

| Column | Type | Description |
| ------ | ---- | ----------- |
| id | uuid (PK) | Unique record ID |
| order_id | uuid (FK) | Reference to `orders` table |
| scheduledDate | text | YYYY-MM-DD |
| scheduledTime | text | e.g., "10:30 AM" |
| afterPhotos | jsonb | Array of URLs |
| checklist | jsonb | Array of `{id, label, checked}` |
| customerSignature | text | URL to the signature image |
| paymentCode | text | Reference for final payment |
| notes | text | Final notes from the crew |

*(Note: Data is mapped to `installationDetails` on the Order object in the frontend.)*

## API Endpoints

### Schedule Installation
Method: Server Action (`scheduleInstallationAction(orderId, details)`)
Updates: Upserts `installations` table with date and time. Transitions order stage if necessary.

### Update Installation Details (Completion)
Method: Server Action (`updateInstallationDetailsAction(orderId, details)`)
Updates: Upserts `installations` table with photos, signature URL, and checklist data.

## UI Components

### InstallationScheduleModule
Purpose: Date/time picker for scheduling. Uses a horizontal scrolling calendar excluding Sundays.

### InstallationLayoutClient / Completion Form
Purpose: Post-installation form.
Fields:
* Multiple file uploader for `afterPhotos`.
* Checklist toggles.
* HTML5 Canvas for drawing the customer signature.
* Text input for `paymentCode`.

## File Structure

* `src/features/installations/components/InstallationScheduleModule.tsx`
* `src/app/installation/(dashboard)/InstallationLayoutClient.tsx`
* `src/features/installations/actions/installationActions.ts`

## Data Flow

Staff draws signature on Canvas 
→ `canvas.toDataURL()`
→ Converted to Blob
→ Uploaded to Supabase `site-visit-photos` bucket
→ URL returned
→ `updateInstallationDetailsAction` called with signature URL and photos
→ Order marked as "Job Done"

## Error Handling

* Signature Canvas: Clear button provided if the customer messes up.
* Required Fields: Form validation prevents submission if photos or signature are missing.

## Notifications

* Timeline event recorded for scheduling ("Installation scheduled for X").
* Timeline event recorded for completion ("Installation completed and signed off").

## Security Rules

* Signature files are stored in the same bucket as site photos.

## Future Enhancements

* SMS/WhatsApp reminder sent to the customer on the morning of the installation.
* Route optimization dashboard for assigning multiple installations to one crew on a map.
* Feedback rating (1-5 stars) captured alongside the signature.

## Change Log

Version: 1.0
Date: 2026-07-03
Summary: Initial specification for the Installation Workflow.
