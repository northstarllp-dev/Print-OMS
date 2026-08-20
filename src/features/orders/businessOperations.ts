/**
 * Business operation helpers — pure stage-order / skip logic.
 * Ops are defined in client config; this module resolves them and maps
 * module keys → pipeline stage strings.
 */

import { loadClientConfig } from "@/config/loadClientConfig";
import {
  DEFAULT_BUSINESS_OPERATION_ID,
  DEFAULT_BUSINESS_OPERATIONS,
  type BusinessOperation,
  type BusinessStageKey,
} from "@/config/schema/businessOperations";
import type { PipelineStage } from "@/types";

/** Legacy workflow_type values (kept for resolveStageOrder fallback). */
type LegacyWorkflowType = "quote_first" | "design_first";

const LEGACY_QUOTE_FIRST = [
  "Site Visit Pending",
  "Site Visit Scheduled",
  "Site Visit Completed",
  "Quotation In Progress",
  "Quotation Sent",
  "Quotation Negotiation",
  "Quotation Approved",
  "Design In Progress",
  "Design Approved",
  "Production",
  "Ready For Installation",
  "Installation Scheduled",
  "Completed",
  "Closed",
] as const;

const LEGACY_DESIGN_FIRST = [
  "Site Visit Pending",
  "Site Visit Scheduled",
  "Site Visit Completed",
  "Design In Progress",
  "Design Approved",
  "Quotation In Progress",
  "Quotation Sent",
  "Quotation Negotiation",
  "Quotation Approved",
  "Production",
  "Ready For Installation",
  "Installation Scheduled",
  "Completed",
  "Closed",
] as const;

/** Pipeline stages that belong to each business-op module key. */
export const PIPELINE_STAGES_BY_MODULE: Record<BusinessStageKey, readonly string[]> = {
  enquiry: [],
  site_visit: [
    "Site Visit Pending",
    "Site Visit Scheduled",
    "Site Visit Completed",
  ],
  quotation: [
    "Quotation In Progress",
    "Quotation Sent",
    "Quotation Negotiation",
    "Quotation Approved",
  ],
  design: ["Design In Progress", "Design Approved"],
  production: ["Production"],
  installation: [
    "Ready For Installation",
    "Installation Scheduled",
    "Customer Pickup",
    "Completed",
    "Closed",
  ],
};

const TERMINAL_STAGES = ["Completed", "Closed"] as const;

/**
 * Alternate delivery path (Ready For Installation → Customer Pickup → Completed).
 * Not a linear step after Installation Scheduled.
 */
const NON_LINEAR_STAGES = new Set(["Customer Pickup"]);

export function getBusinessOperationsForTenant(
  ops?: BusinessOperation[] | null
): BusinessOperation[] {
  if (ops && ops.length > 0) return ops;
  try {
    const config = loadClientConfig();
    if (config.businessOperations?.length) return config.businessOperations;
  } catch {
    // fall through
  }
  return DEFAULT_BUSINESS_OPERATIONS;
}

export function getBusinessOperation(
  id: string | null | undefined,
  ops?: BusinessOperation[] | null
): BusinessOperation {
  const list = getBusinessOperationsForTenant(ops);
  const normalized = (id || DEFAULT_BUSINESS_OPERATION_ID).trim() || DEFAULT_BUSINESS_OPERATION_ID;
  return (
    list.find((o) => o.id === normalized) ||
    list.find((o) => o.id === DEFAULT_BUSINESS_OPERATION_ID) ||
    DEFAULT_BUSINESS_OPERATIONS[0]
  );
}

export function getStagesForOp(
  opId: string | null | undefined,
  ops?: BusinessOperation[] | null
): BusinessStageKey[] {
  return [...getBusinessOperation(opId, ops).stages];
}

export function isStageInOp(
  opId: string | null | undefined,
  stage: BusinessStageKey,
  ops?: BusinessOperation[] | null
): boolean {
  return getStagesForOp(opId, ops).includes(stage);
}

/**
 * When workflow_type is design_first and both quotation + design exist,
 * move design before quotation (legacy Quote/Design choice behavior).
 */
