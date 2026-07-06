# Site Visit Feature Specification

> **Source of truth:** codebase as of 2026-07-06. This document describes implemented behavior, not planned behavior.

## Overview

The Site Visit workflow collects scheduling information, on-site measurements, per-location electrical/structural assessments, installation/fabrication flags, and reference photos before the order moves into Quotation or Design.

**Business goal:** Ensure accurate field data is captured and admin-reviewed before quote/design work begins.

**Roles involved:** Customer (portal scheduling), Staff (field audit + freeze), Admin (workflow choice + stage advancement).

## Business Goal

- Confirm when and where the physical site visit happens.
- Record one or more signage locations with dimensions, photos, and site conditions.
- Lock audit data and require admin sign-off before Quote or Design starts.
- Feed `site_visit_measurements` rows into Quotation, Design, and Production UIs as `siteVisitItems`.

## Workflow

### End-to-end (implemented)

1. **Order enters Site Visit Pending** — created from enquiry conversion (`enquiryActions`) or manual order creation with `stage: "Site Visit Pending"`. No `site_visits` row exists until scheduling or first save.

2. **Schedule visit** — Customer (portal) or Staff (`SiteVisitModule` → “Schedule by yourself”) calls `scheduleSiteVisitAction`:
   - Upserts `site_visits` with `audit_date`, `audit_time`, `customer_address`, `gps_location`, `review_status: "Pending"`, `completed: false`.
   - Sets `orders.stage = "Site Visit Scheduled"`, `orders.stage_status = "Normal"`.
   - Writes timeline activity and sends WhatsApp `site_visit_scheduled`.
   - **No staff approval step. No admin approval for scheduling.**

3. **Optional: Skip visit** — Staff clicks “Skip Visit & Add Values” (`OrderWorksheetModal`):
   - `updateSiteVisitDetailsAction` with synthetic address `"Skipped - Direct Measurement (Manual Entry)"`, current date/time, `gpsLocation: "N/A"`.
   - `updateOrderStageAction` → `Site Visit Scheduled`.
   - UI shows amber “Site Visit Skipped” banner when address starts with `"Skipped"`.

4. **Field audit & data entry** — Staff on `Site Visit Scheduled` (stage name does not change during audit):
   - Edits flow through local React state (`onUpdate` → parent `setOrder`); persisted on **Save Draft** via `updateSiteVisitDetailsAction`.
   - Per-location measurements, electrical, structural, and photos are stored on `site_visit_measurements`.
   - Order-level installation/fabrication/design-input flags stored on `site_visits` (mapper fields — see Database Tables).
   - Photos upload client-side to Supabase Storage bucket `site-visit-photos`.

5. **Freeze / request completion** — Staff clicks **Push for Approval** on Site Visit tab:
   - Opens `SiteVisitReviewModal` (does **not** call `requestStageAdvancementAction`).
   - On confirm: `freezeSiteVisitAction`:
     - `site_visits.completed = true`
     - `orders.stage_status = "Pending Admin Approval: Site Visit Completed"`
     - `orders.stage` is **unchanged** (typically remains `Site Visit Scheduled`)
     - Timeline + WhatsApp `site_visit_completed`
   - Module becomes read-only (`isFrozen`) unless admin unlocks “God Mode”.

6. **Admin approval & workflow choice** — `AdminControlModule` shows pending approval when `stage_status !== "Normal"`:
   - For orders in any `Site Visit*` stage: **Choose Workflow & Approve** opens `WorkflowChoiceModal`.
   - `setWorkflowTypeAction("quote_first" | "design_first")`:
     - Persists `orders.workflow_type`
     - Advances `orders.stage` to `Quotation In Progress` or `Design In Progress`
     - Sets `orders.stage_status = "Normal"`
   - Does **not** use `adminApproveStageAction` for this path.

7. **Downstream** — `site_visit_measurements` rows are passed as `siteVisitItems` into Quotation, Design, Production, and portal views.

### Alternate / unused paths (present in code, not wired in UI)

