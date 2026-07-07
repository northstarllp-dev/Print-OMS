/** Portal tab id for a pipeline stage (quote_first / design_first aware for quotation vs design). */
export function getTabForStage(
  stage: string,
  workflowType: string = "quote_first"
): string {
  if (!stage) return "site_visit";
  if (stage.includes("Site Visit")) return "site_visit";
  if (stage.includes("Quotation")) return "quotation";
  if (stage.includes("Design")) return "design";
  if (stage.includes("Production") || stage.includes("Ready For")) return "billing";
  if (stage.includes("Installation") || stage.includes("Completed") || stage.includes("Closed")) {
    return "chat";
  }
  return "site_visit";
}

const TAB_PIPELINE_QUOTE_FIRST = [
  "site_visit",
  "quotation",
  "design",
  "payments",
  "billing",
  "chat",
] as const;

const TAB_PIPELINE_DESIGN_FIRST = [
  "site_visit",
  "design",
  "quotation",
  "payments",
  "billing",
  "chat",
] as const;

export function getTabPipelineIndex(
  tabId: string,
  workflowType: string = "quote_first"
): number {
  const order =
    workflowType === "design_first" ? TAB_PIPELINE_DESIGN_FIRST : TAB_PIPELINE_QUOTE_FIRST;
  const idx = order.indexOf(tabId as (typeof order)[number]);
  return idx === -1 ? 0 : idx;
}

/** True when stage moved forward along the portal tab pipeline (not backward). */
export function didStageAdvance(
  prevStage: string,
  nextStage: string,
  workflowType: string = "quote_first"
): boolean {
  const prevTab = getTabForStage(prevStage, workflowType);
  const nextTab = getTabForStage(nextStage, workflowType);
  if (prevTab === nextTab) return false;
  return (
    getTabPipelineIndex(nextTab, workflowType) >
    getTabPipelineIndex(prevTab, workflowType)
  );
}