export function reorderModulesForWorkflowType(
  modules: BusinessStageKey[],
  workflowType?: LegacyWorkflowType | string | null
): BusinessStageKey[] {
  if (workflowType !== "design_first") return [...modules];
  const quoteIdx = modules.indexOf("quotation");
  const designIdx = modules.indexOf("design");
  if (quoteIdx < 0 || designIdx < 0 || designIdx < quoteIdx) {
    return [...modules];
  }
  const without = modules.filter((m) => m !== "quotation" && m !== "design");
  const insertAt = Math.min(quoteIdx, designIdx);
  return [
    ...without.slice(0, insertAt),
    "design",
    "quotation",
    ...without.slice(insertAt),
  ];
}

/**
 * Build the full pipeline stage order for a business op.
 * Module keys expand to their granular PipelineStage strings in the order listed.
 * Terminal Completed/Closed always appear at the end (once).
 * Optional workflowType reorders Quote vs Design (design_first).
 */
export function getPipelineStageOrderForOp(
  opId: string | null | undefined,
  ops?: BusinessOperation[] | null,
  workflowType?: LegacyWorkflowType | string | null
): string[] {
  const modules = reorderModulesForWorkflowType(
    getStagesForOp(opId, ops).filter((m) => m !== "enquiry") as BusinessStageKey[],
    workflowType
  );
  const order: string[] = [];
  const seen = new Set<string>();

  for (const mod of modules) {
    for (const s of PIPELINE_STAGES_BY_MODULE[mod] || []) {
      if (TERMINAL_STAGES.includes(s as (typeof TERMINAL_STAGES)[number])) continue;
      if (NON_LINEAR_STAGES.has(s)) continue;
      if (seen.has(s)) continue;
      seen.add(s);
      order.push(s);
    }
  }

  for (const t of TERMINAL_STAGES) {
    if (!seen.has(t)) {
      seen.add(t);
      order.push(t);
    }
  }

  return order;
}

/**
 * Prefer business-op stage order, with workflow_type applied for Quote/Design order.
 * Fall back to legacy workflow_type maps only when the op id is unknown.
 */
export function resolveStageOrder(
  opId: string | null | undefined,
  legacyWorkflowType?: LegacyWorkflowType | string | null,
  ops?: BusinessOperation[] | null
): string[] {
  const list = getBusinessOperationsForTenant(ops);
  const normalized = (opId || "").trim();
  const known = Boolean(normalized && list.some((o) => o.id === normalized));

  if (known) {
    return getPipelineStageOrderForOp(normalized, ops, legacyWorkflowType);
  }

  if (legacyWorkflowType === "design_first") {
    return [...LEGACY_DESIGN_FIRST];
  }
  if (legacyWorkflowType === "quote_first") {
    return [...LEGACY_QUOTE_FIRST];
  }

  return getPipelineStageOrderForOp(
    normalized || DEFAULT_BUSINESS_OPERATION_ID,
    ops,
    legacyWorkflowType
  );
}

/** Next pipeline stage after `current`, within the op's stage order. */
export function nextStageAfter(
  opId: string | null | undefined,
  current: string,
  ops?: BusinessOperation[] | null,
  workflowType?: LegacyWorkflowType | string | null
): string | null {
  const order = getPipelineStageOrderForOp(opId, ops, workflowType);
  const idx = order.indexOf(current);
  if (idx === -1) return null;
  if (idx >= order.length - 1) return null;
  return order[idx + 1] ?? null;
}

/** First non-enquiry pipeline stage for a new order under this op. */
export function firstPipelineStageForOp(
  opId: string | null | undefined,
  ops?: BusinessOperation[] | null
): string {
  const order = getPipelineStageOrderForOp(opId, ops);
  return order[0] || "Site Visit Pending";
}

/** Module key that owns a granular pipeline stage string. */
export function moduleKeyForPipelineStage(stage: string): BusinessStageKey | null {
  for (const [key, stages] of Object.entries(PIPELINE_STAGES_BY_MODULE) as [
    BusinessStageKey,
    readonly string[],
  ][]) {
    if (stages.includes(stage)) return key;
  }
  return null;
}