| Action | Behavior | Status |
|--------|----------|--------|
| `approveSiteVisitAction` | Sets `review_status: "Staff Approved"`, `stage_status: "Pending Admin Approval: Site Visit Schedule"` | **Dead code** — imported in `OrderWorksheetModal` but never called |
| `requestStageAdvancementAction` (Site Visit stages) | Would set `stage_status: "Pending Admin Approval: Site Visit Completed"` without freezing | **Bypassed** — Site Visit tab uses review modal + `freezeSiteVisitAction` instead |
| `orders.stage = "Site Visit Completed"` | Referenced in stage maps and queue filters | **Never assigned** by any server mutation |

## Workflow States

### `orders.stage` (pipeline)

| Stage | Meaning in practice | How reached |
|-------|---------------------|-------------|
| `Site Visit Pending` | Awaiting schedule | Enquiry conversion / new order |
| `Site Visit Scheduled` | Schedule set (or skipped); audit in progress or frozen pending admin | `scheduleSiteVisitAction`, skip flow, or `updateOrderStageAction` |
| `Site Visit Completed` | Listed in UI/maps/queues | **Not set by current mutations** — legacy label only |

### `orders.stage_status` (approval lock)

| Value | Meaning | How reached | Cleared by |
|-------|---------|-------------|------------|
| `Normal` | No pending admin lock | Default; after scheduling | — |
| `Pending Admin Approval: Site Visit Schedule` | Staff approved customer schedule | `approveSiteVisitAction` only | **Unused in UI** |
| `Pending Admin Approval: Site Visit Completed` | Audit frozen, awaiting admin | `freezeSiteVisitAction` | `setWorkflowTypeAction` |

### `site_visits.completed`

| Value | Meaning |
|-------|---------|
| `false` | Audit editable |
| `true` | Audit frozen (`freezeSiteVisitAction`); UI read-only unless admin override |

### `site_visits.review_status`

Values used: `"Pending"` (on schedule), `"Staff Approved"` (`approveSiteVisitAction` only — unused in UI).

## Business Rules

- Customer/staff scheduling requires date, time slot, and address (portal form + `ScheduleVisitModal`).
- **Push for Approval** on Site Visit tab requires `auditDate` + `auditTime` and at least one location in `locations[]` (`OrderWorksheetModal` validation).
- Scheduling moves stage to `Site Visit Scheduled` immediately with `stage_status: Normal` — no internal review gate.
- Freezing sets `completed = true` and pending admin lock; does **not** change `orders.stage`.
- Admin must choose `quote_first` or `design_first` before leaving Site Visit phase (via `setWorkflowTypeAction`).
- Removed measurement rows are **not** deleted from DB on save — only upsert of current array; orphans possible.
- Queue list pages display `Site Visit Pending` when stage is `Site Visit Scheduled`/`Completed` but `auditDate` is missing (display-only heuristic).
- Staff site-visit queue (`/staff/site-visit`) shows orders assigned to the logged-in user in Site Visit stages only.

## User Permissions

### Customer (portal)

- View order and schedule/reschedule site visit via `scheduleSiteVisitAction`.
- Read-only view of scheduled visit details and aggregated photos after scheduling.
- No access to staff audit form, freeze, or admin controls.
- Portal auth: magic-link session cookie (`portal_session`); server actions for schedule do **not** currently call `assertStageEditOrPortalOrder`.

### Staff

**Stage grant** (`stageGrants.ts` → `resolveStagePermission("site_visit")`):

| Role / tenant | `site_visit` grant |
|---------------|-------------------|
| Admin | All stages |
| Designer | Yes |
| Marketer | Yes |
| Installation (default tenant) | Yes |
| Installation (Printec tenant override) | No — installation only |
| Recce & Installation (Board tenant) | Yes |

**Server mutations with `assertStageEditPermission("site_visit")`:**

- `updateSiteVisitDetailsAction`
- `freezeSiteVisitAction`
- `approveSiteVisitAction` (unused in UI)

**Not gated by stage permission:**

