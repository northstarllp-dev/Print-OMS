# Changelog

## [Unreleased] - 2026-08-05

### Added

#### Production advance gate (installation deadline + payment note)
* When admin moves/approves an order **into Production**, a popup requires an **installation deadline**, notes that the **production deadline is one day earlier**, reminds to add payment, and offers **Go to Payments**.
* **Production files required**: Continue is blocked until final production files are uploaded on the Design tab (server also rejects advance to Production without them); popup offers **Go to Design to upload**.

## [Unreleased] - 2026-08-04

### Added

#### On Hold reach-out + calendar reminders
* Putting an order or enquiry **On Hold** requires a note and reach-out date (`hold_note`, `reach_out_at`); these appear on admin/staff calendars as hold follow-ups (staff need enquiry view/edit access).
* Calendar **Add reminder** with optional visible-to people (`calendar_reminders` table); creator and listed viewers see it; creator/admin can delete.
* Migration `20260804100000_hold_reach_out_and_reminders.sql` on PrintOMS-dev-db and PrintOMS-prod-db.

#### Admin design approve without customer
* Admin Design tab: amber **Approve design (skip customer)** when `Design In Progress` and proofs are not yet customer-approved (`adminMarkDesignApprovedAction` → **Design Approved** only). Does **not** jump to Production or ask for installation deadline.
* Installation deadline popup opens **only** when advancing **into Production** (quote-first: from Design Approved; design-first: from Quotation Approved — including Quotation admin advance). Primary CTA **Confirm & start fabrication**.

## [Unreleased] - 2026-08-01

### Added

#### Enquiry view/edit RBAC
* Grant key `enquiry` with `{ canView, canEdit }` in `stageGrantsByRole` (admins always full access).
* Staff `/staff/enquiries` list; sidebar shows Enquiries when view or edit; edit unlocks Add / Convert / updates.
* Marketer defaults include enquiry edit; public `/quote` create unchanged.

### Changed

#### Meta WhatsApp off — admin customer message popup
* **Meta Cloud API dispatch disabled**: `dispatchWhatsAppNotification` early-returns (skipped) so no Graph API sends occur; call sites and outbox stay intact for a later re-enable.
* **Admin customer message popup**: New shared `CustomerMessageModal` (`src/features/notifications/customer-message/`) with 19 Meta-ready utility templates (`{{n}}` body params, portal link appended for share channels). Variables (business name, client brand, enquiry/order/ticket numbers, date/time, portal link) auto-fill from context; actions: Copy, WhatsApp (`wa.me/91…`), Email (`mailto:`).
* **Wired triggers**: create enquiry, convert-to-order (replaces the old Printoms welcome modal), site visit schedule/complete, quotation send (ready/revised) + manual Follow-Up and Final Quotation buttons, design send (ready/revision), stage advances (Design In Progress / Production / Ready For Installation / Completed), installation schedule (worksheet + calendar reschedule), service ticket create/resolve, and a feedback request offered after Installation Completed.

## [Unreleased] - 2026-07-08

### Changed

#### Sales Income sync fix
* Deduped inflated Sales Income rows caused by broken idempotent sync (`.maybeSingle()` on duplicate notes). Added `finance_entries.source_ref` unique key; Sales Income now mirrors received Payments & Collections one-to-one.

#### Module table consolidation
* **Fewer tables**: Collapsed finance (`finance_entries`), purchases (PO `lines`/`receipts` jsonb + `doc_type` for requests), inventory consumptions (`stock_movements.usage_kind`), and task comments (`tasks.comments` jsonb). Migration `20260730210000_consolidate_module_tables.sql` on PrintOMS-dev-db and PrintOMS-prod-db.
* Frontend actions updated to the consolidated schema (finance, purchases, production stock, tasks).

### Added

#### Inventory & Warehouse Management
* **Products = inventory master**: Added inventory attribute columns to `products` (unit, brand, supplier, purchase price, min/max stock, HSN, GST rate, barcode/QR, default warehouse, `track_inventory`).
* **Final Product cleanup**: Final Product designation always available — removed the Settings toggle and dropped `app_settings.enable_final_product`; finals keep pricing and appear in quotation search. No by-product concept.
* **Multi-warehouse stock**: New `warehouses` (Main / Production Floor seeded per company), `stock_balances`, and immutable `stock_movements` ledger with full incoming/outgoing txn types. Migrated on PrintOMS-dev-db and PrintOMS-prod-db.
* **Inventory dashboard**: Replaced the `/admin/inventory` Coming Soon stub — stock list with search (name/SKU/barcode/supplier/category/brand) and low-stock / final-vs-regular filters, stock ledger, warehouse CRUD, Receive / Issue / Transfer, and Code39 barcode label printing.
* **Production material consumption**: Consume Materials (with usage kinds normal/wastage/damaged/returned/scrap) deducts stock and accumulates `orders.material_cost`; Record Final Yield adds finished Final Products into stock. Order cost columns (`labour_cost`, `transport_cost`, `installation_cost`, `overhead_cost`) added for later P&L.
* **Spec**: `specs/inventory.md`.

