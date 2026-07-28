# Printec Order Management System (OMS) - Master Workflow & Architecture Specification

This document serves as the master, production-ready specification and technical blueprint for the **Printec Order Management System (OMS)**. It is designed to act as the primary source of truth for engineering onboarding, system audits, database configuration, and context generation for AI coding assistants.

---

## 1. Executive Summary & Business Scope

### 1.1 Problem Statement & Solution Goal
In the custom commercial signage industry, production is highly specialized. Standard CRM products cannot capture spatial layouts, physical material constraints, and custom pricing models. The Printec OMS is built to bridge this gap by mapping the entire journey of a custom signage project—from lead generation to physical installation check-off.

The solution provides:
* **Multi-Tenant Isolation**: Ensuring data protection across multiple operational organizations.
* **Unified Pipeline Tracking**: Two pipeline route configurations tailored to different business models (Concept-First vs. Cost-First).
* **Survey Optimization**: Gathering spatial measurements (with units) and converting them directly into costing values.
* **Collaboration Workspace**: Direct chat logs and design annotations linking customers, designers, and sales reps (design data in dedicated `designs` table).
* **Payment Tracking**: Expected/received amounts on orders via `payments` (financial visibility only; does not block stages).
* **Logistical Coordination**: Planning field resources (scaffolding, crane access) and verifying physical installation with digital handovers.

### 1.2 Document Scope
This document specifies:
1. **User Persona Roles**: Roles, responsibilities, and permissions.
2. **Dynamic Pipelines**: Detailed state transitions and stage verification locks.
3. **Operational Workflows**: Procedures for Site Surveys, Costing, Graphic Design Loops, Workshop Milestones, and Mounting Handover.
4. **Complete Schema Catalog**: Database layout, parameters, and structural JSON columns.
5. **API & Server Actions Catalog**: Granular server action interfaces and code snippets.
6. **Security & RLS Configuration**: Multi-tenant isolation and policy definitions.
7. **Frontend Guidelines**: Client state synchronization, design tokens, and CSS layout configurations.
8. **Troubleshooting & Developer Runbook**: Dev setup and diagnostic scripts.

Feature-level specs (same folder):

| Spec | File |
| ---- | ---- |
| Payment milestones | [`specs/payments.md`](./payments.md) |
| Quotation | [`specs/quotation.md`](./quotation.md) |
| Invoice | [`specs/invoice.md`](./invoice.md) |
| Designer workflow | [`specs/designer-workflow.md`](./designer-workflow.md) |
| Customer approval | [`specs/customer-approval.md`](./customer-approval.md) |
| Customer portal | [`specs/customer-portal.md`](./customer-portal.md) |
| Admin dashboard | [`specs/admin-dashboard.md`](./admin-dashboard.md) |
| Product catalog | [`specs/product-catalog.md`](./product-catalog.md) |
| Site visit | [`specs/site-visit.md`](./site-visit.md) |

---

## 2. User Roles, Personas & Detailed Permissions Matrix

The Printec OMS supports distinct user roles. Below is the comprehensive operational definition and capability boundaries for each role.

### 2.1 Persona Definitions

#### 1. System Administrator (Admin)
* **Context**: Business owners, operations directors, or system managers.
* **Goal**: Supervising operations, auditing transactions, managing personnel workloads, and overriding blocks.
* **Dashboard Capabilities**: Full read/write capability across all modules. Can bypass stage locks, override quotation totals, edit customer billing codes, and assign staff resources.

#### 2. Field Surveyor (Agent)
* **Context**: Technicians on-site measuring structures.
* **Goal**: Documenting dimensions, wall conditions, electrical access, and obstructions.
* **Mobile-Client Capabilities**: Accesses assigned schedule page. Can add sign locations, input dimensions, select units, upload photos, and submit logs.

#### 3. Sales Estimator (Staff)
* **Context**: Sales team mapping site survey data to catalogues.
* **Goal**: Generating accurate estimates, applying margins, and securing client signatures.
* **Desktop Capabilities**: Accesses measurements, maps products, adjusts pricing parameters, configures GST taxes, and saves quote drafts.

#### 4. Graphic Designer (Staff)
* **Context**: Art designers producing technical layouts.
* **Goal**: Creating accurate layouts matching survey specs.
* **Workspace Capabilities**: Downloads site visit files, uploads blueprints (`.cdr`, `.dxf`, `.plt`, `.pdf`, `.svg`, `.png`, `.jpg`), manages visual proof versions, and responds to customer annotations.

#### 5. Workshop Fabricator (Staff)
* **Context**: Workshop technicians building the physical signs.
* **Goal**: Sourcing materials, cutting substrates, assembly, wiring, and QC checking.
* **Workshop Capabilities**: Reads job sheets, marks material procurement, checks off fabrication milestones, and records quality checklist passes.

#### 6. Installation Crew Lead (Staff)
* **Context**: On-site crew mounting the fabricated signs.
* **Goal**: Mounting the sign, verifying electrical wiring, and obtaining client sign-off.
* **Dispatch Capabilities**: Accesses logistics requirements, checks in on-site, uploads post-installation photos, and captures the client's signature.

#### 7. Customer (Client)
* **Context**: Client who ordered the signage.
* **Goal**: Reviewing project progress, checking designs, reviewing pricing options, and signing approvals.
* **Portal Capabilities**: Secure magic-link login, access order tracking sub-tabs, request quote revisions, comment on design proofs, and approve milestones.

