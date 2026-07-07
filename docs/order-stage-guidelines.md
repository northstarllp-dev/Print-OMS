# Order Stage Guidelines

> **Status:** Active — reference implementation: **Site Visit** (2026-07-07)  
> **Audience:** Engineers implementing or refactoring Quotation, Design, Production, Installation, and Admin workflow  
> **Companion docs:** [`specs/site-visit.md`](../specs/site-visit.md) (full reference), [`docs/DATABASE_SCHEMA.md`](./DATABASE_SCHEMA.md), [`docs/portal-and-storage-security-plan.md`](./portal-and-storage-security-plan.md)

This document defines the **patterns every pipeline stage should follow** so the application stays consistent: one shell, one permission model, one advancement model, and one source of truth for schema.

---

## 1. Why this exists

Site Visit was audited end-to-end and hardened. Other stages still mix older patterns (generic `requestStageAdvancementAction`, client storage uploads, partial realtime). **Do not invent per-stage shortcuts.** Extend the same architecture Site Visit uses unless there is a documented, stage-specific reason.

**Golden rule:** If a behavior is wrong for Site Visit (half-frozen state, duplicate server actions, enum with no writer, dead scaffold UI), it is probably wrong for your stage too.

---

## 2. Application shape (one shell, many modules)

```
┌─────────────────────────────────────────────────────────────┐
│  Route: /staff/orders/[id]  |  /admin/orders/[id]           │
│  UI shell: OrderWorksheetModal (single entry point)         │
│    ├── Timeline tabs (workflow order from workflow_type)    │
│    ├── Footer: Save Draft | Push for Approval | Admin acts  │
│    ├── useOrderDetailSync (staff/admin realtime)            │
│    └── Stage modules under workspace/modules/<stage>/       │
│         SiteVisitModule | QuotationModule | DesignModule …  │
├─────────────────────────────────────────────────────────────┤
│  Customer portal: /portal — server-rendered + limited client│
│    No co-editing worksheet; read/approve/schedule only      │
└─────────────────────────────────────────────────────────────┘
```

| Layer | Location | Responsibility |
|-------|----------|----------------|
| **Shell** | `src/features/order-detail/components/OrderWorksheetModal.tsx` | Tabs, footer actions, validation before advance, modals |
| **Stage module** | `src/features/orders/workspace/modules/<stage>/` | Stage UI; receives props/callbacks from shell |
| **Server actions** | `src/features/orders/actions/orderActions.ts` + stage-specific `*Actions.ts` | Mutations, auth, revalidation |
| **Mappers** | e.g. `siteVisitMapper.ts`, `designMapper.ts` | DB snake_case ↔ UI types |
| **RBAC** | `workspace/shared/stageGrants.ts`, `permissions.ts`, `serverPermissions.ts` | UI + server must match |
| **Realtime** | `src/features/orders/realtime/useOrderDetailSync.ts` | Staff multi-user sync **on save**, not per keystroke |
| **Types** | `src/types/index.ts` | `PipelineStage`, `stage_status` unions |

**Do not** add parallel shells (e.g. unused `OrderWorkspace` registries). Wire new work into `OrderWorksheetModal` + a module.

---

## 3. Two-axis state model

Every stage interacts with **two order-level fields** plus optional **stage table** state.

### 3.1 `orders.stage` (pipeline position)

- String enum in `PipelineStage` (`src/types/index.ts`).
- **Must have a single canonical writer** for each transition (see §5).
- If UI maps/labels reference a stage value, some server action **must** persist it on the happy path.

### 3.2 `orders.stage_status` (approval lock)

| Value | Meaning |
|-------|---------|
| `Normal` | Stage editable; no admin gate |
| `Pending Admin Approval: …` | Staff pushed for approval; module should be read-only |

- Set by **freeze** or **request advancement** actions.
- Cleared by **admin approve**, **workflow choice**, or stage-specific admin action.

### 3.3 Stage table `completed` / status (when applicable)

| Stage | Table | Lock flag |
|-------|-------|-----------|
| Site Visit | `site_visits.completed` | `true` after freeze |
| Quotation | `quotations.status` | `Approved` hard-lock; `Sent` editable for revise/resend |
| Design | `designs.items[].versions[].status` | per proof |
| Production | `productions` milestones | checkboxes |
| Installation | `installations.status` | crew workflow |

**Freeze pattern (Site Visit reference):**

1. Persist stage data (save).
2. Dedicated **freeze/complete action** sets table lock **and** `orders.stage` **and** `orders.stage_status`.
3. UI read-only via helper (e.g. `isSiteVisitAuditFrozen`) that checks **both** `stage_status` and table flag (handles realtime race).

