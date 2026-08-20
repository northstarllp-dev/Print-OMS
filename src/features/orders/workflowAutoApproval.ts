/**
 * Pure helpers for the per-stage workflow auto-approval setting.
 *
 * The DB column `app_settings.workflow_auto_approval` is a JSONB map of
 * stage key → boolean. When true, `requestStageAdvancementAction` advances
 * the order directly to the next stage instead of parking it in
 * `Pending Admin Approval: …` for an admin to click Approve.
 */

import type {
  WorkflowAutoApprovalMap,
  WorkflowAutoApprovalStageKey,
} from "@/features/settings/settingsTypes";

/** All known pending-label strings produced by `pendingApprovalLabelAfter`. */
export const PENDING_LABEL_TO_STAGE_KEY: Record<
  string,
  WorkflowAutoApprovalStageKey
> = {
  "Pending Admin Approval: Site Visit Completed": "site_visit",
  "Pending Admin Approval: Site Visit Schedule": "site_visit",
  "Pending Admin Approval: Quote Stage": "quotation",
  "Pending Admin Approval: Quote Approval": "quotation",
  "Pending Admin Approval: Design Stage": "design",
  "Pending Admin Approval: Design Approval": "design",
  "Pending Admin Approval: Production Ready": "production",
  "Pending Admin Approval: Job Done": "installation",
};

/**
 * Map a `Pending Admin Approval: …` label (or a raw stage string) to the
 * stage key the auto-approval setting is keyed on.
 *
 * Returns `null` for `"Normal"` or unknown labels — caller should treat
 * null as "no auto-approval path" and fall back to pending behavior.
 */
export function stageKeyForPendingLabel(
  label: string | null | undefined
): WorkflowAutoApprovalStageKey | null {
  if (!label || label === "Normal") return null;
  return PENDING_LABEL_TO_STAGE_KEY[label] ?? null;
}

/**
 * Map a raw order `stage` (e.g. "Site Visit Scheduled", "Quotation Approved")
 * to the stage key used by the auto-approval setting.
 *
 * Mirrors the `stageToPermission` map in `requestStageAdvancementAction`.
 */
export function stageKeyForOrderStage(
  stage: string | null | undefined
): WorkflowAutoApprovalStageKey | null {
  if (!stage) return null;
  if (stage.startsWith("Site Visit")) return "site_visit";
  if (stage.startsWith("Quotation")) return "quotation";
  if (stage.startsWith("Design")) return "design";
  if (stage === "Production") return "production";
  if (
    stage === "Ready For Installation" ||
    stage === "Installation Scheduled" ||
    stage === "Customer Pickup" ||
    stage === "Completed" ||
    stage === "Closed"
  ) {
    return "installation";
  }
  return null;
}

export function isAutoApprovalEnabledForStage(
  settings: WorkflowAutoApprovalMap | null | undefined,
  stageKey: WorkflowAutoApprovalStageKey
): boolean {
  return !!settings?.[stageKey];
}