---

### 2.2 Permissions Matrix

The table below defines granular access privileges across CRM entities.

| Entity | Action | Admin | Estimator | Designer | Surveyor | Installer | Customer |
| ------ | ------ | ----- | --------- | -------- | -------- | --------- | -------- |
| **Enquiries** | Read | Allow | Allow | Block | Block | Block | Block |
| | Write | Allow | Allow | Block | Block | Block | Block |
| **Orders** | Read | Allow | Allow | Allow | Allow | Allow | Allow (Own) |
| | Edit Stage | Allow | Block | Block | Block | Block | Block |
| **Site Visits**| Create | Allow | Block | Block | Block | Block | Block |
| | Log Survey| Allow | Block | Block | Allow | Block | Block |
| | Verify | Allow | Block | Block | Block | Block | Block |
| **Quotations**| Create Draft| Allow | Allow | Block | Block | Block | Block |
| | Send Quote | Allow | Block | Block | Block | Block | Block |
| | Approve/Decline| Allow (Override)| Block | Block | Block | Block | Allow (Own) |
| **Designs** | Upload Proof| Allow | Block | Allow | Block | Block | Block |
| | Approve/Decline| Allow (Override)| Block | Block | Block | Block | Allow (Own) |
| **Production**| Check Milestones| Allow | Block | Block | Block | Block | Block |
| | QC Sign-off| Allow | Block | Block | Block | Block | Block |
| **Installation**| Log Progress| Allow | Block | Block | Block | Allow | Block |
| | Upload Sign-off| Allow | Block | Block | Block | Allow | Allow (Signature)|

---

## 3. The Dynamic Workflow Engine & State Machine

The Printec OMS uses a dynamic workflow engine configured by the order's `workflow_type` parameter.

### 3.1 Pipeline Routing Graph

```
                   [ Lead Captured ]
                           │
                           ▼
               [ Site Visit Scheduled ]
                           │
                           ▼
               [ Site Visit In Progress ]
                           │
                           ▼
               [ Site Visit Completed ]
                           │
                           ▼
               [ Site Visit Approved ]
                           │
             ┌─────────────┴─────────────┐
             │                           │
  [ workflow_type = "quote_first" ]   [ workflow_type = "design_first" ]
             │                           │
             ▼                           ▼
  [ Quotation In Progress ]       [ Design In Progress ]
             │                           │
             ▼                           ▼
  [ Quotation Sent ]              [ Design Sent ]
             │                           │
             ▼                           ▼
  [ Quotation Approved ]          [ Design Approved ]
             │                           │
             ▼                           ▼
  [ Design In Progress ]          [ Quotation In Progress ]
             │                           │
             ▼                           ▼
  [ Design Sent ]                 [ Quotation Sent ]
             │                           │
             ▼                           ▼
  [ Design Approved ]             [ Quotation Approved ]
             │                           │
             └─────────────┬─────────────┘
                           │
                           ▼
                 [ Production Pending ]
                           │
                           ▼
                 [ Production In Progress ]
                           │
                           ▼
                 [ Production Completed ]
                           │
                           ▼
                [ Installation Scheduled ]
                           │
                           ▼
                [ Installation In Progress ]
                           │
                           ▼
                [ Installation Completed ]
                           │
                           ▼
                      [ Completed ]
```

### 3.2 Workflow State Transitions

#### 1. Enquiry Received
* **Description**: A new lead is logged in the system.
* **Transition Trigger**: Manual entry by staff or submission via public API.
* **Pre-conditions**: Customer contact details must be valid.
* **Post-conditions**: Order record created with status `Enquiry Received`.
* **Actions Allowed**: Assign lead to sales representative.

#### 2. Site Visit Scheduled
* **Description**: A surveyor is scheduled for an on-site audit.
* **Transition Trigger**: Admin schedules a survey.
* **Pre-conditions**: Surveyor must have an active employee account.
* **Post-conditions**: `site_visits` table row is created.
* **Actions Allowed**: Surveyor logs into mobile app to view assignment.

#### 3. Site Visit In Progress
* **Description**: Surveyor arrives on-site and checks in.
* **Transition Trigger**: Surveyor check-in.
* **Pre-conditions**: Device GPS must be enabled.
* **Post-conditions**: Check-in timestamp recorded.
* **Actions Allowed**: Surveyor begins adding physical locations.

#### 4. Site Visit Completed
* **Description**: Surveyor submits all measurements.
* **Transition Trigger**: Surveyor clicks submit.
* **Pre-conditions**: All physical locations must contain height and width measurements.
* **Post-conditions**: `review_status` set to "Pending Verification".
* **Actions Allowed**: Admin receives notification for audit verification.

#### 5. Site Visit Approved
* **Description**: Admin reviews and approves the survey logs.
* **Transition Trigger**: Admin clicks "Approve Site Survey".
* **Pre-conditions**: All photos and measurements must be verified.
* **Post-conditions**: Order stage transitions to next workflow step.
* **Actions Allowed**: Estimator can begin drafting the quotation.

#### 6. Quotation In Progress
* **Description**: Estimator drafts the project quotation.
* **Transition Trigger**: Order routed to quotation queue.
* **Pre-conditions**: Verified site measurements must be present.
* **Post-conditions**: Quotation draft is saved.
* **Actions Allowed**: Estimator maps product catalogue items to locations.