**Quotation lock pattern (current production):**

- `status === "Approved"` => locked
- `status === "Sent"` => still editable (staff/admin can revise and resend after customer or verbal feedback)

---

## 4. User roles & server auth

| Actor | Supabase DB role | Auth check in actions |
|-------|------------------|------------------------|
| Staff / Admin | `authenticated` + company RLS | `assertStageEditPermission(stage)` |
| Staff (assigned work) | same | `assertStaffAssignedToOrder(orderId)` when only assignee should edit |
| Customer portal | `anon` at DB layer; `portal_session` cookie at app layer | `assertStageEditOrPortalOrder(stage, orderId)` |
| Admin-only gates | same | `assertAdminOnly()` |

**Rules:**

1. **Every mutation** goes through a server action with one of the asserts above.
2. **UI `canEdit`** from `resolveStagePermission` must match server checks.
3. **Never** rely on anon RLS alone for authorization (public anon key is extractable).
4. Portal: server-render sensitive data; realtime on portal is **optional** and not required for site visit (customer sees data on load/refresh).

---

## 5. Action taxonomy (use the right tool)

| Intent | Site Visit (reference) | Generic / other stages |
|--------|------------------------|-------------------------|
| **Persist draft** | `updateSiteVisitDetailsAction` | `update*DetailsAction`, `upsertQuotation`, `updateDesignDetailsAction`, … |
| **Staff “done with my work”** | `freezeSiteVisitAction` via `SiteVisitReviewModal` | Stage-specific freeze **or** `requestStageAdvancementAction` |
| **Staff push to admin** | *Same as freeze* (not `requestStageAdvancementAction`) | `requestStageAdvancementAction` sets `stage_status` only |
| **Admin leave stage** | `setWorkflowTypeAction` (workflow fork) | `adminApproveStageAction` or stage-specific approve |
| **Admin god-mode stage jump** | `updateOrderStageAction` | Same — admin only, use sparingly |
| **Customer approve** | N/A (schedule only) | `approveQuotation`, `approveAllDesignItemsAction`, portal actions |

For Quotation, `sendQuotationToCustomer` is the canonical send path. Do not use `adminApproveStageAction` for quotation mid-states.

### Hard rejects (do not duplicate)

```text
requestStageAdvancementAction  → throws if stage.startsWith("Site Visit")
adminApproveStageAction        → throws if stage === "Site Visit Completed"
adminApproveStageAction        → throws if stage in {"Quotation In Progress","Quotation Sent","Quotation Negotiation"}
```

Site Visit exit **always**: `freezeSiteVisitAction` → admin `setWorkflowTypeAction`.

### When implementing another stage

Ask:

1. **Is there a domain “freeze”** (data locked, stage advanced)? → Dedicated `freeze*Action`, not generic advancement.
2. **Is admin approval a fork** (multiple valid next stages)? → Dedicated modal + action (like `WorkflowChoiceModal`).
3. **Does `requestStageAdvancementAction` only set `stage_status`?** → Ensure that is enough; if you also need `stage` or table flags, use a dedicated action.

---

## 6. UI shell conventions (`OrderWorksheetModal`)

### 6.1 Footer buttons (staff)

| Button | Behavior |
|--------|----------|
| **Save Draft** | `handleSaveDraft` → stage `update*Action`; no stage change |
| **Request Admin Approval** | Site Visit tab → review modal → freeze; other tabs → `requestStageAdvancementAction` |

### 6.2 Footer buttons (admin)

| Button | When shown |
|--------|------------|
| **Review & Lock Site Visit** | Site Visit tab, `stage_status === Normal` |
| **Choose Workflow & Approve** | Site Visit pending admin (`AdminControlModule`) |
| **Approve & Advance** | Other stages, tab matches pipeline, `stage_status === Normal` |

### 6.3 Quotation footer specifics (`QuotationModule`)

| Role | Status | Buttons |
|------|--------|---------|
| Staff/Admin | `Draft` / `Rejected` / legacy `Pending Approval` / `Sent` | Save Draft, Send to Customer |
| Admin | `Sent` | Approve without Customer & Advance (confirmation modal) |
| Staff | `Approved` + stage `Quotation Approved` | Request Advance to {Design/Production} (confirmation modal) |
| Admin | `Approved` + stage `Quotation Approved` | Move to {Design/Production} (confirmation modal) |

Send uses `QuotationConfirmModal`; override/advance uses `WorkflowAdvanceConfirmModal`.

### 6.4 Local state vs DB

- **While editing:** module updates parent `order` state via callbacks (`onUpdate`, `setOrder`).
- **Persist:** only on Save Draft or advance actions.
- **Realtime (staff):** other users see changes after Save Draft, not while typing.

