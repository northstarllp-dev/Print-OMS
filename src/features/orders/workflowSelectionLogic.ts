/** Pure workflow-selection helpers (after Site Visit approval). */

import {
  getPipelineStageOrder,
  type WorkflowType,
} from "@/features/orders/workspace/shared/staffQueueStages";

export type { WorkflowType };

export const WORKFLOW_OPTIONS = ["quote_first", "design_first"] as const;

export const WORKFLOW_CHOICE_TITLE = "Choose Workflow Path";
export const WORKFLOW_CHOICE_DESCRIPTION =
  "Site visit is approved. How do you want to proceed for this order?";

export const PATH_QUOTE_FIRST = [
  { icon: "📍", label: "Site Visit" },
  { icon: "📄", label: "Quote" },
  { icon: "🎨", label: "Design" },
  { icon: "🏭", label: "Production" },
  { icon: "🔧", label: "Installation" },
] as const;

export const PATH_DESIGN_FIRST = [
  { icon: "📍", label: "Site Visit" },
  { icon: "🎨", label: "Design" },
  { icon: "📄", label: "Quote" },
  { icon: "🏭", label: "Production" },
  { icon: "🔧", label: "Installation" },
] as const;

export function workflowPathSteps(workflowType: WorkflowType) {
  return workflowType === "design_first" ? PATH_DESIGN_FIRST : PATH_QUOTE_FIRST;
}

export function workflowDisplayName(workflowType: WorkflowType): string {
  return workflowType === "design_first" ? "Design First" : "Quote First";
}

export function workflowSubtitle(workflowType: WorkflowType): string {
  return workflowType === "design_first" ? "Design before quote" : "Standard workflow";
}

/** First post–site-visit stage after choosing a workflow. */
export function firstStageAfterWorkflowChoice(workflowType: WorkflowType): string {
  return workflowType === "design_first"
    ? "Design In Progress"
    : "Quotation In Progress";
}

export function isValidWorkflowType(value: unknown): value is WorkflowType {
  return value === "quote_first" || value === "design_first";
}

/** Modal should open only when leaving Site Visit with pending admin approval. */
export function shouldOfferWorkflowChoice(input: {
  stage?: string | null;
  stageStatus?: string | null;
  workflowType?: string | null;
}): boolean {
  const stage = input.stage || "";
  if (!stage.startsWith("Site Visit")) return false;
  if (!input.stageStatus || input.stageStatus === "Normal") return false;
  return true;
}

/** Quote vs Design fork exists only when the business op includes both modules. */
export function businessOpNeedsWorkflowChoice(stageKeys: readonly string[]): boolean {
  return stageKeys.includes("quotation") && stageKeys.includes("design");
}

export function impliedWorkflowTypeForOp(stageKeys: readonly string[]): WorkflowType {
  if (stageKeys.includes("design") && !stageKeys.includes("quotation")) {
    return "design_first";
  }
  return "quote_first";
}

/** Block opening if workflow already applied (order left Site Visit). */
export function canOpenWorkflowChoiceModal(input: {
  stage?: string | null;
  workflowType?: string | null;
  alreadyOpen?: boolean;
}): { ok: boolean; reason?: string } {
  if (input.alreadyOpen) {
    return { ok: false, reason: "Workflow choice already open" };
  }
  if (isValidWorkflowType(input.workflowType) && !(input.stage || "").startsWith("Site Visit")) {
    return { ok: false, reason: "Workflow already selected" };
  }
  return { ok: true };
}

export function isWorkflowSelectionLocked(input: {
  stage?: string | null;
  workflowType?: string | null;
}): boolean {
  const stage = input.stage || "";
  if (!isValidWorkflowType(input.workflowType)) return false;
  // Lock once work begins past the first post-site-visit stage
  const order = getPipelineStageOrder(input.workflowType);
  const first = firstStageAfterWorkflowChoice(input.workflowType);
  const firstIdx = order.indexOf(first as (typeof order)[number]);
  const stageIdx = order.indexOf(stage as (typeof order)[number]);
  if (firstIdx < 0 || stageIdx < 0) return true;
  return stageIdx > firstIdx;
}