/** Whether a granular pipeline stage is part of the business op. */
export function isPipelineStageInOp(
  opId: string | null | undefined,
  pipelineStage: string,
  ops?: BusinessOperation[] | null
): boolean {
  const mod = moduleKeyForPipelineStage(pipelineStage);
  if (!mod) return true; // unknown stages: don't block
  if (mod === "enquiry") return true;
  // Terminal stages always allowed
  if (TERMINAL_STAGES.includes(pipelineStage as (typeof TERMINAL_STAGES)[number])) {
    return isStageInOp(opId, "installation", ops) || isStageInOp(opId, "production", ops);
  }
  return isStageInOp(opId, mod, ops);
}

/** First pipeline stage after the site-visit module for this op (e.g. Quotation / Design). */
export function firstStageAfterSiteVisitModule(
  opId: string | null | undefined,
  ops?: BusinessOperation[] | null
): string {
  const order = getPipelineStageOrderForOp(opId, ops);
  const siteStages = new Set<string>(PIPELINE_STAGES_BY_MODULE.site_visit);
  let lastSiteIdx = -1;
  for (let i = 0; i < order.length; i++) {
    if (siteStages.has(order[i])) lastSiteIdx = i;
  }
  if (lastSiteIdx >= 0) {
    for (let i = lastSiteIdx + 1; i < order.length; i++) {
      const s = order[i];
      if (!TERMINAL_STAGES.includes(s as (typeof TERMINAL_STAGES)[number])) {
        return s;
      }
    }
  }
  // Op has no site visit — first non-terminal stage
  const first = order.find(
    (s) => !TERMINAL_STAGES.includes(s as (typeof TERMINAL_STAGES)[number])
  );
  return first || "Quotation In Progress";
}

/** Infer legacy workflow_type from where the op goes after site visit. */
export function inferWorkflowTypeForBusinessOp(
  opId: string | null | undefined,
  ops?: BusinessOperation[] | null
): "quote_first" | "design_first" {
  const next = firstStageAfterSiteVisitModule(opId, ops);
  return next.startsWith("Design") ? "design_first" : "quote_first";
}

/**
 * True when the op includes site visit AND both quotation + design afterward —
 * admin should pick Quote First vs Design First (legacy workflow modal).
 */
export function canChooseQuoteOrDesignAfterSiteVisit(
  opId: string | null | undefined,
  ops?: BusinessOperation[] | null
): boolean {
  const stages = getStagesForOp(opId, ops);
  if (!stages.includes("site_visit")) return false;
  const after = stages.slice(stages.indexOf("site_visit") + 1);
  return after.includes("quotation") && after.includes("design");
}

/** Pending admin approval label for advancing FROM `current` under this op. */
export function pendingApprovalLabelAfter(
  opId: string | null | undefined,
  current: string,
  ops?: BusinessOperation[] | null,
  workflowType?: LegacyWorkflowType | string | null
): string {
  if (
    current === "Site Visit Pending" ||
    current === "Site Visit Scheduled"
  ) {
    return "Pending Admin Approval: Site Visit Completed";
  }
  if (current === "Site Visit Completed") {
    const next = nextStageAfter(opId, current, ops, workflowType);
    if (next?.startsWith("Design")) return "Pending Admin Approval: Design Stage";
    if (next?.startsWith("Quotation")) return "Pending Admin Approval: Quote Stage";
    if (next === "Production") return "Pending Admin Approval: Production Ready";
    return "Pending Admin Approval: Quote Stage";
  }
  if (
    current === "Quotation In Progress" ||
    current === "Quotation Sent" ||
    current === "Quotation Negotiation"
  ) {
    return "Pending Admin Approval: Quote Approval";
  }
  if (current === "Quotation Approved") {
    const next = nextStageAfter(opId, current, ops, workflowType);
    if (next?.startsWith("Design")) return "Pending Admin Approval: Design Stage";
    if (next === "Production") return "Pending Admin Approval: Production Ready";
    return "Pending Admin Approval: Production Ready";
  }
  if (current === "Design In Progress") {
    return "Pending Admin Approval: Design Approval";
  }
  if (current === "Design Approved") {
    const next = nextStageAfter(opId, current, ops, workflowType);
    if (next?.startsWith("Quotation")) return "Pending Admin Approval: Quote Stage";
    if (next === "Production") return "Pending Admin Approval: Production Ready";
    return "Pending Admin Approval: Production Ready";
  }
  if (current === "Production") {
    const next = nextStageAfter(opId, current, ops, workflowType);
    if (next === "Completed") {
      return "Pending Admin Approval: Job Done";
    }
    return "Pending Admin Approval: Production Ready";
  }
  if (current === "Installation Scheduled") {
    return "Pending Admin Approval: Job Done";
  }
  if (current === "Customer Pickup") {
    return "Pending Admin Approval: Job Done";
  }
  return "Normal";
}

