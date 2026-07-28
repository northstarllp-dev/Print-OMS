# Changelog

## [Unreleased] - 2026-07-08

### Added

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
