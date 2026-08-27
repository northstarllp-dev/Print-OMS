# Designer Workflow Specification (Implementation-Accurate)

## Overview

The Design workflow manages per-order design proofs (one JSONB record per order in `public.designs`), customer inspiration/logo intake, multi-item version history, pinpoint/general customer feedback, customer approval, and final production-file handoff. It is a shared staff + customer-portal workflow: the same `designs` row is read/written by the staff order workspace (`DesignModule`) and the customer portal (`DesignTab`), coordinated through server actions and (for staff) Supabase Realtime.

Design can run either after Quotation (`quote_first`, default) or before it (`design_first`), controlled by `orders.workflow_type`, chosen by an admin after Site Visit approval (`WorkflowChoiceModal`).

## Business Goal

- Collect customer design inputs/resources (inspiration images, logos, reference files).
- Support one or more design "items" per order (seeded from site-visit locations, or a single fallback "General Design" item).
- Track version history per item with statuses (`Draft` → `Sent to Customer` → `Changes Requested`/`Approved`).
- Allow the customer to leave pinpoint (x/y) or general feedback per version.
- Require all items' latest version to be `Approved`, plus at least one production file, before the order can advance past Design.
- Notify the customer via WhatsApp at key milestones.

## Workflow

1. Order reaches `Design In Progress` (via `setWorkflowTypeAction` for `design_first`, or `adminApproveStageAction` for `quote_first` after Quotation Approved).
2. Customer opens the portal Design tab and uploads inspiration/logo files (`DesignTab.handleResourceUpload`) → stored in `designs.resources` and the `site-visit-photos` bucket.
3. Staff (`DesignModule`, gated by `isEmployee`) uploads one or more proof files per item. Single-image uploads open a rotate/preview modal before upload; multi-file or PDF uploads go straight through. New versions are always created with `status: "Draft"`.
4. Staff clicks **Send to Customer** (`OrderWorksheetModal.handleSaveDraft` while on the Design tab → `sendDesignToCustomerAction`). This flips every item's `Draft`/`Changes Requested` version to `Sent to Customer` and dispatches a WhatsApp template (`design_ready_for_review` or `design_revision_uploaded` if any version previously had `Changes Requested`).
5. Customer reviews the active version in the portal:
   - Clicking on the image (only when not `Approved`) opens a pinpoint comment box; submitting adds a numbered pin comment **and** a mirrored general comment (`Pin #N: ...`), sets that version's status to `Changes Requested`, and forces the order stage back to `Design In Progress` (`transitionDesignOrderStageAction`).
   - "Add Feedback" opens a free-text general-comment box with the same status/stage side effects.
   - "Approve Design" sets the **currently selected/active version** (not necessarily the latest version) to `Approved` and logs `design_approved_by_customer`. If every item's latest version is now `Approved`, it also transitions the stage to `Design Approved` and logs `all_designs_approved`.