#### 7. Quotation Sent
* **Description**: Quotation is published to the Customer Portal.
* **Transition Trigger**: Admin clicks "Send to Customer".
* **Pre-conditions**: Quotation grand total must be calculated.
* **Post-conditions**: Magic link sent; client portal access granted.
* **Actions Allowed**: Customer reviews quote online.

#### 8. Quotation Negotiation
* **Description**: Customer declines quotation and requests changes.
* **Transition Trigger**: Customer clicks "Decline / Revise".
* **Pre-conditions**: Rejection reason text must be populated.
* **Post-conditions**: Quotation status set to `Rejected`.
* **Actions Allowed**: Estimator modifies quote; customer buttons disabled.

#### 9. Quotation Approved
* **Description**: Customer approves pricing and terms.
* **Transition Trigger**: Customer clicks "Approve Quotation" and signs.
* **Pre-conditions**: Digital signature must be captured.
* **Post-conditions**: Quotation status set to `Approved`.
* **Actions Allowed**: Order advances to design or production queue.

#### 10. Design In Progress
* **Description**: Designer creates signage layouts.
* **Transition Trigger**: Order routed to design queue.
* **Pre-conditions**: Customer-approved specifications mapped.
* **Post-conditions**: Design record initialized.
* **Actions Allowed**: Designer drafts visual layout mockups.

#### 11. Design Sent
* **Description**: Design proofs uploaded and published to portal.
* **Transition Trigger**: Designer clicks "Publish Design".
* **Pre-conditions**: Uploaded proof must exist in storage bucket.
* **Post-conditions**: Version index incremented.
* **Actions Allowed**: Customer reviews designs.

#### 12. Design Revision Requested
* **Description**: Customer requests visual modifications.
* **Transition Trigger**: Customer clicks "Request Revision".
* **Pre-conditions**: Feedback comments must be logged.
* **Post-conditions**: `designs.status` set to `Revision Requested`.
* **Actions Allowed**: Designer updates drafts based on feedback.

#### 13. Design Approved
* **Description**: Customer approves visual proofs.
* **Transition Trigger**: Customer clicks "Approve Design".
* **Pre-conditions**: Active design version must be locked.
* **Post-conditions**: `designs.status` set to `Approved`.
* **Actions Allowed**: Order advances to fabrication queue.

#### 14. Production Pending
* **Description**: Work order enters the workshop queue.
* **Transition Trigger**: Design and quotation approvals finalized.
* **Pre-conditions**: Substrates and materials verified.
* **Post-conditions**: Job sheet created.
* **Actions Allowed**: Workshop manager schedules fabrication start.

#### 15. Production In Progress
* **Description**: Physical fabrication is active in the workshop.
* **Transition Trigger**: Fabricator starts cutting raw materials.
* **Pre-conditions**: Material procurement checked.
* **Post-conditions**: Milestones updated in database.
* **Actions Allowed**: Staff updates fabrication checkpoints.

#### 16. Production Completed
* **Description**: Signage fabrication and QC completed.
* **Transition Trigger**: QC inspector signs off on the quality checklist.
* **Pre-conditions**: 2-hour burn test completed.
* **Post-conditions**: Signage packed for delivery.
* **Actions Allowed**: Dispatch crew scheduled.

#### 17. Installation Scheduled
* **Description**: On-site installation is scheduled.
* **Transition Trigger**: Admin schedules delivery and mounting.
* **Pre-conditions**: Safety requirements (scaffolding, crane) verified.
* **Post-conditions**: Dispatch crew assigned.
* **Actions Allowed**: Installation team reviews physical structural notes.

#### 18. Installation In Progress
* **Description**: Installation crew mounts the signage on-site.
* **Transition Trigger**: Crew checks in at customer location.
* **Pre-conditions**: Check-in coordinates recorded.
* **Post-conditions**: Installation log active.
* **Actions Allowed**: Crew installs signage and verifies power supply.

#### 19. Installation Completed
* **Description**: Signage mounted and client signature captured.
* **Transition Trigger**: Client signs off on the setup.
* **Pre-conditions**: "After Photos" and signature uploaded.
* **Post-conditions**: Installation status set to `Completed`.
* **Actions Allowed**: Account reconciled.

#### 20. Completed
* **Description**: Order finalized and archived.
* **Transition Trigger**: Payment verified.
* **Pre-conditions**: Outstanding balance set to zero.
* **Post-conditions**: Order archived.
* **Actions Allowed**: Invoicing complete.

---

## 4. Deep Dive - Step-by-Step Operations

### 4.1 On-Site Site Survey Operations

When a Surveyor arrives at the site:
1. **Initialize Audit**: Selects order on mobile app and checks in.
2. **Map Locations**: Adds individual locations (e.g., "Facade North", "Reception Front Desk").
3. **Capture Dimensions**:
   * Measures width, height, depth, and ground clearance.
   * Selects matching units (`ft`, `in`, `mm`, `cm`, `m`) for each dimension.
   * System records the selected units to ensure accurate pricing.
4. **Log Structural Context**:
   * Wall Type: Options include concrete, brick, drywall, wood, glass.
   * Mounting Method: Options include wall mount, flush mount, projected, ceiling suspended, self-standing.
   * Surface Condition: Smooth, uneven, damaged, raw.
   * Structural Obstacles: Pipes, wiring, support beams, HVAC, none.
