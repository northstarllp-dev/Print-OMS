# Print-OMS: End-to-End Technical & Product Architecture Deep Dive

This document is a comprehensive, 200+ line deep dive into the technical architecture, domain modeling, security posture, and workflow logic of the Print-OMS application. Print-OMS is a multi-tenant B2B SaaS Order Management System (OMS) designed to digitize the physical production pipeline of signage, fabrication, and large-format printing companies.

By deeply auditing the `/src` and `/docs` directories, this document outlines not just *what* the application does, but *how* it does it technically, and *why* these technical choices matter for a signage business.

---

## 1. Core Architecture and Stack

Print-OMS is built on a modern, high-performance web stack:
- **Framework:** Next.js 16 (App Router) for Server-Side Rendering (SSR) and Server Actions.
- **Database:** Supabase (PostgreSQL 17) for relational data, Row Level Security (RLS), and Realtime subscriptions.
- **Styling:** Tailwind CSS, utilizing a specific "Glassmorphism" design system (defined in `UI_DESIGN_README.md`) featuring deep blue (`#1E40AF`) and vibrant orange (`#F97316`) accents.
- **Auth:** Supabase Auth with custom role-based access control (RBAC).

### 1.1 Multi-Tenancy and Row Level Security (RLS)
Print-OMS is a true multi-tenant SaaS. This means multiple print shops use the same database without seeing each other's data. 
Every core table (`orders`, `customers`, `products`, `enquiries`, `quotations`) contains a `company_id` UUID column. 
Supabase's RLS policies enforce that an authenticated user (whose JWT contains their `company_id`) can only `SELECT`, `INSERT`, `UPDATE`, or `DELETE` rows where `table.company_id = auth.jwt()->>company_id`. This prevents cross-tenant data leaks at the database level, ensuring that a bug in the Next.js UI cannot accidentally expose a competitor's client list.

---

## 2. The Application Routing and Roles

The application's `src/app` directory is cleanly split by user persona:

### 2.1 `/admin` (The Business Owner)
The admin dashboard is the control center. The `AdminLayoutClient.tsx` wraps this area in a premium dark-mode sidebar (`#0C0F1A`). 
Admins have access to everything:
- **CRM (`/admin/customers`, `/admin/enquire`):** Managing the top of the funnel. Leads are logged as Enquiries (`ENQ-NNN`) and later converted to Customers and Orders.
- **Catalog (`/admin/products`):** The single source of truth for pricing. Admins define materials (3mm Acrylic, ACP, Vinyl) and set unit or square-foot pricing rules.
- **Settings & Staff (`/admin/settings`, `/admin/employees`):** Managing tenant settings and inviting staff members.
- **Reporting (`/admin/reports`):** Business intelligence and cash flow.

### 2.2 `/staff` (The Internal Team)
The staff view is a restricted version of the admin panel. Access is governed by files like `ticketGrants.ts` and `stageGrants.ts`. For example, a "Designer" role might only have write access to the "Design" stage of an order, while a "Sales Rep" controls the "Quotation" stage. 

### 2.3 `/portal` (The End Customer)
This is the most critical growth feature of the app. The portal allows the print shop's clients to view their orders, approve quotes, and track production without needing to create an account.
Because it's unauthenticated in the traditional sense, security is handled via **HMAC SHA256 JWT Tokens** (implemented in `src/utils/portal-tokens.ts`). 
- When an order quote is sent, the server generates a token (e.g., `generatePortalTokenSync`) containing the `customerId`, `orderId`, and specific `scopes` (like `approve_quote`).
- This token is signed with `PORTAL_SECRET` and saved to `portal_access_tokens`.
- When the customer clicks the link, `src/app/portal/order/[orderId]/page.tsx` verifies the token server-side. It then uses the Supabase Admin/Service Role client to fetch *only* that specific order's data, bypassing the public `anon` key completely to prevent malicious data scraping.

---

## 3. The Order Pipeline Workflow

The core of Print-OMS lives in `src/features/orders/workspace/`. An order is not just a document; it is a state machine that moves through 5 distinct physical stages. This entire workflow happens inside the `OrderWorksheetModal`.

### 3.1 Stage 1: Site Visit (`SiteVisitModule`)
In signage, accurate physical measurements are everything. 
- **The Problem:** Installers scribble measurements on paper and take photos on their phones. By the time it reaches the factory, files are lost, and dimensions are misread.
- **The Technical Solution:** Installers use the app on mobile. They log locations, input exact dimensions (`width`, `height`, `depth`), and upload photos. 
- **Data Integrity:** Once the installer clicks "Freeze", the `site_visits` record is locked. This prevents a sales rep from accidentally altering the physical reality of the site while building a quote later on.

### 3.2 Stage 2: Quotation (`QuotationModule`)
This module protects the print shop's profit margins.
- **The Engine:** In `src/features/quotations/actions/quotationActions.ts`, the `upsertQuotation` action takes the selected signage options and runs them through `computeQuotationTotals()`. 
- **Standardization:** It calculates Subtotals, applies discounts, calculates Tax (GST), and adds Shipping. Because it pulls from the admin's `/products` catalog, sales reps cannot make up arbitrary prices or forget to charge for expensive materials like ACP or LED modules.
- **The Customer Loop:** The quote is marked as `Sent`. The customer receives a WhatsApp notification (triggered via `dispatchWhatsAppNotification`) containing their secure Portal Link. If the customer requests a revision in the portal (`customerRequestRevision`), the state moves to `Quotation Negotiation` and the rep is notified. If they click Approve (`customerApproveQuotation`), the state locks to `Quotation Approved`.