- `scheduleSiteVisitAction` (used by portal and staff UI)
- `updateOrderStageAction` (used for skip flow)

**Queue access:** Staff site-visit page filters `assigned_employees.includes(currentUser.id)`.

### Admin

- All staff capabilities plus admin override unlock on frozen `SiteVisitModule`.
- Approve frozen site visit via **Choose Workflow & Approve** → `setWorkflowTypeAction`.
- `adminApproveStageAction` available for other stages; on Site Visit tab with `stage_status: Normal`, admin **Approve & Advance** opens review modal (same freeze path as staff).

**Note:** `adminApproveStageAction` and `setWorkflowTypeAction` do not call `assertAdminOnly()` — authorization is UI-only today.

## Database Tables

### `site_visits`

One row per order (`UNIQUE(order_id)`). Created on first schedule or first `updateSiteVisitDetailsAction`.

| Column | Type | Used by UI / mapper |
|--------|------|---------------------|
| `id` | uuid PK | Internal |
| `order_id` | uuid FK → `orders.id` | Upsert key |
| `company_id` | uuid FK | Tenant isolation (RLS) |
| `customer_address` | text | Schedule / skip |
| `landmark` | text | Schedule |
| `preferred_date` / `preferred_time` | text | Legacy; schedule writes `audit_*` |
| `gps_location` | text | `"lat, lng"` string |
| `audit_date` / `audit_time` | text | Confirmed schedule |
| `internal_notes` | jsonb | Mapper only; **no UI section** (removed from module) |
| `review_status` | text | Schedule / unused approve action |
| `completed` | boolean | Freeze flag |
| `scaffolding_required` | boolean | **Mapper + UI — no migration in repo** |
| `crane_required` | boolean | Same |
| `overnight_installation` | boolean | Same |
| `extra_angles_required` / `extra_angles_length` | boolean / text | Same |
| `extra_acp_sheet_required` | boolean | Same |
| `old_board_removal_required` | boolean | Same |
| `extra_wire_required` | boolean | Same |
| `design_brief_available` | text | `"Yes"` \| `"No"` \| `"Later"` |
| `fabrication_required` / `civil_work_required` | boolean | Design inputs section |
| `power_available`, `wall_type`, `photo_categories`, etc. | various | **Legacy columns** from initial migration; root-level electrical/photos superseded by per-location fields on `site_visit_measurements` |

### `site_visit_measurements`

Child rows per signage item/location.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | Client generates UUID for new items |
| `site_visit_id` | uuid FK | Parent visit |
| `name` | text | Item label |
| `width`, `height`, `depth`, `ground_clearance` | numeric | |
| `width_unit`, `height_unit`, `depth_unit`, `ground_clearance_unit` | text | Default `"ft"` |
| `notes` | text | |
| `photos` | jsonb | Array of public URLs |
| `power_available` | boolean | Per-location electrical |
| `distance_to_power_source` | numeric | |
| `distance_to_power_source_unit` | text | |
| `electrical_notes` | text | |
| `wall_type`, `mounting_method`, `surface_condition` | text | Structural |
| `obstacles` | jsonb | string array |
| `structural_notes` | text | |

### `orders` (site-visit-relevant)

| Column | Role |
|--------|------|
| `stage` | Pipeline position |
| `stage_status` | Admin approval lock |
| `workflow_type` | `"quote_first"` \| `"design_first"` — set at admin approval |
| `assigned_employees` | Via `order_assignments` — queue filtering |

### RLS

- Authenticated staff: tenant-scoped via `company_id = current_company_id()` (`20260704000011_tenant_isolation_rls.sql`).
- Portal anon: `SELECT` on `site_visits` and `site_visit_measurements` for realtime (`20260706130000_order_detail_realtime.sql`).

### Realtime publication

`site_visits`, `site_visit_measurements` added to `supabase_realtime` publication for order-detail sync.

## Storage Structure

**Bucket:** `site-visit-photos`