5. **Electrical Auditing**:
   * Power Source Available: Yes/No.
   * Distance to Power Source: Numeric distance and unit.
   * Electrical notes (e.g., "Requires 10-amp breaker setup").
6. **Photo Documentation**: Captures environment photos.
   * The file upload system supports files up to 50MB.
   * Database storage bucket permissions set `allowed_mime_types` to `NULL` to support vector formats.
7. **Submit survey**: Click "Submit site survey". Stage transitions to `Site Visit Completed`.

---

### 4.2 The Unified Quotation Calculations

The quotation UI uses a single **Qty / Measurement** field for both `per_unit` and `per_sqft` pricing. Running-feet pricing has been removed from products and quotations.

```
                       [ Qty / Measurement input ]
                                 │
                                 ▼
              quantity = totalSqFt = inputValue  (kept in sync)
                                 │
                                 ▼
              amount = getLineMeasurement(line) * unitPrice
```

Site visit dimensions under each signage section show units from `site_visit_measurements` (`width_unit`, `height_unit`, `depth_unit`), mapped via `mapSiteVisitMeasurementFromDb` / `formatSiteMeasurementLabel`.

#### Formula Implementations
* **All pricing types** (`per_unit`, `per_sqft`): `amount = measurement * unitPrice`
* **Measurement resolution** (`getLineMeasurement`): prefer `quantity` when set; fall back to legacy `totalSqFt` when quantity was forced to `1`
* **GST Calculation**: `gst = amount * (gstRate / 100)`
* **Total Line**: `lineTotal = amount + gst`

Shared helpers live in `src/features/quotations/utils/lineAmount.ts`.

#### Global Calculation Sequence
Server and client share `computeQuotationTotals()` in `lineAmount.ts`:

```typescript
// subtotal = sum of line amounts (ex-GST)
// tax = totalGst * (1 - discount/subtotal) when subtotal > 0; discount clamped to [0, subtotal]
// grand_total = subtotal - discount + tax + shipping
```

`upsertQuotation` always persists server-computed totals; client preview uses the same formulas.

---

### 4.3 Customer Portal Revision & State Handlers

When a customer declines a quotation:
1. **Submit Feedback**: Click "Decline / Revise", input revision details, and submit.
2. **Server Action**: `customerRequestRevision` validates portal session, requires `status === "Sent"`, sets `Rejected`, `rejection_reason`, `customer_response = "Revision"`, and `orders.stage = "Quotation Negotiation"`.
3. **UI Updates (Client)**:
   * Action buttons hidden after submission.
   * Status badges update to `"Sent for Revision"`.
   * Banner: `"Sent for Revision: We have received your feedback and are revising..."`
4. **UI Updates (Staff)**: Order shows in `Quotation Negotiation` on the admin panel.

Portal quotation reads and writes use **service role** after token/session validation — no anon RLS on `quotations`.

---

### 4.4 Design Blueprints & Revision Loops

The design phase handles visual asset review:
1. **Upload Mockup**: Designer uploads mockups.
   * Supported formats: `.cdr`, `.dxf`, `.plt`, `.pdf`, `.svg`, `.png`, `.jpg`.
2. **Customer Comments**: Customer views mockups in portal and can leave comments.
3. **Revision Flow**:
   * Request Revision: Status set to `Revision Requested`.
   * Designer uploads new proof version; version counter increments.
4. **Approval**: Customer clicks "Approve Design". Proofs are locked against further changes.

---

### 4.5 Manufacturing Job Cards

Workshop fabrication milestones:
* **Procurement**: Sourcing materials (acrylic, LED modules, baseboard materials).
* **Laser Cutting**: Laser/CNC routing of substrates.
* **Frame Assembly**: Constructing baseboards and mounting brackets.
* **LED Wiring**: Wiring LEDs and verifying safety requirements.
* **Finishing**: Cleaning, wrapping, and vinyl overlays.
* **QC Testing**: 2-hour continuous lighting check.

---

### 4.6 On-Site Delivery & Sign-off

Installation crew mounting:
1. **Safety Checks**: Crew checks scaffolding and crane requirements before dispatch.
2. **Mounting**: Crew mounts the sign.
3. **Handoff & Signature**:
   * Crew uploads "After Photos" showing the sign mounted and powered.
   * Customer inspects the sign and signs directly on the tablet screen.
   * Signature is saved as an image in the storage bucket.
   * Stage progresses to `Completed`.

---

## 5. Master Schema Catalog Reference

This section details all tables in the database schema.

### 5.1 Tables

#### 1. `companies`
Groups all data under a single tenant.
* `id` (uuid, PK): Unique company ID.
* `name` (varchar): Corporate name.
* `created_at` (timestamp)

#### 2. `users`
Internal staff details linked to auth identities.
* `id` (uuid, PK): Linked to Supabase Auth `users.id`.
* `company_id` (uuid, FK -> `companies.id`): Tenant isolation key.
* `employee_id` (varchar): Sequential ID scoped per company (e.g. E001).
* `name` (varchar): Full name.
* `staff_role` (varchar): "Admin", "Designer", "Estimator", "Field Agent", "Installer".
* `phone` (varchar)
* `email` (varchar)
* `status` (varchar): "Active", "Inactive".
* `rating` (numeric): Field agent performance rating.
* `workload` (integer): Number of active orders assigned.