6. Staff uploads final production files per item once that item's latest version is `Approved` (`handleProductionFileUpload`, folder `production`).
7. Staff/admin advances the order out of Design via the shared worksheet "Request Admin Approval" / "Approve & Advance" buttons (`requestStageAdvancementAction` / `adminApproveStageAction`), gated by `canAdvanceSiteVisit` (all items approved + ≥1 production file) **but see Business Rules for a workflow-type gating gap**.
   - **Admin override (admin portal only):** When stage is `Design In Progress` and not all items are customer-approved, Admin sees amber **Approve without Customer & Advance**. This calls `adminMarkDesignApprovedAction` (force-approves each item's latest version, sets stage to `Design Approved`, logs `design_approved_by_admin`) then `adminApproveStageAction` to move to Quotation/Production. Staff never see this control.
8. `order_activity` timeline rows and WhatsApp notifications are written throughout; realtime `designs`/`orders` changes are broadcast to staff sessions via `useOrderDetailSync`.

## Workflow States

### Order stage values used by Design

- `Design In Progress`
- `Design Approved`

### `orders.stage_status` values touched by Design

- `Normal`
- `Pending Admin Approval: Design Stage` (design_first, requested from Site Visit Completed)
- `Pending Admin Approval: Design Approval` (requested from `Design In Progress`)

### Design version status values (per item version)

- `Draft` newly uploaded, not yet sent.
- `Pending Admin` declared in the `DesignVersion` type but **never set** by any current action or UI control (dead status value).
- `Sent to Customer` set by `sendDesignToCustomerAction`.
- `Changes Requested` set when the customer adds a pin or general comment.
- `Approved` set when the customer approves (portal) or via `approveAllDesignItemsAction` (legacy multi-order portal, forces **every** item's latest version to `Approved` in one call, unlike the per-item portal approval flow in `DesignTab`).

## Business Rules

- Design data lives only in `public.designs` (`orders.design_details` was dropped in `20260703000001`).
- Each order should have exactly one `designs` row (`UNIQUE(order_id)`), created:
  - on manual order creation (`createOrder` in `orderActions.ts`), and
  - on enquiry→order conversion (`enquiryActions.ts`).
  - `createDesignForOrderAction` exists as an on-demand upsert fallback if a row is somehow missing, but it is **not called from either creation path**, so it is effectively unused dead code today.
- Item list is derived at render time from `siteVisitItems` (site-visit locations) when present; otherwise a single fallback item `{ id: "general", name: "General Design" }` is used. This derivation is duplicated independently in `DesignModule.tsx` and `DesignTab.tsx` (identical `itemsList` memo logic, copy-pasted, not shared).
- Customer feedback can be pinpoint (`x`, `y`, `number`, `isGeneral: false`) and/or general (`isGeneral: true`). Every pinpoint comment is inserted alongside an auto-generated mirrored general comment; deleting the pinpoint comment removes the mirrored comment by string-prefix match (`Pin #N: `), which will silently fail to find/remove the mirror if the pin's `content` text is later edited (no edit feature exists, so currently low risk) or if two pins share the same number after a delete (see Bugs).
- Optimistic concurrency: `updateDesignDetailsAction` accepts an `expectedUpdatedAt` and applies `.eq("updated_at", expectedUpdatedAt)` before writing; if the row moved, the update silently does not match any row (`.maybeSingle()` returns null) and throws "Design was updated by another user." **However**, every caller re-derives its payload from a `getDesignByOrderId` read that itself does not carry the `updated_at` used for the *next* write in multi-step handlers each mutation in `DesignTab`/`DesignModule` re-reads `dd.updated_at` from the (potentially stale) client-side `order.design` prop, not a fresh server read, so rapid consecutive edits from the same open tab can still race.
- `approveAllDesignItemsAction` (legacy) approves the **latest** version of every item at once; `DesignTab.handleApproveDesign` (current portal UI) approves only the **currently active/selected** version, which may not be the latest version. This is an inconsistency between the two approve implementations see Bugs.
- Order-stage "all approved" checks (in `OrderWorksheetModal`, `approveAllDesignItemsAction`, `DesignTab.handleApproveDesign`) are computed independently in three places using slightly different item-filtering logic (`activeDesignItems` in the worksheet only counts items with ≥1 version; the design actions count all items).
- Staff worksheet gate (`OrderWorksheetModal`) requires both all design items approved and ≥1 production file present before allowing "Request Admin Approval" but the gate-enforcing `if` condition on `handleRequestAdvancement` hardcodes tab index `2` for Design instead of using the workflow-aware `designTab` variable, so in `design_first` orders (where Design is tab `1`, not `2`) the validation is **not applied** and staff can request advancement (and admins can then approve it) without any design being approved or any production file uploaded. See Bugs (Critical).

## User Permissions

### Staff/Admin (server actions)

- `assertStageEditPermission("design")` staff-only mutation gate (e.g. `createDesignForOrderAction`, `sendDesignToCustomerAction`).
- `assertStageEditOrPortalOrder("design", orderId)` shared staff/portal mutation gate (e.g. `updateDesignDetailsAction`, `updateDesignItemStatusAction`, `addDesignCommentAction`, `approveAllDesignItemsAction`, `transitionDesignOrderStageAction`).
- Authorization source for the above:
  - authenticated staff/admin profile with a stage grant resolved via `resolveStagePermission("design", actor)`, or
  - a valid, unexpired `portal_session` cookie whose `orderId`/`customerId` matches the target order (`assertValidPortalSessionForOrder`). **The session's `scopes` array (e.g. `approve_design`) is stored but never checked** any valid portal session for the order can call any design mutation regardless of granted scope.
- **Gap:** the order-stage transition actions that surround Design (`requestStageAdvancementAction`, `adminApproveStageAction`, `setWorkflowTypeAction`, `updateOrderStageAction` in `orderActions.ts`) call **no** permission-check function at all. Because `orders` RLS for `authenticated` users only scopes by `company_id` (not by stage/role), any authenticated staff member of the same company regardless of `staff_role` can call `adminApproveStageAction` directly to force-advance any order stage, bypassing the intended "admin-only approval" business rule. This is not Design-specific but directly affects the Design admin-approval step.

### Customer portal

- Session established via `/printoms/api/portal/session` from a signed portal token (`utils/portal-tokens.ts`); cookie carries `customerId`, optional `orderId`, `scopes`, and `exp`.
- Portal browser client uses direct Supabase Storage uploads (`site-visit-photos` bucket) with **no server-side permission check** storage bucket policies are the only gate for uploads; the design-record mutation afterwards does go through `assertStageEditOrPortalOrder`.

### Stage grants

- Default role grants (`STAGE_GRANTS_BY_STAFF_ROLE`): `Designer` → `["site_visit", "design"]`.
- Tenant overrides (`TENANT_STAGE_GRANTS`) can replace defaults per `company_id` (e.g. Board company's `Designer` → `["design"]` only).
- Admin role always has all stages editable.

## Database Tables

- `orders` `stage`, `stage_status`, `stage_admin_notes`, `workflow_type`, `company_id`, `order_id` (friendly code).
- `designs` one row per order (`resources` + `items` JSONB payload). No `payment_verified` column (dropped in `20260704000010`).
- `order_activity` timeline/customer/internal activity log, keyed by the friendly `order_id` text.
- `site_visits` / `site_visit_measurements` source of `designBriefAvailable`/location data used to seed design items.
- `portal_access_tokens` token issuance/revocation tracking (jti, scopes, expiry).
- `notification_outbox` WhatsApp dispatch idempotency/logging.

No dedicated `design_items`, `design_versions`, `design_comments`, or `production_files` tables exist all of this data is nested inside `designs.items` JSONB.

## Design Data Structure

`DesignRecord` (`src/types/index.ts`):

```ts
interface DesignRecord {
  id: string;
  order_id: string;
  resources: DesignResource[];
  items: DesignItem[];
  created_at: string;
  updated_at: string;
}
```

Legacy mapping (`designMapper.mapDesignFromDb`): if `items` is empty but a top-level `versions` array exists on the raw row (pre-migration shape), it is wrapped into a synthetic `{ id: "general", name: "General Design", versions, currentVersion, productionFiles }` item. `mapDesignToDb` exists in the same file but has no callers anywhere in the codebase (dead code all writes go through raw upsert/update payload objects built inline in `designActions.ts`).

## Resources Structure

Each `DesignResource`:

- `id`, `url`, `name`
- `type: "link" | "file"` (only `"file"` is ever produced by current upload code; `"link"` is unused)
- `uploadedBy: "Customer" | "Staff"` (only `"Customer"` is ever produced by current code staff has no resource-upload UI)
- `createdAt`

## Design Items

Each `DesignItem`:

- `id`, `name`
- `versions: DesignVersion[]`
- `currentVersion` recomputed from `versions[versions.length - 1].versionNumber` on every version-list mutation
- `productionFiles?: { id, name, url, createdAt }[]`

Items are **not** persisted independently when only seeded from site-visit locations they exist purely in the client-side `itemsList` memo until the first version/production-file write persists them into `designs.items`.

## Version Structure

Each `DesignVersion`:

- `id`, `versionNumber`
- `proofUrl`, `fileName`
- `aiFileUrl?` declared in the type, never populated or read by any current action/UI (dead field)
- `status: "Draft" | "Pending Admin" | "Sent to Customer" | "Changes Requested" | "Approved"`
- `comments: DesignComment[]`
- `createdAt`

## Comment Structure

`DesignComment`:

- `id`
- `x`, `y` percentage position on the image, only meaningful when `isGeneral` is falsy
- `content`, `author`, `createdAt`
- `isGeneral?` true for free-text feedback entries (including the auto-mirrored pin text)
- `isDraft?` declared in the type and rendered in `DesignTab` (amber "Draft" badge / pin color) but **never set to `true`** by any current action dead visual state
- `number?` sequential pin number, computed as `count of existing non-general comments + 1`; **not reused after deletion**, so deleting pin #2 out of 3 leaves pins numbered 1 and 3 (gap), and a new pin would be numbered 4, not 2 numbering is monotonic per-version, not contiguous.

## Production Files

- Uploaded in `DesignModule` (staff only) once the active item's latest version is `Approved`, folder `production` inside the shared bucket.
- Represented as plain `{ id, name, url, createdAt }[]` on the item, no versioning of production files.
- Delete removes the JSON reference immediately; storage deletion is **not attempted at all** for production files (only design-proof versions attempt `supabase.storage.remove(...)` on delete) deleting a production file leaves an orphaned object in storage.

## Storage Structure

Bucket: `site-visit-photos` (shared with Site Visit photos; no dedicated design bucket exists despite `docs/portal-and-storage-security-plan.md` proposing one).

Paths used by Design:

- Design proofs (staff upload): `{orderId}/designs/{timestamp}-{random}.{ext}`
- Customer resources (portal upload): `{orderId}/resources/{timestamp}-{random}.{ext}`
- Production files (staff upload): `{orderId}/production/{timestamp}-{random}.{ext}`

Bucket config (`20260704000000_update_site_visit_photos_bucket.sql`): `allowed_mime_types = NULL` (all types accepted at the bucket level only the file `<input accept="...">` attribute restricts type client-side, which is trivially bypassable), `file_size_limit = 50MB`. Broad public "Select"/"Public read" storage policies were removed in `20260707142000_site_visit_photos_listing_hardening.sql`, but public URLs (`getPublicUrl`) are still used for all design assets, so **anyone with a guessed/leaked URL can read the file** regardless of listing-policy hardening object-level read is effectively public.

## Server Actions

`src/features/designs/actions/designActions.ts`:

- `getDesignByOrderId(orderId)`
- `createDesignForOrderAction(orderId)` unused by any creation path today (see Business Rules)
- `updateDesignDetailsAction(orderId, details, expectedUpdatedAt?)` the single generic read-modify-write entry point used by almost every mutation in both `DesignModule` and `DesignTab`
- `updateDesignItemStatusAction(orderId, itemId, versionId, status, updateStage?)` defined, **no callers** in the UI (both staff and portal mutate version status via `updateDesignDetailsAction` directly instead)
- `addDesignCommentAction(orderId, itemId, versionId, comment, updateStage?)` defined, **no callers** (portal builds comments directly via `updateDesignDetailsAction`)
- `sendDesignToCustomerAction(orderId)`
- `approveAllDesignItemsAction(orderId)` used only by the legacy multi-order `PortalClient`'s dead `handleApproveDesign`/`handleDeclineDesign` handlers (see Bugs) effectively unreachable from the UI
- `transitionDesignOrderStageAction(orderId, stage)`

Related order actions (`src/features/orders/actions/orderActions.ts`):

- `requestStageAdvancementAction`, `adminApproveStageAction`, `setWorkflowTypeAction`, `updateOrderStageAction` stage/gate transitions surrounding Design; **no stage-permission check** (see User Permissions gap)
- Order creation/enquiry-conversion paths insert the initial empty `designs` row

## UI Components

- Staff: `src/features/orders/workspace/modules/design/DesignModule.tsx`, embedded via `registry.tsx`/`OrderWorksheetModal`.
- Portal: `src/app/portal/components/DesignTab.tsx`, embedded by both `PortalClient.tsx` (legacy multi-order portal) and `src/app/portal/order/[orderId]/OrderDetailClient.tsx` (single-order portal).
- `PortalClient.tsx` retains a second, unused, hand-rolled approve/decline implementation (`handleApproveDesign`, `handleDeclineDesign`, `designFeedback`, `showDesignDeclineInput`) that predates `DesignTab` extraction and is now dead code (not wired to any rendered button).

## File Structure

- `src/features/designs/actions/designActions.ts`
- `src/features/designs/actions/designMapper.ts`
- `src/features/orders/workspace/modules/design/DesignModule.tsx`
- `src/app/portal/components/DesignTab.tsx`
- `src/features/order-detail/components/OrderWorksheetModal.tsx`
- `src/features/order-detail/components/WorkflowChoiceModal.tsx`
- `src/features/orders/actions/orderActions.ts`
- `src/features/orders/realtime/useOrderDetailSync.ts`
- `src/features/orders/realtime/orderDetailPatch.ts`
- `src/features/orders/workspace/shared/permissions.ts`
- `src/features/orders/workspace/shared/serverPermissions.ts`
- `src/features/orders/workspace/shared/stageGrants.ts`
- `src/features/orders/workspace/shared/registry.tsx`
- `src/app/portal/PortalClient.tsx`
- `src/app/portal/order/[orderId]/OrderDetailClient.tsx`
- `src/app/portal/order/[orderId]/page.tsx`
- `src/app/portal/page.tsx`
- `src/app/portal/utils/portalStageNavigation.ts`
- `src/app/staff/(dashboard)/design/page.tsx`
- `src/utils/portal-tokens.ts`
- `src/features/notifications/whatsapp/templates.ts`, `src/features/notifications/actions/dispatchNotification.ts`
- `supabase/migrations/20260703000000_extract_designs.sql`
- `supabase/migrations/20260703000001_drop_orders_design_details.sql`
- `supabase/migrations/20260704000000_update_site_visit_photos_bucket.sql`
- `supabase/migrations/20260704000010_drop_unused_payment_columns.sql`
- `supabase/migrations/20260704000011_tenant_isolation_rls.sql`
- `supabase/migrations/20260706130000_order_detail_realtime.sql`
- `supabase/migrations/20260707134500_portal_rls_hardening_design_order_detail.sql`
- `supabase/migrations/20260707142000_site_visit_photos_listing_hardening.sql`

## Data Flow

1. Browser uploads file directly to the `site-visit-photos` Supabase Storage bucket (client-side, no server action in the path).
2. Public URL is generated client-side via `getPublicUrl`.
3. The updated `items`/`resources` array (whole-array replace, not a partial patch) is sent to `updateDesignDetailsAction`.
4. The action re-reads the current row, shallow-merges the caller's partial `details` on top, and upserts/updates `public.designs` by `order_id` (optimistic-concurrency check on `updated_at` when provided).
5. `revalidateStaffQueuePaths()` + `revalidateOrderDetailPaths(orderId)` re-render staff/portal server-rendered pages.
6. Staff sessions additionally receive a realtime `designs` table event via `useOrderDetailSync` → `patchFromDesignRow` → `mergeOrderDetailPatch`.
7. Stage changes happen through one of: `transitionDesignOrderStageAction` (called by portal comment/feedback and the legacy `PortalClient` decline flow), the internal stage-set inside `approveAllDesignItemsAction`/`DesignTab.handleApproveDesign`, or the generic admin stage actions in `orderActions.ts`.

**Portal realtime note:** `OrderDetailClient` and `PortalClient` both call `useOrderDetailSync({ ..., enabled: false })` realtime sync is explicitly disabled for the customer portal. Portal users only see fresh design data on full page load/`router.refresh()`/re-navigation, not live pushes. (This is also now consistent with `20260707134500` having dropped the anon `SELECT` policy on `designs` that anonymous realtime would have required.)

## Timeline Events

`order_activity.metadata.action` values written by Design-adjacent code:

- `stage_changed` generic order-stage change (written by `designActions.updateOrderStage` and `orderActions.updateOrderStageAction`)
- `design_approved_by_customer` written by `DesignTab.handleApproveDesign` and the dead `PortalClient.handleApproveDesign`
- `all_designs_approved` written by `DesignTab.handleApproveDesign` when every item is now approved
- `design_revision_requested` written only by the dead `PortalClient.handleDeclineDesign` path (the live `DesignTab` comment/feedback flows do **not** log a distinct timeline entry for revision requests, only the generic `stage_changed` entry from the subsequent stage transition)
- `stage_approved`, `workflow_type_set` generic order-stage admin actions that can target Design stages

WhatsApp dispatches tied to Design:

- `design_resources_required` dispatched on `Design In Progress` pipeline-stage entry (`dispatchNotification.ts`)
- `design_ready_for_review` / `design_revision_uploaded` dispatched by `sendDesignToCustomerAction`
- `design_approved` dispatched by `approveAllDesignItemsAction` only (i.e., effectively never, since that action is unreachable from the live UI see Bugs)

## Validation Rules

- No schema/shape validation library (e.g. zod) validates `resources`/`items`/`comments` payloads before they are upserted into `designs` any shape mismatch is only caught by downstream TypeScript types at compile time, not at runtime.
- File type restrictions exist only as HTML `<input accept="...">` hints; the storage bucket accepts any MIME type and any authenticated/portal-session caller can upload arbitrary file types/sizes up to 50MB.
- "All approved" / advancement checks are presence/status checks only (see Business Rules for the three independent, slightly different implementations).
- No maximum enforced on number of items, versions per item, resources, or production files.

## Error Handling

- Client mutations wrap calls in `try/catch` and surface failures via `alert(...)` no toast/inline error UI in `DesignModule`/`DesignTab`.
- Server actions throw plain `Error` objects with the raw Supabase error message (may leak internal DB details to the client error boundary).
- `updateDesignDetailsAction` throws a dedicated conflict message when `expectedUpdatedAt` doesn't match, but no caller currently retries or reconciles the user must manually retry the action after refreshing.
- Storage upload failures roll back nothing (no cleanup of partially uploaded files across a multi-file loop if a later file fails mid-loop).

## Security Rules

- Authenticated (staff/admin) access to `designs` is tenant-scoped via `orders.company_id` through RLS (`20260704000011`), but is **not** scoped by stage grant any authenticated user in the tenant can read/write any order's `designs` row directly via the Supabase client if they can reach a code path that calls it (mitigated in practice by all current design mutations routing through server actions with `assertStageEditPermission`/`assertStageEditOrPortalOrder`, but not by RLS itself).
- Portal session authorization (`assertValidPortalSessionForOrder`) checks cookie presence, expiry, and order/customer id match, but **not** the token's `scopes` array scope-based restriction (e.g. `approve_design`) is defined in `portal-tokens.ts` but not enforced anywhere.
- The broad anon `SELECT` policy on `designs` (added in `20260706130000` for realtime) was removed in `20260707134500`; portal design data now flows only through server-rendered pages / server actions using the user's cookie-bound RLS-respecting client (for authenticated staff) or the unauthenticated-safe server actions (for portal sessions) there is no longer a direct anon-readable path to `designs` (correcting the previous spec revision's assumption).
- File uploads (proofs, resources, production files) go directly from the browser to Supabase Storage with **no server-side authorization check at all** only the storage bucket's RLS policies gate who can write, and no upload-specific RLS policy was found scoping this by stage/company in the reviewed migrations (the bucket was only ever widened for MIME/size, and later listing policies were narrowed, but write-authorization policy was not located as part of this design-specific storage path).
- The critical order-stage transition actions (`adminApproveStageAction`, `requestStageAdvancementAction`, `setWorkflowTypeAction`, `updateOrderStageAction`) have no server-side role check see User Permissions.

## Edge Cases

- Legacy top-level `versions` (pre-multi-item schema) are mapped into a synthetic `"General Design"` item by `mapDesignFromDb`.
- Site-visit-item-derived design items are only materialized into the `designs.items` array once a version or production file is actually added for that item; until then they exist only in derived client memory and disappear if `siteVisitItems` changes shape.
- Rotated single-image uploads are re-encoded via an in-browser `<canvas>` to a blob before upload; non-image or multi-file uploads skip the rotate/preview modal entirely.
- Deleting a design-proof version only removes the storage object if the public URL contains the exact substring `/public/site-visit-photos/`; any URL shape change (e.g. CDN/signed URL) silently skips the storage delete, leaving an orphan.
- Customer approving a **non-latest** version (by selecting an older version tab before clicking Approve) marks that older version `Approved` while the true latest version remains whatever status it had the item's "latest version approved" checks used for stage-advance gating will then read the (unapproved) latest version, so the item will *not* count as approved even though a version shows an "Approved" badge, creating a confusing customer-facing state.
- Two customer browser tabs open on the same order can both build a comment list from a stale `dd.updated_at` and lose one comment on write if the optimistic-concurrency check doesn't catch the race (see Business Rules).

## Future Improvements

- Add server-side schema validation for `resources`/`items`/`comments` before writing to `designs`.
- Enforce the `scopes` array already present on portal sessions/tokens (e.g. require `approve_design` for design-mutating actions).
- Add `assertStageEditPermission`/`assertAdminOnly` checks to `adminApproveStageAction`, `requestStageAdvancementAction`, `setWorkflowTypeAction`, and `updateOrderStageAction`.
- Fix the hardcoded tab-index check in `OrderWorksheetModal.handleRequestAdvancement` to use the workflow-aware `designTab` variable so `design_first` orders are validated the same as `quote_first` orders.
- Unify the three duplicated item-derivation (`itemsList` memo) and three duplicated "all items approved" implementations into one shared helper.
- Make `DesignTab.handleApproveDesign` always approve the item's latest version rather than whichever version is currently selected.
- Route Storage uploads through a server action (or add bucket-level RLS write policies scoped by stage/company) instead of unauthenticated-by-app-logic direct client uploads.
- Add storage cleanup for deleted production files (currently only design-proof version deletes attempt storage cleanup, and only when the URL shape matches).
- Split the shared `site-visit-photos` bucket into a dedicated design-assets bucket per `docs/portal-and-storage-security-plan.md`.
- Remove dead code: `createDesignForOrderAction`, `updateDesignItemStatusAction`, `addDesignCommentAction`, `approveAllDesignItemsAction` (or wire them up if the intent is for them to be used), `mapDesignToDb`, `DesignModule.handleUpdateVersionStatus`, `PortalClient`'s legacy approve/decline handlers and state, `DesignVersion.aiFileUrl`, `DesignComment.isDraft`, `"Pending Admin"` status value, `DesignResource.type: "link"` and `uploadedBy: "Staff"` variants.

## Change Log

- 2026-07-07 (this revision): Full re-audit against current code paths. Corrected the previous revision's claim that a broad anon `SELECT` policy on `designs` is still active (it was dropped by `20260707134500`). Documented the `handleRequestAdvancement` workflow-type tab-index gating gap, the missing permission checks on `adminApproveStageAction`/`requestStageAdvancementAction`/`setWorkflowTypeAction`/`updateOrderStageAction`, the unused portal token `scopes`, the divergent "approve" implementations between `DesignTab` and the legacy `PortalClient`/`approveAllDesignItemsAction`, and multiple dead-code items (`createDesignForOrderAction`, `updateDesignItemStatusAction`, `addDesignCommentAction`, `mapDesignToDb`, `DesignModule.handleUpdateVersionStatus`, `PortalClient` legacy design approve/decline handlers, disabled portal realtime sync, `aiFileUrl`, `isDraft`, `"Pending Admin"` status).
- 2026-07-07 (previous revision): Full rewrite to match code paths, server actions, portal/session auth model, realtime wiring, and migrated `designs` table behavior.
