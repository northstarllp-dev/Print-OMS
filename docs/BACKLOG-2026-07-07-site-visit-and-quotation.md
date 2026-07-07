# Backlog — Site Visit + Quotation (Post-Audit)

> Date: 2026-07-07  
> Scope: Remaining work after Site Visit and Quotation audits/fixes  
> Sources reviewed: `specs/site-visit.md`, `specs/quotation.md`, `docs/order-stage-guidelines.md`, `docs/CHANGELOG-2026-07-07-quotation-session.md`, `.cursor/plans/site_visit_realtime_sync_331ce98c.plan.md`, latest code behavior

---

## 1) Site Visit — Completed vs Remaining

### Completed (already fixed)

- Dedicated freeze flow is in place: `freezeSiteVisitAction` + review modal path.
- Generic stage misuse protections added:
  - `requestStageAdvancementAction` blocked for Site Visit stages.
  - `adminApproveStageAction` blocked for `Site Visit Completed`.
- Shared detail realtime pattern implemented (`useOrderDetailSync`) and wired to order detail surfaces.

### Remaining backlog

| Priority | Item | Why it matters | Suggested implementation |
|---|---|---|---|
| P0 | Add server auth checks on admin-only actions | `setWorkflowTypeAction`, `adminApproveStageAction`, `updateOrderStageAction` still rely largely on UI pathing | Add `assertAdminOnly()` to admin-only actions in `orderActions.ts` |
| P0 | Secure schedule action path | `scheduleSiteVisitAction` is used by portal and staff but has no explicit portal/staff assert at entry | Use `assertStageEditOrPortalOrder("site_visit", orderId)` or equivalent split checks |
| P1 | Resolve dead/unused `approveSiteVisitAction` flow | Creates alternate `stage_status` (`Pending Admin Approval: Site Visit Schedule`) but not used by current UI | Either wire it intentionally or remove/deprecate action + status branch |
| P1 | Decide fate of `Site Visit Completed` stage value | Stage appears in enums/maps but is not canonical write target in active flow | Either implement canonical writer or remove from pipeline maps/queue assumptions |
| P1 | Delete orphaned `site_visit_measurements` rows on save | Current save upserts but can leave stale removed rows behind | Diff payload vs DB rows and delete missing ids in `updateSiteVisitDetailsAction` |
| P2 | Add timeline entries for Site Visit draft saves | Freeze/schedule are logged; save-draft is silent | Insert lightweight `order_activity` event for significant save checkpoints |
| P2 | Storage hardening | Client-side uploads to public URLs still riskier than server-mediated approach | Move to server upload + signed URLs per `portal-and-storage-security-plan` |
| P2 | Align migration/schema drift for site-visit requirement fields | Mapper uses fields that may not be consistently present in all envs | Add/verify idempotent migration and sync `DATABASE_SCHEMA.md` |

---

## 2) Quotation — Completed vs Remaining

### Completed (already fixed)

- Mandatory pre-send admin gate removed; unified send path for staff/admin.
- Mid-quotation generic advance blocked (`adminApproveStageAction` guard for quotation mid-states).
- Quotation sent/resend logic improved; customer revision loop works.
- Confirmation modals added for high-risk footer actions:
  - Send to Customer
  - Approve without Customer & Advance
  - Move/Request Advance
- `Sent` status now editable (no hard freeze until approval/advance).
- Site Visit + quotation wording/guardrail cleanup in shell and guidelines.

### Remaining backlog

| Priority | Item | Why it matters | Suggested implementation |
|---|---|---|---|
| P0 | Update `specs/quotation.md` to match latest behavior | Spec currently still mentions `Sent` as locked in multiple sections; now `Sent` is editable | Revise rules, permissions, transitions, and UI matrix to avoid doc drift |
| P1 | Quotation versioning model for revision history | Current revise/resend overwrites single row; limited audit for historical quote bodies | Add revision table or immutable revision records (`quotation_revisions`) |
| P1 | Approval threshold policy (optional admin gate by exception) | Current flow is fast but lacks policy guardrails (discount/terms exceptions) | Add rule-triggered review flag based on discount/margin/custom terms |
| P1 | Finish `QuotationModule` extraction cleanup | Inline modal implementations still duplicate extracted component files | Import extracted components, remove inline copies, remove `.bak` |
| P1 | Replace `alert()` UX in portal quotation actions | Alerts are disruptive and inconsistent with in-app UX | Move to inline toast/banner error states in `useQuotationActions` consumers |
| P2 | Add tests for status transitions + totals | High-change workflow area should be regression-protected | Unit tests for `quotationSecurity.ts` and `computeQuotationTotals` |
| P2 | Clean legacy `Pending Approval` rows | Legacy status still supported but should phase out | Optional one-time migration to map legacy rows to `Draft` where appropriate |

---

## 3) Cross-Stage / System Backlog (Affects Both)

| Priority | Item | Why it matters |
|---|---|---|
| P0 | Portal/security policy hardening for broad anon realtime access | Existing broad anon SELECT patterns on non-quotation tables remain a security concern |
| P1 | Consistent action-level authorization audit | Ensure every mutation action has explicit role/session assertion, not only UI gating |
| P1 | Queue/list refresh consistency audits after stage actions | Keep list freshness stable without adding list realtime |
| P2 | Stage docs synchronization discipline | Avoid divergence between specs and actual code after fast workflow changes |

---

## 4) Recommended execution order

1. **P0 security/auth hardening** (Site Visit admin actions + schedule path checks, portal policy review)  
2. **P0/P1 documentation sync** (`specs/quotation.md` now out-of-date vs code)  
3. **P1 workflow quality** (quotation versioning, threshold policy, module extraction cleanup)  
4. **P2 robustness** (tests + UX polish + legacy data cleanup)

---

## 5) Quick “ready to move ahead” checklist

- [ ] Site Visit admin-only and portal/staff assertions added to action layer  
- [ ] Quotation spec updated to reflect editable `Sent` and new modal behavior  
- [ ] Decision made: keep or remove `approveSiteVisitAction` path  
- [ ] Decision made: quotation revision history model (single-row vs versioned)

