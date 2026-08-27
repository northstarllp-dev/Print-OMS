/**
 * Pure helpers for Admin God Mode (unlock frozen/locked stages).
 * Server actions still call assertAdminOnly() when adminOverride is true.
 */

/** Closed / completed orders never keep God Mode unlocked. */
export function resolveEffectiveAdminOverride(
  isOrderClosed: boolean,
  adminOverrideUnlocked: boolean
): boolean {
  return !isOrderClosed && adminOverrideUnlocked;
}

/**
 * Stage module editability after freeze + RBAC + God Mode unlock.
 * Matches Site Visit / Production / Installation UI gates.
 */
export function isStageModuleEditable(input: {
  baseFrozen: boolean;
  adminOverrideUnlocked?: boolean;
  canEdit?: boolean;
}): boolean {
  const canEdit = input.canEdit ?? true;
  return canEdit && (!input.baseFrozen || !!input.adminOverrideUnlocked);
}

/** Design locked while pending admin approval on a design stage. */
export function isDesignPendingAdminLocked(
  stage: string,
  stageStatus: string | null | undefined
): boolean {
  if (!stageStatus || stageStatus === "Normal") return false;
  return stage === "Design In Progress" || stage === "Design Approved";
}

/**
 * Throws when design is pending-admin locked unless God Mode override is set.
 * Caller must verify admin via assertAdminOnly when adminOverride is true.
 */
export function assertDesignEditable(
  stage: string,
  stageStatus: string | null | undefined,
  adminOverride = false
): void {
  if (adminOverride) return;
  if (isDesignPendingAdminLocked(stage, stageStatus)) {
    throw new Error(
      "Design is locked pending admin approval. Please wait for admin review or requested changes."
    );
  }
}

/** Auth path for stage save actions when the client requests God Mode. */
export function resolveStageSaveAuthMode(
  adminOverride: boolean
): "admin_only" | "stage_permission" {
  return adminOverride ? "admin_only" : "stage_permission";
}
