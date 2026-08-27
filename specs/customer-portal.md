# Customer Portal Feature Specification

## Overview

* Purpose of the feature: Provide a secure, read-only (mostly) web application for end customers to track their orders, review quotes, approve designs, and view installation updates without requiring a password login.
* Business objective: Enhance transparency, speed up approval times, and reduce back-and-forth communication between staff and customers.
* User roles involved: Customer (Primary), System (Auth Generation)

## Workflow

1. **Authentication**: Admin generates a "Magic Link" from the staff dashboard for a specific customer. This link contains an encrypted token with the `customerId`.
2. **Access**: Customer clicks the link (e.g., received via WhatsApp/Email). The system verifies the token integrity, expiration, and checks against a revocation list.
3. **Dashboard View**: Customer is presented with `PortalClient`, which displays all active and past orders associated with their `customer_id`.
4. **Order Tracking**: Customer selects an active order to view its timeline and progress bar.
5. **Interactive Tabs**: Depending on the current stage of the order, specific tabs unlock:
   * **Quotation Tab**: Shared `QuotationTab` component read quotes when `Sent`/`Approved`/`Rejected`; approve/decline via server actions when `Sent`. Draft/Pending Approval shows “being prepared”.
   * **Design Tab**: View proofs, add feedback comments on the canvas, upload inspiration, approve proofs.
   * **Payments Tab**: View payment milestones, submit UTR/reference, mark as paid (Pay Online placeholder for gateways). Always available; not a pipeline stage.
   * **Installation Tab**: View scheduled dates, and later see "After Photos" once completed.
   * **Invoice Tab**: View and download final tax invoices generated for the order.
6. **Token Expiration**: The magic link expires naturally over time or can be actively revoked by the Admin.

## Workflow States

The portal itself doesn't have "states" but visually reflects the states of the `Order`:
* **Site Visit Pending**: Renders scheduling module.
* **Site Visit Completed**: Renders "Under Verification" alert.
* **Quotation In Progress**: Unlocks Quotation Tab.
* **Design Pending**: Unlocks Design Tab.
* **Production**: Displays progress bar update (details hidden).
* **Installation Scheduled**: Unlocks Installation tracking Tab.

## Business Rules

* Access to the portal is completely password-less, relying on securely generated, short-lived (or manageable) tokens using HMAC.
* A token can be instantly revoked in the database, locking the customer out on their next page load.
* Rate limiting is enforced on the `/printoms/portal` route to prevent brute-forcing or denial of service attacks.
* Customers can approve quotations, request revisions, add design comments, and schedule site visits/installations (when enabled). They cannot edit core order data or quotation line items.
* Quotation mutations use `customerApproveQuotation` / `customerRequestRevision` (portal session + Supabase service role). No direct anon client updates on `quotations`.

## User Roles

### Customer

Permissions:
* Access via valid magic link.
* View all orders linked to their customer profile.
* Interact with Quotation, Design, and Installation modules specifically designed for them.

### Admin (via Staff Dashboard)

Permissions:
* Generate magic links.
* Revoke magic links.

## Database Design

### Relevant Tables

#### portal_tokens
* While JWTs/HMACs can be stateless, a `revoked_tokens` table (or similar mechanism) exists to instantly invalidate links before their natural expiration.

#### customers
* Looked up via `customer_id` embedded in the token payload.
* Joined with `orders` via `customer_id`.

## API Endpoints

### Portal Verification
Method: Next.js Server Component `PortalPage`
Behavior: Validates token using `verifyPortalToken()`. Checks `isTokenRevoked()`. Returns Error UI if invalid.

### Fetch Portal Data
Method: Supabase query inside `PortalPage`.
Behavior: Fetches `customers`, `orders` (with `site_visits`, `site_visit_measurements`, `installations` joined).

## UI Components

### PortalPage (Server Component)
Purpose: Handles auth, rate limiting, and data fetching securely on the server.