#### 3. `customers`
The global CRM customer directory.
* `id` (uuid, PK)
* `company_id` (uuid, FK -> `companies.id`)
* `customer_id` (varchar): Unique code (e.g. CUST-104)
* `name` (varchar): Main contact name.
* `business_name` (varchar): Corporate entity billing name.
* `phone` (varchar)
* `whatsapp` (varchar)
* `email` (varchar)
* `billing_address` (text)
* `shipping_address` (text)
* `status` (varchar): "Active", "Inactive"

#### 4. `enquiries`
Leads logged into the system.
* `id` (uuid, PK)
* `company_id` (uuid, FK -> `companies.id`)
* `customer_id` (uuid, FK -> `customers.id`)
* `enquiry_id` (varchar): Auto-generated lead ID (e.g. ENQ-059).
* `source` (varchar): "Web", "Walk-in", "Referral", "Cold Call".
* `requirements` (text)
* `status` (varchar): "New", "Contacted", "Qualified", "Converted", "Lost".
* `created_at` (timestamp)

#### 5. `orders`
The central hub for all active and historical signage projects.
* `id` (uuid, PK)
* `company_id` (uuid, FK -> `companies.id`)
* `order_id` (varchar): Unique tracking ID (e.g. PR-002)
* `customer_id` (uuid, FK -> `customers.id`)
* `project_name` (varchar): Name of the signage project.
* `stage` (varchar): Enum representing current phase (e.g., "Quotation In Progress").
* `stage_status` (varchar): Lifecycle lock state. Values include `"Normal"` and `"Pending Admin Approval: …"`.
* `workflow_type` (varchar): "quote_first" or "design_first".
* `budget` (numeric)
* `deposit_paid` (numeric)
* `lost_reason` (text): Reason populated if stage is transitioned to "Lost".
* `created_at` (timestamp)

> **Note:** Design artefacts are **not** stored on `orders`. They live in the dedicated `designs` table (one row per order). Payment milestones live in the `payments` table.

#### 6. `site_visits`
Site visit details for an order.
* `id` (uuid, PK)
* `order_id` (uuid, FK -> `orders.id`)
* `assigned_agent_id` (uuid, FK -> `users.id`)
* `scheduled_date` (date)
* `completed` (boolean)
* `audit_date` (date): The actual date the audit took place.
* `scaffolding_required` (boolean)
* `crane_required` (boolean)
* `overnight_installation` (boolean)
* `review_status` (varchar): "Pending Verification", "Verified".

#### 7. `site_visit_measurements`
Individual locations and dimensions recorded during the site survey.
* `id` (uuid, PK)
* `site_visit_id` (uuid, FK -> `site_visits.id`)
* `name` (varchar): Location label (e.g., "Main Entrance").
* `width` (numeric)
* `width_unit` (varchar): "ft", "in", "mm".
* `height` (numeric)
* `height_unit` (varchar): "ft", "in", "mm".
* `depth` (numeric)
* `depth_unit` (varchar): "ft", "in", "mm".
* `ground_clearance` (numeric)
* `ground_clearance_unit` (varchar): "ft", "in", "mm".
* `notes` (text)
* `photos` (jsonb): Array of file URLs.
* `power_available` (boolean)
* `distance_to_power_source` (numeric)
* `distance_to_power_source_unit` (varchar)
* `electrical_notes` (text)
* `wall_type` (varchar)
* `mounting_method` (varchar)
* `surface_condition` (varchar)
* `obstacles` (jsonb): List of identified obstacles.
* `structural_notes` (text)

#### 8. `quotations`
* `id` (uuid, PK)
* `order_id` (uuid, FK -> `orders.id`)
* `quotation_id` (varchar): Unique code (e.g. QT-048).
* `status` (varchar): "Draft", "Sent", "Approved", "Rejected", "Negotiation".
* `subtotal` (numeric)
* `discount` (numeric)
* `tax` (numeric): GST sum.
* `shipping` (numeric)
* `grand_total` (numeric)
* `notes` (text): Terms or details.
* `terms` (text): Contractual rules.
* `signage_options` (jsonb): Highly structured array representing quotes mapped to site items.
* `rejection_reason` (text): Saved comments if customer declined.

#### 9. `designs`
Dedicated design record per order (extracted from legacy `orders.design_details`).
* `id` (uuid, PK)
* `order_id` (uuid, FK -> `orders.id`, **unique**)
* `resources` (jsonb): Inspiration/logo uploads `[{ id, url, name, type, uploadedBy, createdAt }]`
* `items` (jsonb): Multi-item design proofs `[{ id, name, versions[], currentVersion, productionFiles[] }]`
* `created_at` (timestamptz)
* `updated_at` (timestamptz)

Frontend maps this to `order.design` (`DesignRecord`). Server actions: `src/features/designs/actions/designActions.ts`.

#### 9b. `payments`
Financial tracking only (does **not** block stage progression). See `specs/payments.md`.
* `id` (uuid, PK)
* `order_id` (uuid, FK -> `orders.id` ON DELETE CASCADE)
* `payment_name` (text)
* `trigger_stage` (text): Optional note of order stage when recorded
* `amount_type` (text): `"fixed"` | `"percentage"`
* `amount` (numeric): Fixed amount when `amount_type = fixed`
* `percentage` (numeric): Percent of quotation `grand_total` when `amount_type = percentage`
* `calculated_amount` (numeric): Resolved amount
* `status` (text): `"expected"` | `"received"`
* `notes` (text)
* `paid_at` (timestamptz)
* `created_at`, `updated_at` (timestamptz)