| Setting | Value |
|---------|-------|
| Path pattern | `{orderUuid}/{timestamp}-{random}.{ext}` |
| Access | Public URL via `getPublicUrl` |
| MIME / size | All types allowed, 50MB limit (`20260704000000_update_site_visit_photos_bucket.sql`) |
| Upload | Client-side (`SiteVisitModule`); also used by Design module for proofs |
| Delete | On photo remove in UI — storage `remove` + URL removed from measurement `photos` jsonb |
| Orphans | No server-side cleanup when measurement rows deleted |

## Server Actions

All in `src/features/orders/actions/orderActions.ts` unless noted.

| Action | Auth | Mutations | Side effects |
|--------|------|-----------|--------------|
| `scheduleSiteVisitAction(orderId, scheduleData)` | **None** | Upsert `site_visits`; `orders.stage → Site Visit Scheduled`, `stage_status → Normal` | Timeline, WhatsApp, revalidate queues |
| `updateSiteVisitDetailsAction(orderId, details)` | `assertStageEditPermission("site_visit")` | Upsert `site_visits`; upsert `site_visit_measurements` | Revalidate detail + portal paths; **no timeline entry** |
| `approveSiteVisitAction(orderId)` | `assertStageEditPermission("site_visit")` | Upsert `review_status: Staff Approved`; `stage_status → Pending Admin Approval: Site Visit Schedule` | Timeline; **unused in UI** |
| `freezeSiteVisitAction(orderId)` | `assertStageEditPermission("site_visit")` | `site_visits.completed → true`; `stage_status → Pending Admin Approval: Site Visit Completed` | Timeline, WhatsApp, revalidate |
| `setWorkflowTypeAction(orderId, workflowType)` | **None** | `workflow_type`, `stage → Quotation/Design In Progress`, `stage_status → Normal` | Timeline, WhatsApp |
| `adminApproveStageAction(orderId)` | **None** | Generic stage map advance, `stage_status → Normal` | Timeline, WhatsApp — not used for site-visit freeze approval |
| `updateOrderStageAction(id, stage)` | **None** | Manual stage change | Timeline if changed; used by skip flow |
| `requestStageAdvancementAction(orderId)` | **None** | Sets `stage_status` by current stage | Site Visit tab bypasses this |

**Mapper:** `src/features/orders/actions/siteVisitMapper.ts` — `mapSiteVisitFromDb`, `mapSiteVisitToDb`, `mapSiteVisitMeasurementFromDb`, `formatSiteMeasurementLabel`.

## UI Components

| Component | Path | Purpose |
|-----------|------|---------|
| `SiteVisitModule` | `src/features/orders/workspace/modules/site-visit/SiteVisitModule.tsx` | Staff audit UI: schedule, skip, locations, photos, requirements |
| `ScheduleVisitModal` | `.../ScheduleVisitModal.tsx` | Date/slot/map picker for staff scheduling |
| `SiteVisitReviewModal` | `.../SiteVisitReviewModal.tsx` | Pre-freeze review summary |
| `OrderWorksheetModal` | `src/features/order-detail/components/OrderWorksheetModal.tsx` | Shell: save, freeze, skip, workflow choice, realtime |
| `AdminControlModule` | `src/features/order-detail/components/admin/AdminControlModule.tsx` | Pending approval banner + workflow approve |
| `WorkflowChoiceModal` | `src/features/order-detail/components/WorkflowChoiceModal.tsx` | Quote-first vs design-first |
| `OrdersManagementDashboard` | `src/features/orders/components/OrdersManagementDashboard.tsx` | Site Visit queue table + Refresh |
| `PortalClient` | `src/app/portal/PortalClient.tsx` | Customer multi-order portal scheduling |
| `OrderDetailClient` | `src/app/portal/order/[orderId]/OrderDetailClient.tsx` | Single-order portal scheduling + read-only visit view |

**Queue pages:**

- `src/app/staff/(dashboard)/site-visit/page.tsx`
- `src/app/installation/(dashboard)/site-visit/page.tsx`

**Detail pages** (load `siteVisitItems` from measurements):