### PortalClient (Client Component)
Purpose: The main layout wrapper for the customer view. Handles state for switching between multiple orders. Uses `useQuotationActions` and `usePortalOrderRealtime`.

### QuotationTab (Shared Client Component)
Purpose: Renders quotation line items, totals, and approve/decline UI. Used by both `PortalClient` and `OrderDetailClient`. Gates visibility with `isQuotationVisibleToCustomer`.

### OrderDetailClient (Client Component)
Purpose: Single-order portal view at `/printoms/portal/order/[orderId]`. Shares quotation hooks and `QuotationTab` with `PortalClient`.

### Order Tracker / Progress Bar
Purpose: Visually maps the `stage` of the order into a clean 5-step UI (Enquiry, Site Visit, Quote/Design, Production, Installation).

## File Structure

* `src/app/portal/page.tsx`
* `src/app/portal/PortalClient.tsx`
* `src/app/portal/components/DesignTab.tsx`
* `src/app/portal/components/QuotationTab.tsx`
* `src/app/portal/components/PaymentsTab.tsx`
* `src/app/portal/components/InvoiceTab.tsx`
* `src/app/portal/components/SiteVisitLocationPicker.tsx`
* `src/app/portal/hooks/useQuotationActions.ts`
* `src/app/portal/hooks/usePortalOrderRealtime.ts`
* `src/app/portal/order/[orderId]/page.tsx`
* `src/app/portal/order/[orderId]/OrderDetailClient.tsx`
* `src/utils/portal-tokens.ts`

## Data Flow

Request URL with `?token=...`
→ Rate limiter checks IP
→ `verifyPortalToken` validates signature
→ DB queries fetch customer and associated orders
→ Server fetches `app_settings` for the company to determine feature flags
→ Rendered HTML sent to client
→ React handles tab switching internally without full page reloads.
→ If `app_settings.site_visit_scheduling_enabled` or `installation_scheduling_enabled` are false, the respective scheduling modules are replaced with a read-only message.

## Error Handling

* Invalid Token: Renders a friendly "Invalid or Expired Link" UI.
* Revoked Token: Renders a friendly "Access Revoked" UI.
* Rate Limit Exceeded: Renders a "Too Many Requests" UI.
* Database failures fetch safely and display generic error boundaries.

## Notifications

* The portal itself does not push notifications, but the actions taken *inside* the portal (e.g., approving a design) trigger timeline updates that alert the staff.

## Security Rules

* Token generation uses strong environment variables (`PORTAL_SECRET_KEY`).
* Rate limiting prevents abuse.
* Server components fetch customer data with service role after token validation; queries filter by `customer_id` / order scope.
* Quotation reads: `getCustomerVisibleQuotationForOrder` (service role; hides Draft / Pending Approval).
* Quotation writes: `customerApproveQuotation` / `customerRequestRevision` (portal session ownership check + service role; `status = 'Sent'` guard).
* **`quotations` table has no anon RLS policies** (revoked in `20260706130000_quotation_revoke_anon_access.sql`).
* `app_settings` are strictly read-only for the portal (granted via Anon policy).

## Future Enhancements

* Push notifications (PWA) to alert the customer when the order stage changes.
* Chat interface directly inside the portal to message the assigned sales rep.
* Online payment (Razorpay / PhonePe / Stripe) on the Payments tab.

## Change Log

Version: 1.0
Date: 2026-07-03
Summary: Initial specification for the Customer Portal architecture.

Version: 1.1
Date: 2026-07-04
Summary: Payments tab for milestones; design data via `designs` join; site measurement units on quotations.

Version: 1.2
Date: 2026-07-06
Summary: Integration with `app_settings` to conditionally disable customer self-scheduling for Site Visits and Installations based on Admin preferences.

Version: 1.3
Date: 2026-07-07
Summary: Unified quotation portal UI (`QuotationTab`, `useQuotationActions`, `usePortalOrderRealtime`); server-action mutations replace direct anon client updates; quotation hidden until admin sends (`Sent`/`Approved`/`Rejected` only).