Indexes: `order_id`, `status`, `trigger_stage`.

Server actions: `src/features/payments/actions/paymentActions.ts`.

#### 10. `productions`
* `id` (uuid, PK)
* `order_id` (uuid, FK -> `orders.id`)
* `milestones` (jsonb): Key-value state of fabrication checks.
* `deadline` (timestamptz): Admin-editable deadline for production.
* `status` (varchar): "Pending", "In Progress", "Completed".
* `notes` (text)
* `completed_at` (timestamp)

#### 11. `installations`
* `id` (uuid, PK)
* `order_id` (uuid, FK -> `orders.id`)
* `assigned_crew_ids` (jsonb): List of employee IDs.
* `scheduled_date` (date)
* `status` (varchar): "Scheduled", "In Progress", "Completed".
* `before_photos` (jsonb)
* `after_photos` (jsonb)
* `customer_signature_url` (varchar): Path to signature PNG image in storage bucket.

#### 12. `order_activity`
Timeline and activity log.
* `id` (uuid, PK)
* `order_id` (uuid, FK -> `orders.id`)
* `actor_name` (varchar): Who triggered the change (e.g. Customer, System, Admin Name).
* `action_type` (varchar): "Status Update", "Upload", "Approval", "Revision Request", "Comment".
* `notes` (text): Description of what took place.
* `created_at` (timestamp)

#### 13. `portal_access_tokens`
Handles secure password-less client entry.
* `id` (uuid, PK)
* `order_id` (uuid, FK -> `orders.id`)
* `token` (varchar): Crytographically strong secure token.
* `expires_at` (timestamp)
* `created_at` (timestamp)

#### 14. `products`
Standardized product catalog.
* `id` (uuid, PK)
* `company_id` (uuid, FK -> `companies.id`)
* `product_id` (varchar): Product ID code.
* `name` (varchar): Name of the product.
* `category` (varchar): Product category.
* `pricing_type` (varchar): `"per_sqft"` | `"per_unit"` | `"Multiple"` (running-feet pricing removed).
* `is_active` (boolean)
* `price_per_sqft` (numeric)
* `price_per_unit` (numeric)
* `images` (jsonb)

---

## 6. Complete API & Server Actions Catalog

Below is the complete catalog of all Server Actions implemented in the system, providing exact TypeScript definitions and functional descriptions.

### 6.1 Quotation Module Actions
Defined in `src/features/quotations/actions/quotationActions.ts`.

| Action | Purpose |
| ------ | ------- |
| `getQuotationByOrderId` | Staff read single quotation by order |
| `getCustomerVisibleQuotationForOrder` | Portal SSR — returns null for Draft / Pending Approval |
| `getSiteVisitMeasurementsForOrder` | Site visit measurements for quotation sections |
| `upsertQuotation` | Create/update quotation; server recomputes totals via `computeQuotationTotals` |
| `sendQuotationToCustomer` | Admin send — requires `Pending Approval` or `Rejected` |
| `adminMarkQuotationApprovedAction` | Admin override approve without customer |
| `customerApproveQuotation` | Portal approve when `Sent` (session + service role) |
| `customerRequestRevision` | Portal decline/revise when `Sent` (session + service role) |

Path revalidation: `src/features/orders/actions/revalidateOrderPaths.ts` (sync helpers); `revalidateOrderPathsAction` in `orderActions.ts` for portal mutations.

Removed: `getAllQuotations`, legacy `approveQuotation` / `declineQuotation` direct portal updates.

---

### 6.1b Design Module Actions
Defined in `src/features/designs/actions/designActions.ts`.

| Action | Purpose |
| ------ | ------- |
| `getDesignByOrderId` | Load `designs` row for an order |
| `createDesignForOrderAction` | Upsert empty design row (also on order create) |
| `updateDesignDetailsAction` | Update `resources` / `items` JSONB |
| `sendDesignToCustomerAction` | Mark draft versions as Sent to Customer |
| `approveAllDesignItemsAction` | Approve latest versions; advance stage when all approved |

### 6.1c Payment Tracking Actions
Defined in `src/features/payments/actions/paymentActions.ts`. Payments are **financial records only** and do not block stages. See `specs/payments.md`.

| Action | Purpose |
| ------ | ------- |
| `createPayment` | Create expected (or received) record |
| `markPaymentReceived` / `markPaymentExpected` | Toggle received status |
| `deletePayment` / `updatePayment` | Remove or edit a record |
| `getPaymentsByOrder` / `getPaymentBalanceSummary` | List records / totals |
| `calculatePaymentAmount` | Fixed amount or `quotation.grand_total * percentage / 100` |

---

### 6.2 Customer Module Actions
Defined in `src/features/customers/actions/customerActions.ts`.

#### `getCustomers`
Returns all customers registered in the tenant database.
```typescript
export async function getCustomers(): Promise<Customer[]>;
```

#### `createCustomer`
Creates a new customer profile.
```typescript
export async function createCustomer(payload: Omit<Customer, "id" | "created_at">): Promise<Customer>;
```