### 3.3 Stage 3: Design (`DesignModule`)
Once quoted, the artwork must be finalized.
- Designers upload proofs (PDFs, CDRs). 
- To protect against malware and secure the intellectual property, these files are uploaded via Next.js Server Actions to private buckets, rather than relying on loose client-side Supabase uploads.
- The customer views these proofs in their portal and approves the final artwork.

### 3.4 Stage 4: Production (`ProductionModule`)
The factory floor takes over.
- This module features a milestone checklist (e.g., "Frame Fabricated", "Acrylic Cut", "LEDs Wired").
- It includes a strict `deadline` timestamp. 
- By tracking this digitally, the shop owner has a bird's-eye view of factory throughput and can identify bottlenecks before they cause missed deadlines.

### 3.5 Stage 5: Installation (`InstallationModule`)
The finished sign is sent back to the site.
- The field crew tracks the installation progress.
- They upload final "Completion Photos". These photos are critical because they trigger the final invoice payment and prove to the client that the work was done to spec.

### Parallel Tracking: Payments & Service Tickets
- **Payments:** Managed in the `payments` feature. Financials run parallel to the physical pipeline. The system tracks "50% Advance" or "Final Installment", flagging them as `expected` or `received`.
- **Service Tickets (`/service-tickets`):** Signage requires maintenance (e.g., a broken LED after 6 months). Print-OMS tracks after-sales complaints and warranty claims through dedicated service tickets, ensuring long-term customer satisfaction and repeat business.

---

## 4. The Multiplayer Realtime Engine

One of the most impressive technical feats in Print-OMS is its collaborative capability, driven by `src/features/orders/realtime/useOrderDetailSync.ts`.

In a busy shop, a designer might be uploading a proof while a sales rep is adjusting the invoice for the same order. 
- **The Mechanism:** `useOrderDetailSync` creates a dedicated `RealtimeChannel` (`order-detail-sync:[orderId]`) for any order currently open on a user's screen.
- **Postgres Changes:** It listens to PostgreSQL `UPDATE`, `INSERT`, and `DELETE` events on the `orders`, `site_visits`, `quotations`, `designs`, `productions`, and `installations` tables.
- **Smart Patching:** When an event fires (e.g., a designer saves a new proof), the hook receives a `RealtimePostgresChangesPayload`. It runs this through mapping functions (like `patchFromDesignRow`) and emits an `OrderDetailPatch`.
- **UI Reflection:** The React state merges this patch instantly. If a critical change occurs (like an Admin locking the stage), `onExternalStageChange` fires a toast notification warning the user: "This order was updated by another user."

This completely eliminates the traditional "Excel file is locked for editing" problem, enabling true multiplayer workflows.

---

## 5. Security Deep Dive: Auditing and Fixes

Based on the `docs/CHANGELOG-2026-07-07-quotation-session.md` and `docs/portal-and-storage-security-plan.md`, Print-OMS has undergone rigorous security hardening:

### 5.1 Portal RLS Revocation
Initially, to make the Customer Portal realtime, the Supabase `anon` key was given permissive `SELECT` access to quotation data. This was identified as a critical vulnerability.
- **The Fix:** The migration `20260706130000_quotation_revoke_anon_access.sql` completely removed `anon` access from the `quotations` table. 
- Now, portal mutations (like `customerApproveQuotation`) happen strictly server-side using the `createAdminClient()`. The server validates the HMAC Portal Token, ensures the token matches the `order_id`, and then performs the update securely.

### 5.2 Storage Hardening
Signage involves massive files (high-res PDFs, raw field photos). 
- **The Vulnerability:** Client-side uploads to public buckets (`getPublicUrl`) meant anyone could guess a URL and download a client's proprietary design.
- **The Plan:** Moving to server-mediated uploads (`uploadSiteVisitPhotoAction`). The server validates the MIME type (preventing malware uploads), enforces a 10MB/50MB size limit, and saves the file to a *private* bucket. The UI then requests temporary, expiring Signed URLs to display the images, completely securing the intellectual property.

---

## 6. How the Tech Translates to Sales Enablement

For a Print-OMS salesperson, understanding this architecture is a massive advantage. Every technical feature maps to a visceral pain point in the signage industry:

1.  **The Tech:** Server-Side Calculated Quotations (`computeQuotationTotals`).
    **The Pitch:** "Stop losing ₹25,000 on a job because a rep miscalculated the sqft price of Acrylic on WhatsApp. The system forces standardized pricing and guarantees your margins."

2.  **The Tech:** The `SiteVisitModule` with mobile photo uploads.
    **The Pitch:** "Stop relying on installers scribbling measurements on scraps of paper. They log dimensions and site photos directly into the app from the field, and it's permanently attached to the order file."

3.  **The Tech:** JWT-Secured Customer Portals (`portal_access_tokens`).
    **The Pitch:** "Stop dealing with customers calling you 10 times a day asking 'Is my sign ready?'. Give them a premium, secure portal link where they can approve quotes and track live progress. It makes your shop look like a high-end enterprise agency, helping you win larger corporate bids."

4.  **The Tech:** Postgres Realtime (`useOrderDetailSync`).
    **The Pitch:** "Print-OMS is fully multiplayer. Your designer, production manager, and sales rep can all work on the same order at the exact same time without overwriting each other's data or crashing."

---

## 7. Conclusion

Print-OMS is an exceptional example of domain-driven design. It does not try to be a generic tool for every business; it is hyper-optimized for the physical reality of fabricating and installing signage. 

By combining strict multi-tenant security, complex state-machine order tracking, automated financial calculations, and real-time collaborative UI, Print-OMS provides a highly defensible, enterprise-grade product. For the print shop owner, it transitions their business from a chaotic, WhatsApp-driven hustle into a scalable, metric-driven enterprise.