- `src/app/admin/(dashboard)/orders/[id]/page.tsx`
- `src/app/staff/(dashboard)/orders/[id]/page.tsx`
- `src/app/portal/order/[orderId]/page.tsx`
- Production/installation order detail pages (read-only context)

## File Structure

```
src/features/orders/
  actions/
    orderActions.ts          # Site visit server actions
    siteVisitMapper.ts       # DB ↔ UI mapping
  workspace/
    modules/site-visit/
      SiteVisitModule.tsx
      ScheduleVisitModal.tsx
      SiteVisitReviewModal.tsx
    shared/
      stageGrants.ts         # site_visit nav + grants
      permissions.ts         # resolveStagePermission
      serverPermissions.ts   # assertStageEditPermission
      registry.tsx           # site_visit → SiteVisitModule
  realtime/
    useOrderDetailSync.ts    # site_visits + measurements subscriptions
    orderDetailPatch.ts      # Realtime patch merge
  components/
    OrdersManagementDashboard.tsx

src/features/order-detail/components/
  OrderWorksheetModal.tsx
  admin/AdminControlModule.tsx
  WorkflowChoiceModal.tsx

src/app/
  staff/(dashboard)/site-visit/page.tsx
  installation/(dashboard)/site-visit/page.tsx
  portal/PortalClient.tsx
  portal/order/[orderId]/OrderDetailClient.tsx
  portal/order/[orderId]/page.tsx
  portal/page.tsx

src/types/index.ts             # SiteVisitDetails, SignLocation, PipelineStage

supabase/migrations/
  20260620000001_create_site_visits.sql
  20260621000000_add_unique_constraint_to_site_visits.sql
  20260627000000_drop_unused_site_visit_columns.sql
  20260704000000_update_site_visit_photos_bucket.sql
  20260704000001_site_visit_measurement_units.sql
  20260704000011_tenant_isolation_rls.sql
  20260706130000_order_detail_realtime.sql
```

## Data Flow

### Customer schedules

```
Portal form submit
  → scheduleSiteVisitAction
  → upsert site_visits (audit_date, audit_time, address, gps)
  → orders.stage = Site Visit Scheduled, stage_status = Normal
  → order_activity timeline insert
  → WhatsApp site_visit_scheduled
  → revalidateStaffQueuePaths + order detail paths
```

### Staff saves audit draft

```
SiteVisitModule field change
  → onUpdate (local setOrder only)
Save Draft (OrderWorksheetModal)
  → updateSiteVisitDetailsAction
  → upsert site_visits + site_visit_measurements
  → revalidate paths
```

### Staff photo upload

```
File select (SiteVisitModule)
  → supabase.storage.site-visit-photos.upload({orderId}/...)
  → public URL appended to active location.photos
  → onUpdate → persisted on Save Draft
```

### Staff freezes audit

```
Push for Approval
  → SiteVisitReviewModal
  → freezeSiteVisitAction
  → site_visits.completed = true
  → orders.stage_status = Pending Admin Approval: Site Visit Completed
  → order_activity + WhatsApp site_visit_completed
```

### Admin advances

```
AdminControlModule → Choose Workflow & Approve
  → WorkflowChoiceModal
  → setWorkflowTypeAction
  → orders.workflow_type set
  → orders.stage = Quotation In Progress | Design In Progress
  → orders.stage_status = Normal
  → order_activity + WhatsApp
```

### Realtime (order detail only)

```
useOrderDetailSync
  → postgres_changes on orders, site_visits, site_visit_measurements
  → orderDetailPatch merge into local order state
```

List/queue pages: SSR + `revalidatePath` + manual Refresh — **no queue realtime**.

## Timeline Events

| `metadata.action` | Trigger | Content (approx.) |
|-------------------|---------|-------------------|
| `site_visit_scheduled` | `scheduleSiteVisitAction` | Site visit scheduled for {date} at {time} |
| `site_visit_staff_approved` | `approveSiteVisitAction` | Staff approved time; pending admin (unused) |
| `site_visit_frozen` | `freezeSiteVisitAction` | Data confirmed and locked |
| `workflow_type_set` | `setWorkflowTypeAction` | Workflow path set; advanced |
| `stage_changed` | `updateOrderStageAction` | Manual stage change (skip flow) |
| `stage_approved` | `adminApproveStageAction` | Generic admin approve (not site-freeze path) |

