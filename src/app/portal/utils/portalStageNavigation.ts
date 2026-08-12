import {
  getStagesForOp,
  moduleKeyForPipelineStage,
  reorderModulesForWorkflowType,
} from "@/features/orders/businessOperations";
import type { BusinessStageKey } from "@/config/schema/businessOperations";

const DETAIL_PIPELINE_TABS = ["site_visit", "quotation", "design"] as const;
type DetailPipelineTab = (typeof DETAIL_PIPELINE_TABS)[number];

/** Portal detail tabs derived from business-op stage order (+ payments/billing). */
export function getDetailTabPipeline(
  businessOperation?: string,
  workflowType?: string | null
): string[] {
  const stages = reorderModulesForWorkflowType(
    getStagesForOp(businessOperation || "signage") as BusinessStageKey[],
    workflowType
  ).filter((s) =>
    (DETAIL_PIPELINE_TABS as readonly string[]).includes(s)
  ) as DetailPipelineTab[];
  return [...stages, "payments", "billing"];
}

/** Portal tab id for a pipeline stage (business-op aware). */
export function getTabForStage(
  stage: string,
  businessOperation: string = "signage",
  workflowType?: string | null
): string {
  if (!stage) {
    return getDetailTabPipeline(businessOperation, workflowType)[0] || "site_visit";
  }
  const mod = moduleKeyForPipelineStage(stage);
  if (mod === "production" || mod === "installation") return "billing";
  if (mod && (DETAIL_PIPELINE_TABS as readonly string[]).includes(mod)) {
    const pipeline = getDetailTabPipeline(businessOperation, workflowType);
    return pipeline.includes(mod) ? mod : pipeline[0] || "billing";
  }
  if (stage.includes("Site Visit")) return "site_visit";
  if (stage.includes("Quotation")) return "quotation";
  if (stage.includes("Design")) return "design";
  if (
    stage.includes("Production") ||
    stage.includes("Ready For") ||
    stage.includes("Installation") ||
    stage.includes("Completed") ||
    stage.includes("Closed")
  ) {
    return "billing";
  }
  return getDetailTabPipeline(businessOperation, workflowType)[0] || "site_visit";
}

export function getTabPipelineIndex(
  tabId: string,
  businessOperation: string = "signage",
  workflowType?: string | null
): number {
  const order = getDetailTabPipeline(businessOperation, workflowType);
  const idx = order.indexOf(tabId);
  return idx === -1 ? 0 : idx;
}

/** True when stage moved forward along the portal tab pipeline (not backward). */
export function didStageAdvance(
  prevStage: string,
  nextStage: string,
  businessOperation: string = "signage",
  workflowType?: string | null
): boolean {
  const prevTab = getTabForStage(prevStage, businessOperation, workflowType);
  const nextTab = getTabForStage(nextStage, businessOperation, workflowType);
  if (prevTab === nextTab) return false;
  return (
    getTabPipelineIndex(nextTab, businessOperation, workflowType) >
    getTabPipelineIndex(prevTab, businessOperation, workflowType)
  );
}
