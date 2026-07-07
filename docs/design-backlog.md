# Design Workflow Backlog (Post-Audit)

Last updated: 2026-07-07
Scope: Leftover items after the Design workflow hardening and cleanup pass.

## Status Snapshot

Implemented in the prior session (closed):

- Fixed `design_first` advancement gate bypass in `OrderWorksheetModal`.
- Added server-side auth guards to stage-transition actions.
- Fixed portal design approval to always approve the latest version.
- Enforced portal scope checks in shared portal session guards.
- Removed dead design handlers/actions and unified all-approved checks.
- Removed debug logs and obvious unused design state from portal order detail client.

This document tracks **remaining** work.

---

## P0 - Security / Access Control

### 1) Harden storage upload authorization
- **Issue**: Design/resource/production uploads are client-direct to Storage; app auth validates only after upload when JSON is mutated.
- **Risk**: Unauthorized or malformed files can be uploaded if bucket policies are too permissive.
- **Recommended change**:
  - Move to signed upload flow (server action generates scoped upload token/path), **or**
  - enforce strict bucket `INSERT` policies tied to tenant/order/session claims.
- **Owner**: Backend + Supabase policy owner
- **Effort**: M
- **Dependencies**: Confirm intended portal upload auth model.

### 2) Replace public design asset URLs
- **Issue**: `getPublicUrl()` is used for design assets.
- **Risk**: Any leaked/guessed URL is readable.
- **Recommended change**:
  - Migrate design assets to private bucket semantics.
  - Serve via signed URLs (short TTL) from server-side endpoints.
- **Owner**: Backend + Frontend
- **Effort**: M/L
- **Dependencies**: Storage strategy and caching/CDN behavior decisions.

### 3) Enforce server/policy-level file validation
- **Issue**: MIME/extension restrictions are UI-only (`<input accept=...>`).
- **Risk**: Easy bypass; unacceptable file types can be stored.
- **Recommended change**:
  - Validate extension/content-type server-side at issuance or post-upload verification.
  - Restrict bucket accepted MIME/prefix paths where practical.
- **Owner**: Backend + Supabase policy owner
- **Effort**: M

---

## P1 - Correctness / Data Integrity

### 4) Strengthen optimistic concurrency model
- **Issue**: `expectedUpdatedAt` is present but stale-client race windows remain for rapid concurrent edits.
- **Risk**: Lost update edge cases.
- **Recommended change**:
  - Move to operation-based patching or server-side merge with conflict-aware retries.
  - Return conflict metadata for smarter client recovery.
- **Owner**: Backend + Frontend
- **Effort**: M

### 5) Ensure production-file delete always removes storage object
- **Issue**: Metadata delete is not guaranteed to clean underlying object across all paths.
- **Risk**: Storage orphan growth + stale billable objects.
- **Recommended change**:
  - Store canonical storage object key in metadata.
  - Delete by key transactionally with metadata update; add background orphan sweeper.
- **Owner**: Backend
- **Effort**: S/M

### 6) Replace pin/general mirror string coupling with explicit link IDs
- **Issue**: Pin/general comment relation relies on `Pin #N:` prefix.
- **Risk**: Fragile if editing/comment transformations are introduced.
- **Recommended change**:
  - Add `linkedCommentId` (or shared `threadId`) on mirrored comments.
- **Owner**: Frontend + Backend
- **Effort**: S

---

## P2 - UX / Consistency

### 7) Decide pin numbering strategy
- **Issue**: Numbering is monotonic and can show gaps after deletion.
- **Risk**: Mild user confusion.
- **Recommended change**:
  - Either keep monotonic and document in UI, or reindex display numbers only.
- **Owner**: Product + Frontend
- **Effort**: XS/S

### 8) De-duplicate item derivation logic
- **Issue**: `itemsList` derivation is duplicated in staff and portal modules.
- **Risk**: Future drift.
- **Recommended change**:
  - Extract shared helper (same semantics, same fallback behavior).
- **Owner**: Frontend
- **Effort**: S

---

## P3 - Type Surface / Cleanup

### 9) Remove or activate unused type states
- **Issue**:
  - `DesignVersion.status` includes unused `"Pending Admin"`.
  - `DesignComment.isDraft` not set by current flow.
  - `DesignVersion.aiFileUrl` unused.
  - `DesignResource.type: "link"` and `uploadedBy: "Staff"` currently unproduced by live flow.
- **Risk**: Developer confusion and accidental partial implementations.
- **Recommended change**:
  - Either remove unused fields/states, or implement full flows that produce/consume them.
- **Owner**: Frontend + Types owner
- **Effort**: S

---

## Performance / Scalability Backlog

### 10) Reduce full-payload rewrites on every mutation
- **Issue**: `updateDesignDetailsAction` writes full `items/resources` blobs even for tiny edits.
- **Risk**: Payload growth, write amplification, contention.
- **Recommended change**:
  - Introduce granular mutation operations and server-side patching.
- **Owner**: Backend + Frontend
- **Effort**: M/L

### 11) Narrow revalidation scope for design mutations
- **Issue**: Broad queue revalidation on small updates.
- **Risk**: Unnecessary cache churn and extra server work.
- **Recommended change**:
  - Revalidate only affected pages/tags; use targeted cache keys.
- **Owner**: Backend
- **Effort**: S/M

### 12) Add batching/debouncing for burst updates
- **Issue**: Repeated comment/update actions trigger repeated full mutation cycles.
- **Risk**: Extra load and race pressure.
- **Recommended change**:
  - Client-side batching/debounce where safe; coalesce operations.
- **Owner**: Frontend
- **Effort**: S/M

---

## Architecture / Long-Term

### 13) Re-evaluate JSONB monolith model (`designs.items`)
- **Issue**: Items/versions/comments/production files are fully nested JSONB.
- **Risk**: Hard indexing/querying, difficult partial updates at scale.
- **Recommended change**:
  - Consider normalized child tables (design_items, design_versions, design_comments, production_files) with migration plan.
- **Owner**: Architecture + Backend
- **Effort**: L

### 14) Split shared design/site-visit storage bucket
- **Issue**: `site-visit-photos` is shared across unrelated asset domains.
- **Risk**: Policy complexity and lifecycle coupling.
- **Recommended change**:
  - Move design assets to dedicated bucket with domain-specific policies.
- **Owner**: Backend + DevOps
- **Effort**: M

### 15) Add runtime schema validation for design payloads
- **Issue**: No schema validation layer before persistence.
- **Risk**: Silent malformed payload persistence.
- **Recommended change**:
  - Introduce runtime validation (e.g., zod) at server action boundaries.
- **Owner**: Backend
- **Effort**: S/M

### 16) Resolve portal realtime stance
- **Issue**: Realtime hook is wired in portal clients but `enabled: false`.
- **Risk**: Dead complexity and unclear product behavior.
- **Recommended change**:
  - Either enable safely (with hardened auth model), or remove dead wiring.
- **Owner**: Frontend + Backend
- **Effort**: S/M

---

## Suggested Next Session Plan

1. **Security sprint**: items 1-3 (storage auth, private URLs, file validation).
2. **Integrity sprint**: items 4-6 (concurrency, storage key cleanup, comment linkage).
3. **Performance sprint**: items 10-12 (granular mutations + targeted revalidation).
4. **Architecture decision RFC**: items 13-14 (JSONB vs normalized + bucket split).

