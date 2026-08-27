import type { OrderStage, StageActor, StagePermission } from "./types";
import { resolveStageGrant } from "./stageGrants";

const NO_ACCESS: StagePermission = { canView: false, canEdit: false };
const VIEW_EDIT: StagePermission = { canView: true, canEdit: true };

/**
 * Central RBAC resolver for order workspace stages.
 *
 * Authority only does not encode workflow locks (stage_status, completed, etc.)
 * or queue-scoped entry context (see getStagePermissionInContext /
 * isTimelineStageAccessible). Modules must never call this; pages / OrderWorkspace
 * pass the result as `permission`.
 *
 * Reads the per-role grant matrix from stageGrants config. Phase 4b/5: load
 * grants from DB without changing this signature.
 */
export function resolveStagePermission(
  stage: OrderStage,
  actor: StageActor
): StagePermission {
  if (actor.role === "admin") {
    return VIEW_EDIT;
  }

  if (actor.role !== "staff") {
    return NO_ACCESS;
  }

  return resolveStageGrant(actor, stage);
}

/**
 * Queue-scoped permission (Gate C). When entryStage is set (staff entered from
 * a specific queue), only that stage keeps its full grant; every other stage
 * is forced to view-only for that session even if the role's base config
 * would allow editing it.
 *
 * Workflow progress (hasStageBeenReached) is a separate concern handled at
 * call sites; do not merge it into this function.
 */
export function getStagePermissionInContext(
  stage: OrderStage,
  actor: StageActor,
  entryStage?: OrderStage | null
): StagePermission {
  if (actor.role === "admin") {
    return VIEW_EDIT;
  }

  const base = resolveStagePermission(stage, actor);

  if (entryStage == null || stage === entryStage) {
    return base;
  }

  // Outside the entry stage: never editable this session, but keep canView.
  return { canView: base.canView, canEdit: false };
}

/**
 * Whether a timeline stage node is clickable (navigable) for this actor.
 * Composed of Gate A (config grant: canView) and Gate C (queue context).
 *
 * Workflow progress (Gate B / hasStageBeenReached) is intentionally NOT
 * checked here call sites compose it with `||` so a stage that hasn't been
 * reached stays locked regardless of grants.
 */
export function isTimelineStageAccessible(
  stage: OrderStage,
  actor: StageActor,
  entryStage?: OrderStage | null
): boolean {
  return getStagePermissionInContext(stage, actor, entryStage).canView;
}