#### Purchase Order Management
* **Vendors**: Supplier directory with GSTIN, contact, rating, and PO history counts.
* **Purchase requests**: Request → approve/reject → convert-to-PO flow.
* **Purchase orders**: Auto `PO-0001` numbering per company, lines with ordered/received qty and unit cost, statuses Draft → Sent → Approved → Partially Received → Received → Cancelled/Closed, payment status Pending / Partially Paid / Paid.
* **Receive to stock**: Goods receipts create `purchase` stock movements, update balances, and auto-advance PO status.
* **Admin nav**: New Purchase Orders section beside Inventory. Migrated on PrintOMS-dev-db and PrintOMS-prod-db.
* **Spec**: `specs/purchase-orders.md`.

#### Finance Module
* **Invoice types**: `invoices.invoice_type` (GST / Tax / Actual / Proforma / Credit Note / Debit Note) selectable from the invoice builder; Proforma excluded from accounts totals with one-click Convert to Invoice (new number via existing allocation).
* **Receipts**: Incoming payments with auto `RCP-0001` numbering, customer/order/invoice links, and modes Cash / UPI / Bank / Cheque / Online.
* **Outgoing payments**: Categories Supplier / PO / Contractor / Freelancer / Salary / Rent / Electricity / Misc with vendor + PO links, GST, due dates, and Pending → Approved → Paid approval flow.
* **Expenses & other income**: Categorized expense and income entries with GST and attachments.
* **Finance dashboard**: `/admin/finance` with Overview (revenue, received, receivables, payables, expenses, net position, GST output vs input), per-category tabs, and a Reports tab (P&L-style + GST summary). Migrated on PrintOMS-dev-db and PrintOMS-prod-db.
* **Spec**: `specs/finance.md`.

#### Order Health — Needs Attention after stalled stage
* **Four health values only**: Active, Needs Attention, On Hold, Lost (Cancelled/Completed removed as health filters).
* **Auto-flag**: Active orders with no pipeline stage change for `features.needsAttentionAfterDays` (default 6, per client slug) become Needs Attention when admin opens dashboard or orders list.
* **`orders.stage_changed_at`**: New column; updated on every real stage advance; stage progress clears Needs Attention → Active. Migrated on PrintOMS-dev-db and PrintOMS-prod-db.
* **Admin review UI**: AdminControlModule health panel — set Active / On Hold / Lost (Lost requires reason) with optional call remarks on the order timeline.
* **Dashboard KPI**: Needs Attention count chip on admin dashboard.
* Specs: `admin-dashboard.md`, `reporting.md`, `customer-enquiry.md`.

#### Task Management System
* **New tasks module**: Added `tasks` and `task_comments` tables with company-scoped RLS and realtime publication.
* **Admin Tasks dashboard**: Added `/admin/tasks` with assignment workflow and status tracking.
* **Staff My Tasks**: Added `/staff/tasks` with Today, Overdue, Upcoming, and Completed sections.
* **Calendar task events**: Added task assigned-date and due-date events with a dedicated **Tasks** calendar filter.
* **Simple task detail**: Mark Completed + Comments only (progress, attachments, and history removed).
* **Order timeline integration**: Completing an order-linked task writes an order timeline activity entry.
* **Spec**: `specs/tasks.md`.

#### Payments & Collections Production Pass
* **Aging buckets**: Outstanding orders bucketed by 0–30 / 31–60 / 61–90 / 90+ days with clickable KPI filter chips on `/admin/payments`.
* **Inline Record Receipt**: Record a payment directly from the collections row without navigating to the order worksheet.
* **CSV export**: Download the filtered payments list as CSV.
* **Invoice badge**: Invoice status badge on collections rows with deep-link to `/admin/invoices/[id]`.
* **Balance fix**: Corrected `getPaymentBalanceSummary` to properly split expected vs received totals by payment status.
* **Banner cleanup**: Replaced gateway-in-progress banner with tracking-only guidance copy.