`updateSiteVisitDetailsAction` does **not** write timeline entries.

## Validation Rules

| Rule | Where enforced |
|------|----------------|
| Schedule: date + time + address required | Portal + `ScheduleVisitModal` |
| Push for Approval: `auditDate` + `auditTime` + ≥1 location | `OrderWorksheetModal` (`canAdvanceSiteVisit`) |
| Measurement upsert: valid UUID preserved; new ids generated client-side | `updateSiteVisitDetailsAction` |
| Frozen module: all inputs disabled | `SiteVisitModule` `isFrozen` |
| Staff queue: assigned + site visit stage | Staff site-visit page filter |

No Zod/schema validation on server payloads.

## Error Handling

- Upload failures: `alert` in `SiteVisitModule`.
- Measurement upsert errors: logged with `console.error`; **save still returns success** if `site_visits` upsert succeeded.
- Concurrent editing: last `updateSiteVisitDetailsAction` wins; no optimistic locking.
- Realtime: `useOrderDetailSync` resolves `site_visit_id` on mount if not passed.
- Skip / schedule failures: `alert` or silent `console.error` in portal.

## Security Rules

**Implemented:**

- Staff mutations (`update`, `freeze`) require authenticated user with `site_visit` stage grant.
- RLS tenant isolation on `site_visits` / `site_visit_measurements` for authenticated users.
- Portal anon `SELECT` policies for realtime (permissive — same pattern as quotations).

**Gaps (see audit):**

- `scheduleSiteVisitAction` has no portal session or staff auth check.
- `setWorkflowTypeAction`, `adminApproveStageAction`, `updateOrderStageAction` have no `assertAdminOnly`.
- Storage uploads use client Supabase anon key — bucket policies must restrict writes.
- No server-side validation of file type/size (bucket limit only).

## Edge Cases

- **Skip visit:** Synthetic schedule data; stage forced to `Site Visit Scheduled`; address prefix `"Skipped"` drives UI banner.
- **Staff schedules without customer:** Same action as portal; no differentiation in timeline message (“by client” always).
- **Reschedule:** Portal `isRescheduling` re-calls `scheduleSiteVisitAction`; overwrites visit row.
- **No site_visits row:** Order can sit in `Site Visit Pending` with null details until first schedule/save.
- **`Site Visit Completed` stage:** Appears in enums/UI but never written — orders stay `Site Visit Scheduled` through freeze.
- **Removed locations:** DB rows remain orphaned.
- **Admin God Mode:** Unlocks frozen module for edit; requires explicit Save Draft.
- **Display stage heuristic:** Lists show `Site Visit Pending` when scheduled stage lacks `auditDate`.

## Future Improvements

- Add migration for `scaffolding_required`, `crane_required`, and related mapper columns (or remove from mapper).
- Wire or remove `approveSiteVisitAction` and `Pending Admin Approval: Site Visit Schedule` flow.
- Add `assertStageEditOrPortalOrder` to `scheduleSiteVisitAction`; `assertAdminOnly` to admin actions.
- Delete orphaned `site_visit_measurements` on save diff.
- Server-side photo validation and auth-scoped storage paths.
- Set or remove `Site Visit Completed` pipeline stage for clarity.
- Timeline entries on audit saves.
- Offline-capable staff audit (not implemented).

## Change Log

| Version | Date | Summary |
|---------|------|---------|
| 3.0 | 2026-07-06 | Full rewrite from codebase audit. Documents actual workflow (no schedule approval gate, freeze + workflow choice, dead `approveSiteVisitAction`, unused `Site Visit Completed` stage). |
| 2.0 | 2026-07-03 | Prior consolidated spec (partially inaccurate). |
