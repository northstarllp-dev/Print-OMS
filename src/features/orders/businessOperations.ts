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
    "Completed",
    "Closed",
  ],
};

const TERMINAL_STAGES = ["Completed", "Closed"] as const;

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
 * Build the full pipeline stage order for a business op.
 * Module keys expand to their granular PipelineStage strings in the order listed.
 * Terminal Completed/Closed always appear at the end (once).
 */
export function getPipelineStageOrderForOp(
  opId: string | null | undefined,
  ops?: BusinessOperation[] | null
): string[] {
  const modules = getStagesForOp(opId, ops).filter((m) => m !== "enquiry");
  const order: string[] = [];
  const seen = new Set<string>();

  for (const mod of modules) {
    for (const s of PIPELINE_STAGES_BY_MODULE[mod] || []) {
      if (TERMINAL_STAGES.includes(s as (typeof TERMINAL_STAGES)[number])) continue;
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
 * Prefer business-op stage order. Fall back to legacy workflow_type only when
 * the op id is unknown AND a workflow type is provided.
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
    return getPipelineStageOrderForOp(normalized, ops);
  }

  if (legacyWorkflowType === "design_first") {
    return [...LEGACY_DESIGN_FIRST];
  }
  if (legacyWorkflowType === "quote_first") {
    return [...LEGACY_QUOTE_FIRST];
  }

  return getPipelineStageOrderForOp(normalized || DEFAULT_BUSINESS_OPERATION_ID, ops);
}

/** Next pipeline stage after `current`, within the op's stage order. */
export function nextStageAfter(
  opId: string | null | undefined,
  current: string,
  ops?: BusinessOperation[] | null
): string | null {
  const order = getPipelineStageOrderForOp(opId, ops);
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

/** Pending admin approval label for advancing FROM `current` under this op. */
export function pendingApprovalLabelAfter(
  opId: string | null | undefined,
  current: string,
  ops?: BusinessOperation[] | null
): string {
  if (
    current === "Site Visit Pending" ||
    current === "Site Visit Scheduled"
  ) {
    return "Pending Admin Approval: Site Visit Completed";
  }
  if (current === "Site Visit Completed") {
    const next = nextStageAfter(opId, current, ops);
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
    const next = nextStageAfter(opId, current, ops);
    if (next?.startsWith("Design")) return "Pending Admin Approval: Design Stage";
    if (next === "Production") return "Pending Admin Approval: Production Ready";
    return "Pending Admin Approval: Production Ready";
  }
  if (current === "Design In Progress") {
    return "Pending Admin Approval: Design Approval";
  }
  if (current === "Design Approved") {
    const next = nextStageAfter(opId, current, ops);
    if (next?.startsWith("Quotation")) return "Pending Admin Approval: Quote Stage";
    if (next === "Production") return "Pending Admin Approval: Production Ready";
    return "Pending Admin Approval: Production Ready";
  }
  if (current === "Production") {
    const next = nextStageAfter(opId, current, ops);
    if (next === "Completed") {
      return "Pending Admin Approval: Job Done";
    }
    return "Pending Admin Approval: Production Ready";
  }
  if (current === "Installation Scheduled") {
    return "Pending Admin Approval: Job Done";
  }
  return "Normal";
}

/** Portal / worksheet module step descriptors (icons supplied by UI). */
export type PortalStepKey = BusinessStageKey | "payments";

export function getPortalStepKeysForOp(
  opId: string | null | undefined,
  ops?: BusinessOperation[] | null
): PortalStepKey[] {
  const stages = getStagesForOp(opId, ops);
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
  ops?: BusinessOperation[] | null
): number {
  const keys = getPortalStepKeysForOp(opId, ops);
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
  ops?: BusinessOperation[] | null
): BusinessStageKey[] {
  return getStagesForOp(opId, ops).filter(
    (s) => s !== "enquiry"
  ) as BusinessStageKey[];
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
