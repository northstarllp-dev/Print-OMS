import type { OrderStage, StageActor, StagePermission } from "./types";
import { getEditableStages } from "./stageGrants";

const VIEW_ONLY: StagePermission = { canView: true, canEdit: false };
const VIEW_EDIT: StagePermission = { canView: true, canEdit: true };

/**
 * Central RBAC resolver for order workspace stages.
 *
 * Authority only — does not encode workflow locks (stage_status, completed, etc.)
 * or queue-scoped entry context (see isTimelineStageAccessible).
 * Modules must never call this; pages / OrderWorkspace pass the result as `permission`.
 *
 * Temporary adapter: uses role + staff_role via stageGrants config.
 * Phase 4b/5: load grants from tenant config or DB without changing this signature.
 */
export function resolveStagePermission(
  stage: OrderStage,
  actor: StageActor
): StagePermission {
  if (actor.role === "admin") {
    return VIEW_EDIT;
  }

  if (actor.role !== "staff") {
    return VIEW_ONLY;
  }

  const editableStages = getEditableStages(actor);

  if (editableStages.length === 0) {
    return VIEW_ONLY;
  }

  return editableStages.includes(stage) ? VIEW_EDIT : VIEW_ONLY;
}

/**
 * Whether a timeline stage node is clickable for this actor.
 * Queue-scoped: when entryStage is set (staff entered from a specific queue),
 * only that stage is accessible even if the actor has broader edit grants.
 */
export function isTimelineStageAccessible(
  stage: OrderStage,
  actor: StageActor,
  entryStage?: OrderStage | null
): boolean {
  if (actor.role === "admin") {
    return true;
  }

  if (!resolveStagePermission(stage, actor).canEdit) {
    return false;
  }

  if (entryStage != null) {
    return stage === entryStage;
  }

  return true;
}