### 6.5 Validation before advance

Validate in the **shell** before opening modals or calling actions (e.g. Site Visit requires `auditDate`, `auditTime`, `locations.length > 0`).

---

## 7. Data modeling

### 7.1 Site Visit pattern (follow for spatial/multi-row data)

| Concern | Where it lives |
|---------|----------------|
| Order-level flags (scaffolding, crane, fabrication…) | Parent table (`site_visits`) |
| Per-location dimensions, photos, electrical, structural | Child table (`site_visit_measurements`) |
| Legacy root columns on parent | **Removed** — do not reintroduce |

- **Mapper** maps parent + children → `SiteVisitDetails.locations[]`.
- **Save** upserts parent, upserts children, **deletes orphans** not in payload.
- **Downstream** stages consume `siteVisitItems` / measurements by id.

### 7.2 JSONB vs normalized

| Use normalized tables | Use JSONB on stage row |
|-----------------------|-------------------------|
| Rows queried independently, FK cascades, realtime per row | Nested UI-only blobs, version arrays |
| Measurements, payments | Design `items[].versions`, quotation line items |

### 7.3 Schema source of truth

1. **Printec-DB (Supabase MCP)** = production truth.
2. **Repo migrations** = local `supabase db reset` parity (idempotent `IF NOT EXISTS` / `DROP IF EXISTS`).
3. **`docs/DATABASE_SCHEMA.md`** = human catalog; update when schema changes.

Do not assume an old migration file matches prod without checking MCP.

---

## 8. Realtime (`useOrderDetailSync`)

### 8.1 Staff worksheet

| Table | Publication needed? | Who listens |
|-------|---------------------|-------------|
| `orders` | Yes | Stage/status changes |
| `site_visits` | Yes | Parent field sync |
| `site_visit_measurements` | Yes | Location sync **on save** |
| `quotations` | Yes | Quote tab |
| `designs`, `productions`, `installations` | Add when multi-user sync needed | Not yet on prod for all |

Hook filters by `order_id` / `site_visit_id`. Patches merge via `orderDetailPatch.ts`.

### 8.2 Portal

- **Not required** for site visit measurements/photos (server render on load).
- Do **not** add `anon SELECT using (true)` policies without scoped portal JWT (see security plan).

---

## 9. Storage & files

**Current (all stages):** browser `createClient()` → public bucket URL in JSONB.

**Target (all stages):** server-mediated upload, private bucket, signed URLs — see [`docs/portal-and-storage-security-plan.md`](./portal-and-storage-security-plan.md).

**Until then:**

- Store paths or URLs consistently per stage.
- On save, validate paths belong to the order (planned).
- Site visit photos: bucket `site-visit-photos`.

---

## 10. Revalidation & queues

After mutations, revalidate:

```text
revalidateStaffQueuePaths()
revalidatePath(`/admin/orders/${orderId}`)
revalidatePath(`/staff/orders/${orderId}`)
revalidatePath(`/portal`) + `/portal/order/${orderId}`  // when customer-visible
```

Queue pages filter by `orders.stage` lists — keep stage enums in sync with `PipelineStage`.

**Display heuristics** (e.g. show “Site Visit Pending” when `auditDate` missing) are **UI-only**; do not write alternate values to DB.

---

## 11. Activity, notifications, WhatsApp

On meaningful transitions, log to `order_activity` and dispatch templates where applicable.

| Event | Site Visit example |
|-------|-------------------|
| Schedule | `site_visit_scheduled` |
| Freeze | `site_visit_completed` |
| Admin workflow choice | timeline entry in `setWorkflowTypeAction` |

Other stages: mirror in their `*Actions.ts` files; keep `activity_type` / `metadata.action` consistent.

---

## 12. Stage checklist (copy before shipping a stage)

### Data & schema

- [ ] MCP verified columns match mapper and actions
- [ ] Idempotent migration added for local dev if schema changed
- [ ] `DATABASE_SCHEMA.md` updated
- [ ] No duplicate server paths for the same transition

### Actions

- [ ] `assertStageEditPermission` (or portal variant) on every mutation
- [ ] Assignment enforced if stage is assignee-scoped
- [ ] Dedicated freeze/complete action if data must lock
- [ ] `orders.stage` writer identified for each transition
- [ ] Generic actions guarded or not used where inappropriate

### UI

- [ ] Module under `workspace/modules/<stage>/`
- [ ] Wired only through `OrderWorksheetModal`
- [ ] Save Draft vs Push for Approval behavior documented
- [ ] Read-only when `stage_status` pending or domain lock flag set
- [ ] Admin path uses correct modal (not generic approve when fork exists)