#### `updateCustomer`
Modifies an existing customer directory record.
```typescript
export async function updateCustomer(id: string, patch: Partial<Customer>): Promise<boolean>;
```

---

### 6.3 Enquiry Module Actions
Defined in `src/features/enquiries/actions/enquiryActions.ts`.

#### `createEnquiry`
Logs a new enquiry lead.
```typescript
export async function createEnquiry(payload: Partial<Enquiry>): Promise<Enquiry>;
```

#### `updateEnquiryStatus`
Updates the status of an enquiry.
```typescript
export async function updateEnquiryStatus(id: string, status: string): Promise<boolean>;
```

---

### 6.4 Order Pipeline Actions
Defined in `src/features/orders/actions/orderActions.ts`.

#### `createOrder`
Initializes a new order pipeline record.
```typescript
export async function createOrder(payload: Partial<Order>): Promise<Order>;
```

#### `updateOrderStage`
Moves an order to a new pipeline stage.
```typescript
export async function updateOrderStage(orderId: string, stage: string, notes?: string): Promise<boolean>;
```

#### `updateOrderStageStatus`
Modifies the stage lock status (e.g. "Pending Admin Approval").
```typescript
export async function updateOrderStageStatus(orderId: string, status: string): Promise<boolean>;
```

---

### 6.5 Graphic Design Actions
Defined in `src/features/designs/actions/designActions.ts`.

#### `uploadDesignProof`
Saves graphic layout blueprints for customer review.
```typescript
export async function uploadDesignProof(orderId: string, fileUrl: string, designerId: string): Promise<boolean>;
```

#### `submitDesignFeedback`
Saves customer comments or revision requests.
```typescript
export async function submitDesignFeedback(designId: string, feedback: string, requestRevision: boolean): Promise<boolean>;
```

---

### 6.6 Field Installation Actions
Defined in `src/features/installations/actions/installationActions.ts`.

#### `scheduleInstallation`
Schedules installation dates and assigns crew resources.
```typescript
export async function scheduleInstallation(orderId: string, date: string, crewIds: string[]): Promise<boolean>;
```

#### `completeInstallation`
Logs physical installation completion.
```typescript
export async function completeInstallation(orderId: string, afterPhotos: string[], signatureUrl: string): Promise<boolean>;
```

---

### 6.7 Magic-Link Portal Actions
Defined in `src/features/portal/actions/portalAdminActions.ts`.

#### `generatePortalToken`
Generates a cryptographically strong magic-link access token.
```typescript
export async function generatePortalToken(orderId: string): Promise<string>;
```

#### `verifyPortalToken`
Verifies magic-link tokens.
```typescript
export async function verifyPortalToken(token: string): Promise<{ orderId: string; isValid: boolean }>;
```

---

## 7. Row Level Security (RLS) Policy Configurations

To ensure strict tenant isolation, all tables in the database employ Row Level Security (RLS) policies.

```sql
-- Enable RLS on all tables
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_visit_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.designs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_access_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
```

### 7.1 Security Policies

#### User Management Policies
Allows users to read all profiles inside the same company tenant.
```sql
CREATE POLICY user_read_policy ON public.users
    FOR SELECT
    USING (company_id = (SELECT company_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY user_write_policy ON public.users
    FOR ALL
    USING (company_id = (SELECT company_id FROM public.users WHERE id = auth.uid()) 
           AND (SELECT staff_role FROM public.users WHERE id = auth.uid()) = 'Admin');
```

#### Order Tracking Policies
Restricts access to orders belonging to the same tenant company.
```sql
CREATE POLICY order_read_policy ON public.orders
    FOR SELECT
    USING (company_id = (SELECT company_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY order_write_policy ON public.orders
    FOR ALL
    USING (company_id = (SELECT company_id FROM public.users WHERE id = auth.uid()));
```

#### Customer Portal Policies
Allows customers to view details of their own orders via portal magic tokens.
```sql
CREATE POLICY customer_portal_order_policy ON public.orders
    FOR SELECT
    USING (id IN (SELECT order_id FROM public.portal_access_tokens WHERE token = current_setting('request.jwt.claims', true)::json->>'portal_token'));
```

---

## 8. Frontend Design System & Client State Synchronization

The frontend implements React and Tailwind CSS.

### 8.1 State Sync Pattern
To prevent stale states, components use state synchronization wrappers:

```typescript
import { useEffect, useState } from "react";

export default function SyncContainer({ initialData, orderId }) {
  const [data, setData] = useState(initialData);

  // Sync state if server component revalidates and returns fresh props
  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  return (
    <div>
      <h3>Project: {data.projectName}</h3>
      <p>Stage: {data.stage}</p>
    </div>
  );
}
```

---

## 9. Troubleshooting & FAQ

### 9.1 MIME Type Upload Errors
* **Issue**: Error uploading `.cdr` or `.dxf` layout blueprints.
* **Resolution**: Bucket permissions must allow `NULL` mime-types. Reset standard bucket rules on the storage database configuration.

### 9.2 Stale Portal State
* **Issue**: Portal changes do not display unless the customer refreshes manually.
* **Resolution**: Use Next.js Server Actions `revalidatePath` to trigger state synchronization on the client.

---

## 10. Codebase Layout & Component Map

The Printec OMS implementation is structured to separate concern layers cleanly between data models, server execution, and front-end interface rendering.

### 10.1 Key Repository Path Directory