export function canChangeWorkflowLater(input: {
  stage?: string | null;
  workflowType?: string | null;
}): { ok: boolean; reason?: string } {
  if (!isValidWorkflowType(input.workflowType)) {
    return { ok: true };
  }
  if (isWorkflowSelectionLocked(input)) {
    return {
      ok: false,
      reason: "Workflow locked after quotation or design work has started",
    };
  }
  return { ok: true };
}

export function canSelectWorkflow(role?: string | null): boolean {
  return role === "admin";
}

export function salesExecutiveCanChangeWorkflowAfterApproval(): boolean {
  return false;
}

export function designerCanSelectWorkflow(): boolean {
  return false;
}

export function productionCanSelectWorkflow(): boolean {
  return false;
}

export function customerCanSelectWorkflow(): boolean {
  return false;
}

/** Double-submit lock while a choice is in flight. */
export function isWorkflowChoiceSubmitLocked(
  loading: WorkflowType | null
): boolean {
  return loading != null;
}

export function buildWorkflowChoiceUpdate(workflowType: WorkflowType): {
  workflow_type: WorkflowType;
  stage: string;
  stage_status: "Normal";
  stage_admin_notes: string;
} {
  return {
    workflow_type: workflowType,
    stage: firstStageAfterWorkflowChoice(workflowType),
    stage_status: "Normal",
    stage_admin_notes: "",
  };
}

export function buildWorkflowChoiceActivity(workflowType: WorkflowType): {
  content: string;
  metadata: { action: string; workflow_type: WorkflowType; stage: string };
} {
  const stage = firstStageAfterWorkflowChoice(workflowType);
  return {
    content: `Workflow path set to "${workflowDisplayName(workflowType)}". Order advanced to ${stage}.`,
    metadata: {
      action: "workflow_type_set",
      workflow_type: workflowType,
      stage,
    },
  };
}

/**
 * Default workflow_type to apply when auto-approval advances an order past
 * Site Visit and the business op supports both quotation AND design (which
 * normally requires an admin to choose via the workflow modal).
 *
 * Per product decision: default to `quote_first`.
 *
 * For ops where only one of quote/design exists, callers should use
 * `inferWorkflowTypeForBusinessOp` from `businessOperations.ts` instead.
 */
export function defaultWorkflowTypeForAutoApproval(
  canChooseQuoteOrDesign: boolean
): WorkflowType {
  return canChooseQuoteOrDesign ? "quote_first" : "quote_first";
}

/** Who should be notified after selection (role hints for queues). */
export function notifyRolesForWorkflow(workflowType: WorkflowType): string[] {
  return workflowType === "design_first"
    ? ["Designer", "Admin"]
    : ["Marketer", "Admin"];
}

export function staffQueueForFirstStage(workflowType: WorkflowType): "quotation" | "design" {
  return workflowType === "design_first" ? "design" : "quotation";
}

/**
 * Optimistic concurrency: reject if another admin already set a different workflow.
 */
export function resolveConcurrentWorkflowChoice(input: {
  attempted: WorkflowType;
  existing?: string | null;
  existingUpdatedAt?: string | null;
  clientSeenUpdatedAt?: string | null;
}): { ok: boolean; reason?: string } {
  if (
    isValidWorkflowType(input.existing) &&
    input.existing !== input.attempted
  ) {
    return {
      ok: false,
      reason: `Conflict: workflow already set to ${workflowDisplayName(input.existing)}`,
    };
  }
  if (
    input.existingUpdatedAt &&
    input.clientSeenUpdatedAt &&
    input.existingUpdatedAt !== input.clientSeenUpdatedAt
  ) {
    return { ok: false, reason: "Conflict: order was updated by another user" };
  }
  return { ok: true };
}

/** High-level stage labels for portal progress (matches modal path). */
export function portalProgressLabels(workflowType: WorkflowType): string[] {
  return workflowPathSteps(workflowType).map((s) => s.label);
}
