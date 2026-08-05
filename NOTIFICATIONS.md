# Notifications & Activity Timeline Updates

This document summarizes the changes, bug fixes, and new features implemented for the Notifications and Activity Timeline systems.

## 1. Realtime Subscriptions & RLS Fixes
* **Realtime Events Dropping:** Fixed an issue where the client-side `user_id` filtering dropped realtime events. We implemented channel segmentation (using `notifications_channel_${userId}`) to ensure isolation and consistent delivery without relying strictly on client-side JS filtering.
* **Persistent Deletes & Updates:** Switched `clearAllNotifications` and `markAllNotificationsRead` from using a user-session client to `createAdminClient()`. This bypasses strict Row Level Security (RLS) policies on the `notifications` table that prevented authenticated users from issuing `DELETE` or global `UPDATE` operations, ensuring changes persist after a page refresh.
* **Stage Mapping:** Created a `DB_STAGE_TO_ORDER_STAGE` mapping in `dispatchNotification.ts` to bridge the gap between raw DB stage names (e.g., "Site Visit Pending") and our `OrderStage` RBAC keys (e.g., "site_visit").

## 2. Order Activity Timeline
* **Complete Redesign:** Replaced the static/mock Operation History panel in the top navigation bar with a live **Order Activity Timeline**.
* **Data Source:** Wired the panel to fetch the latest 50 events from the `order_activity` table.
* **UI Improvements:** 
  * Replaced the fake "Undo" button with clickable order badges that navigate directly to the respective order.
  * Added visual timeline dots (purple for users, grey for system).
  * Display the actor name, date/time formatting, and content description.
  * Added a loading state when the panel is opened.

## 3. Comprehensive Notification Coverage
Extensively expanded the triggers where notifications are dispatched. We implemented both direct notifications (to specific assignees) and broadcast notifications (to all admins or relevant staff).

| Trigger Event | Recipients | Type |
|---|---|---|
| **Enquiry Converted to Order** | Admins + Staff with `site_visit` access | Success |
| **Team/Employee Assigned** | Each assigned employee directly | Info |
| **Task Assigned** | Each assignee directly | Info |
| **Task Completed** | All Admins | Success |
| **Payment Received** | All Admins | Success |
| **Service Ticket Created** | All Admins | Warning |
| **Service Ticket Escalated** | All Admins | Info |
| **Service Ticket Closed** | All Admins | Success |
| **Staff Requests Stage Approval** | All Admins | Warning |
| **Admin Approves Stage** | Admins + Staff with new stage access | Success |
| **Admin Rejects Stage (Changes)** | Relevant Staff for that stage | Warning |

## 4. Production Environment Requirements
Discovered that the notification system failing silently on the deployed version (Vercel) was due to missing environment variables.

For the server-side `createAdminClient()` to bypass RLS and dispatch notifications to multiple users in the background, the following key must be set in Vercel:
* `SUPABASE_SERVICE_ROLE_KEY`

Additionally, for browser push notifications to function, Vercel must also have the VAPID keys set:
* `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
* `VAPID_PRIVATE_KEY`
* `VAPID_SUBJECT`