### Realtime (staff)

- [ ] Stage table in `supabase_realtime` if multi-user save sync needed
- [ ] Patch handler in `orderDetailPatch.ts` if new shape

### Portal

- [ ] Server page loads data with joins; customer actions use portal session
- [ ] Realtime only if product requires live co-viewing

### Security

- [ ] No new `anon` `using (true)` policies without scoped JWT plan
- [ ] No secrets in `NEXT_PUBLIC_*`

---

## 13. Current stage alignment (honest status)

| Stage | Module | Dedicated freeze | stage writer | Staff realtime table | Notes |
|-------|--------|------------------|--------------|----------------------|-------|
| **Site Visit** | `SiteVisitModule` | `freezeSiteVisitAction` | Yes | measurements ✅ | **Reference** |
| **Quotation** | `QuotationModule` | via status + advancement | Partial | quotations ✅ | `Sent` editable, lock at `Approved`, guarded generic advance |
| **Design** | `DesignModule` | version status | `approveAllDesignItemsAction` | designs ❌ on prod | Production files gate |
| **Production** | `ProductionModule` | milestones | advancement + admin | productions ❌ | |
| **Installation** | `InstallationModule` | completion action | advancement + admin | installations ❌ | |

Use this table to prioritize refactors: **dedicated exit actions**, **realtime publication**, **storage hardening**.

---

## 14. Workflow routing reminder

After Site Visit, `orders.workflow_type` controls tab order:

| `workflow_type` | After site visit |
|-----------------|------------------|
| `quote_first` | Quotation → Design → Production → Installation |
| `design_first` | Design → Quotation → Production → Installation |

Only `setWorkflowTypeAction` should set `workflow_type` and the first post-site-visit stage together.

---

## 15. File map (quick reference)

```text
src/features/orders/
  actions/orderActions.ts          # Shared pipeline actions
  actions/siteVisitMapper.ts       # Site visit DB ↔ UI
  workspace/modules/<stage>/        # Stage UIs
  workspace/shared/
    stageGrants.ts                 # Who can edit which stage
    permissions.ts                 # resolveStagePermission (UI)
    serverPermissions.ts           # assert* (server)
  realtime/
    useOrderDetailSync.ts
    orderDetailPatch.ts

src/features/order-detail/components/
  OrderWorksheetModal.tsx          # Shell
  admin/AdminControlModule.tsx
  WorkflowChoiceModal.tsx

specs/site-visit.md                # Full site visit spec (reference)
docs/DATABASE_SCHEMA.md            # Table catalog
docs/portal-and-storage-security-plan.md
```

---

## 16. Anti-patterns (learned from Site Visit audit)

| Anti-pattern | Why it’s bad | Do instead |
|--------------|--------------|------------|
| `requestStageAdvancementAction` for site visit | Sets status without freeze | `freezeSiteVisitAction` |
| `adminApproveStageAction` leaving site visit | Skips workflow choice | `setWorkflowTypeAction` |
| Root columns for per-location data | Drift, double truth | Child table + mapper |
| Enum stage in UI with no writer | Queues/labels lie | Dedicated action sets `orders.stage` |
| Dead shell / registry not routed | Confuses contributors | Single `OrderWorksheetModal` |
| Broad anon RLS for portal realtime | Data exposure | Server render or scoped JWT |
| Per-keystroke realtime | Noise, cost | Sync on Save Draft |
| Trusting migration files over MCP | Local ≠ prod | Verify Printec-DB first |

---

## 17. Related specifications

| Stage / topic | Spec |
|---------------|------|
| Site Visit (reference) | [`specs/site-visit.md`](../specs/site-visit.md) |
| Quotation | [`specs/quotation.md`](../specs/quotation.md) |
| Design | [`specs/designer-workflow.md`](../specs/designer-workflow.md) |
| Production | [`specs/production.md`](../specs/production.md) |
| Installation | [`specs/installation.md`](../specs/installation.md) |
| Portal | [`specs/customer-portal.md`](../specs/customer-portal.md) |
| Payments (non-blocking) | [`specs/payments.md`](../specs/payments.md) |
| Master index | [`specs/readme.md`](../specs/readme.md) |

---

## Change log

| Version | Date | Summary |
|---------|------|---------|
| 1.0 | 2026-07-07 | Initial guidelines from Site Visit audit: shell, state model, actions, RBAC, realtime, schema, anti-patterns |
| 1.1 | 2026-07-07 | Quotation alignment: `Sent` editable until approved, explicit quotation footer button matrix, and guardrails for generic admin advance on site-visit/quotation mid-states |
