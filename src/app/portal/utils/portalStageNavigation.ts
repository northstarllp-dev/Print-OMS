import {
  getStagesForOp,
  moduleKeyForPipelineStage,
} from "@/features/orders/businessOperations";

const DETAIL_PIPELINE_TABS = ["site_visit", "quotation", "design"] as const;
type DetailPipelineTab = (typeof DETAIL_PIPELINE_TABS)[number];

/** Portal detail tabs derived from business-op stage order (+ payments/billing). */
export function getDetailTabPipeline(businessOperation?: string): string[] {
  const stages = getStagesForOp(businessOperation || "signage").filter((s) =>
    (DETAIL_PIPELINE_TABS as readonly string[]).includes(s)
  ) as DetailPipelineTab[];
  return [...stages, "payments", "billing"];
}

/** Portal tab id for a pipeline stage (business-op aware). */
export function getTabForStage(
  stage: string,
  businessOperation: string = "signage"
): string {
  if (!stage) {
    return getDetailTabPipeline(businessOperation)[0] || "site_visit";
  }
  const mod = moduleKeyForPipelineStage(stage);
  if (mod === "production" || mod === "installation") return "billing";
  if (mod && (DETAIL_PIPELINE_TABS as readonly string[]).includes(mod)) {
    const pipeline = getDetailTabPipeline(businessOperation);
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
  return getDetailTabPipeline(businessOperation)[0] || "site_visit";
}

export function getTabPipelineIndex(
  tabId: string,
  businessOperation: string = "signage"
): number {
  const order = getDetailTabPipeline(businessOperation);
  const idx = order.indexOf(tabId);
  return idx === -1 ? 0 : idx;
}

/** True when stage moved forward along the portal tab pipeline (not backward). */
export function didStageAdvance(
  prevStage: string,
  nextStage: string,
  businessOperation: string = "signage"
): boolean {
  const prevTab = getTabForStage(prevStage, businessOperation);
  const nextTab = getTabForStage(nextStage, businessOperation);
  if (prevTab === nextTab) return false;
  return (
    getTabPipelineIndex(nextTab, businessOperation) >
    getTabPipelineIndex(prevTab, businessOperation)
  );
}