/** Portal / worksheet module step descriptors (icons supplied by UI). */
export type PortalStepKey = BusinessStageKey | "payments";

export function getPortalStepKeysForOp(
  opId: string | null | undefined,
  ops?: BusinessOperation[] | null,
  workflowType?: LegacyWorkflowType | string | null
): PortalStepKey[] {
  const stages = reorderModulesForWorkflowType(
    getStagesForOp(opId, ops) as BusinessStageKey[],
    workflowType
  );
  const keys: PortalStepKey[] = [...stages];
  if (!keys.includes("payments" as PortalStepKey)) {
    keys.push("payments");
  }
  return keys;
}

/**
 * Map a DB pipeline stage string → index in the portal step list for this op.
 */
export function getStepIndexForOp(
  pipelineStage: string,
  opId: string | null | undefined,
  ops?: BusinessOperation[] | null,
  workflowType?: LegacyWorkflowType | string | null
): number {
  const keys = getPortalStepKeysForOp(opId, ops, workflowType);
  const mod = moduleKeyForPipelineStage(pipelineStage);
  if (!mod) {
    const s = (pipelineStage || "").toLowerCase();
    if (s.includes("payment")) {
      const pi = keys.indexOf("payments");
      return pi >= 0 ? pi : 0;
    }
    return 0;
  }
  const idx = keys.indexOf(mod);
  return idx >= 0 ? idx : 0;
}

/** Worksheet tab module keys (no enquiry/payments). */
export function getWorksheetModuleKeysForOp(
  opId: string | null | undefined,
  ops?: BusinessOperation[] | null,
  workflowType?: LegacyWorkflowType | string | null
): BusinessStageKey[] {
  // Derive from pipeline so Quote/Design order always matches resolveStageOrder.
  const pipeline = getPipelineStageOrderForOp(opId, ops, workflowType);
  const modules: BusinessStageKey[] = [];
  for (const stage of pipeline) {
    const mod = moduleKeyForPipelineStage(stage);
    if (!mod || mod === "enquiry") continue;
    if (!modules.includes(mod)) modules.push(mod);
  }
  return modules;
}

/** True when every pipeline stage in this module sits before the order's current stage. */
export function isWorksheetModuleDone(
  moduleKey: BusinessStageKey,
  currentStage: string,
  opId: string | null | undefined,
  ops?: BusinessOperation[] | null,
  workflowType?: LegacyWorkflowType | string | null
): boolean {
  const pipeline = getPipelineStageOrderForOp(opId, ops, workflowType);
  const currentIdx = pipeline.indexOf(currentStage);
  if (currentIdx < 0) return false;
  const modStages = PIPELINE_STAGES_BY_MODULE[moduleKey] || [];
  let lastIdx = -1;
  for (const s of modStages) {
    const i = pipeline.indexOf(s);
    if (i > lastIdx) lastIdx = i;
  }
  return lastIdx >= 0 && currentIdx > lastIdx;
}

export function tabIndexForModule(
  modules: BusinessStageKey[],
  moduleKey: BusinessStageKey
): number {
  return modules.indexOf(moduleKey);
}

export function moduleForTabIndex(
  modules: BusinessStageKey[],
  tabIndex: number
): BusinessStageKey | null {
  return modules[tabIndex] ?? null;
}

export type { BusinessOperation, BusinessStageKey, PipelineStage };