```
printec/
├── specs/                            # Markdown functional specifications
│   ├── README.md                     # Master system specification
│   ├── customer-enquiry.md           # Lead pipeline detailed rules
│   ├── site-visit.md                 # Surveyor application specifications
│   ├── quotation.md                  # Cost calculator specifications
│   ├── customer-approval.md          # Customer portal sign-off specs
│   ├── production.md                 # Manufacturing milestones specs
│   ├── installation.md               # Field mounting & delivery specs
│   ├── customer-portal.md            # Client secure magic-link portal specs
│   ├── admin-dashboard.md            # Staff interface specifications
│   ├── designer-workflow.md          # CAD blueprint verification specs
│   └── reporting.md                  # Revenue & analytics specifications
│
├── supabase/                         # Database schema migrations & configurations
│   ├── config.toml                   # Local Supabase local stack parameters
│   └── migrations/                   # SQL migration files
│       ├── 20260702000000_init.sql   # Initial schema base script
│       └── 20260704000000_update_site_visit_photos_bucket.sql # Bucket fix
│
├── src/
│   ├── app/                          # Next.js App Router Page components
│   │   ├── admin/                    # Admin Dashboard routes
│   │   ├── staff/                    # Field & Estimator routes
│   │   └── portal/                   # Customer password-less portal routes
│   │       ├── order/                # Alphanumeric order details pages
│   │       │   └── [orderId]/
│   │       │       ├── page.tsx      # Detail page entry (fetches data)
│   │       │       └── OrderDetailClient.tsx # Client interactive wrapper
│   │       ├── page.tsx              # Portal dashboard entry (fetches list)
│   │       └── PortalClient.tsx      # Dashboard client interactive wrapper
│   │
│   ├── features/                     # Independent operational domain slices
│   │   ├── auth/                     # Magic link JWT generation & security
│   │   ├── order-detail/             # Complex UI tabs for order parameters
│   │   │   └── components/
│   │   │       ├── quotation/
│   │   │       │   ├── QuotationModule.tsx # Staff cost spreadsheet
│   │   │       │   └── ProductSearch.tsx   # Fast product catalog lookup
│   │   │       └── design/
│   │   │           └── DesignTab.tsx # Design proofs feedback tab
│   │   ├── orders/                   # Order creation & stage overrides
│   │   ├── site-visits/              # Surveyor mobile pages
│   │   ├── products/                 # Catalogue price setup
│   │   └── customers/                # CRM customer listings
│   │
│   └── types/
│       └── index.ts                  # Shared TS interface definitions
```

### 10.2 Core Component Breakdown

#### `QuotationModule.tsx`
* **Purpose**: Primary worksheet editor for estimating managers to draft quotes.
* **Layout Grid**: CSS Grid (`1fr 105px 120px 105px 40px 90px 28px`) coordinates column headers for Item Description, Unit Type, Measurement/Qty, Rate, GST %, Total Amount, and Actions.
* **Component Dependencies**: Employs `ProductSearch` autocomplete inputs for product association.

#### `OrderDetailClient.tsx`
* **Purpose**: Host container representing the customer's portal for a specific order.
* **Features**: Coordinates client tabs. Renders the amber banner for quotations currently sent for revision.
* **Props Mapping**: Consumes mapped `siteVisitItems` (incorporating units) and `initialQuotation` records passed from Server Page nodes.

#### `PortalClient.tsx`
* **Purpose**: Customer portal landing dashboard listing all orders associated with a customer token.
* **Features**: Displays active milestones, maps location measurements, and links to specific order workspaces.

---

## 11. Developer Onboarding & Runbook

### 11.1 Local Sandbox Launch
1. **Clone Repository**:
   ```bash
   git clone git@github.com:printec/printec-oms.git
   cd printec-oms
   ```
2. **Install Dependencies**:
   ```bash
   npm install
   ```
3. **Initialize Database**: Ensure Docker is running.
   ```bash
   supabase start
   supabase db reset
   ```
4. **Start Dev Server**:
   ```bash
   npm run dev
   ```

### 11.2 Verification Runbook
Before committing code, verify compilation and formatting:
```bash
# Run TypeScript compilation check
npx tsc --noEmit

# Run code linter
npm run lint

# Execute test suite
npm run test
```

---

## 12. Change Log & Specification History

| Version | Date | Author | Description of Changes |
| ------- | ---- | ------ | ---------------------- |
| 1.0 | 2026-07-02 | Lead Architect | Initial release detailing core Enquiry and Site Survey modules. |
| 1.1 | 2026-07-03 | Lead Architect | Added Quotation Calculations, GST Tax Rules, and Stage Locks. |
| 1.2 | 2026-07-04 | Core Developer | Documented the merged Measurement/Qty column, dynamic site units mapping, vector file uploads bucket fix, and the Portal revision state warning panel. |
| 1.3 | 2026-07-04 | Core Developer | Designs extracted to `designs` table (`order.design`); site measurement units on quotation; unified Qty/Measurement (removed running feet); payments as financial tracking only (`expected` / `received`, no stage gates). |
| 1.4 | 2026-07-07 | Core Developer | Quotation security pass: server-side totals, portal server actions, anon RLS removed from `quotations`, unified `QuotationTab`, admin review gate, scoped path revalidation. See `specs/quotation.md` v2.2. |

---
*End of Master Specification Document.*