#### Calendar Production Pass
* **Week + Today views**: Toggle between Month, Week, and Today strip with overdue count badge.
* **Reschedule**: Reschedule site visits and installations directly from the calendar agenda.
* **Ops badges**: Outstanding payment amount and Google Maps link on calendar event cards.
* **Data enrichment**: Calendar events prefer site-visit / installation address over customer shipping; include payment outstanding info.
* **Spec**: `specs/calendar.md`.

#### Short Portal Tokens
* Portal tokens are now 12-character opaque codes (stored as `jti` in `portal_access_tokens`) instead of long HMAC blobs. Ideal for WhatsApp template URL-button variables. Legacy HMAC tokens are still accepted until they expire.
* All portal link generation resolves customer/order to UUIDs to prevent multi-tenant ambiguity.
* Removed dependency on `NEXT_PUBLIC_SITE_URL` env var — portal URLs now derive from request host headers.

#### Invoice Builder Module
* **Invoices table**: New `public.invoices` table with automated configurable invoice numbers (per-company prefix / FY / start / reset), one invoice per order, company-scoped RLS; migrated on PrintOMS-dev-db and PrintOMS-prod-db.
* **Auto-create on quote approval**: Approving a quotation (customer or admin) creates a Draft invoice copying line items and totals from the quote.
* **Admin + Staff nav**: Dedicated Invoices list and editable builder (Zoho-style) with Preview/Print PDF, Send, Mark Paid, and Void.
* **RBAC**: New `invoice` stage grant (Marketer and quotation editors by default); portal Invoice tab is read-only for Sent/Paid invoices.
* **Spec**: `specs/invoice.md`.

#### Order Assignment System
* **Assigned Admins Column**: Added a new database migration (`20260708061027_add_assigned_admins_to_orders.sql`) to add an `assigned_admins` column (`text[]`) to the `orders` table.
* **Enquiry Conversion Assignment**: Updated the "Convert to Order" modal (`EnquiriesViewNew.tsx`) to include a new "Assign Admins" field below the Business Name field. This allows users to select one or multiple admins to be assigned to the order at the time of conversion.
* **Admin Fetching API**: Created a `getAdmins()` server action to retrieve the list of available Admin users for the assignment dropdown.
* **Dashboard Filtering**: Added a new dropdown filter in the Orders Management Dashboard (`OrdersManagementDashboard.tsx`) to easily toggle between viewing "All Assigned Admins" and "My Assigned Orders", instantly filtering the table for orders assigned to the logged-in user.

#### Multi-Tenant Client Configuration & Theming
* **Centralized Configuration System**: Created `src/config/clientConfig.ts` to manage configurations, color palettes, and logos for different clients. The active client is resolved dynamically on the client-side via the `NEXT_PUBLIC_CLIENT_ID` environment variable.
* **Dynamic Theme Provider**: Added a `<ClientThemeProvider />` component to the root layout (`src/app/layout.tsx`). It injects a runtime `<style>` block that maps the active client's colors to the app's foundational CSS variables (e.g., `--color-primary`, `--sidebar-bg`).
* **Dynamic Logo Component**: Created a smart, reusable `<Logo />` component (`src/components/ui/Logo.tsx`) that intelligently scales based on its container (gracefully handling sidebar expansions). If a client has an uploaded logo, it uses the image; otherwise, it falls back to a stylized text-based logo.
* **"The Board Company" Profile**: Added a dedicated configuration profile for "The Board Company" (`theboardcompany`) featuring a custom Yellow (`#ead64a`), Black (`#000000`), and White (`#ffffff`) theme.
* **Logo Asset Management**: Imported and mapped "The Board Company Logo.png" to `public/clients/theboardcompany/logo.png`.

### Changed
* **Layout Logos**: Replaced hardcoded SVG and text logos with the new dynamic `<Logo />` component in all core layouts:
  * `AdminLayoutClient.tsx`
  * `StaffLayoutClient.tsx`
  * `InstallationLayoutClient.tsx`
  * `ProductionLayoutClient.tsx`
* **Login Pages**: Updated the branding on all authentication screens to use the `<Logo />` component:
  * `admin/login/page.tsx`
  * `staff/login/StaffLoginForm.tsx`
  * `installation/login/page.tsx`
  * `production/login/page.tsx`
* **Client Portals**: Replaced hardcoded branding in the customer-facing `PortalClient.tsx`.

### Fixed
* Fixed pre-existing TypeScript compilation errors related to missing Lucide React icon imports (`ChevronRight`, `Search`) in various layout components.
