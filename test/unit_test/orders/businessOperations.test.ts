import { describe, expect, it } from "vitest";
import type { BusinessOperation } from "@/config/schema/businessOperations";
import {
  firstPipelineStageForOp,
  firstStageAfterSiteVisitModule,
  canChooseQuoteOrDesignAfterSiteVisit,
  getBusinessOperation,
  getPipelineStageOrderForOp,
  getStagesForOp,
  getWorksheetModuleKeysForOp,
  inferWorkflowTypeForBusinessOp,
  isPipelineStageInOp,
  isStageInOp,
  isWorksheetModuleDone,
  moduleKeyForPipelineStage,
  nextStageAfter,
  resolveStageOrder,
} from "@/features/orders/businessOperations";

const SIGNAGE: BusinessOperation = {
  id: "signage",
  label: "Signage",
  stages: [
    "enquiry",
    "site_visit",
    "quotation",
    "design",
    "production",
    "installation",
  ],
};

const FLEX: BusinessOperation = {
  id: "flex_printing",
  label: "Flex Printing",
  stages: ["enquiry", "quotation", "production", "installation"],
};

const FLEX_PRODUCTION_LAST: BusinessOperation = {
  id: "flex_printing_last",
  label: "Flex Printing (Production Last)",
  stages: ["enquiry", "quotation", "design", "production"],
};

const DESIGN_FIRST_OP: BusinessOperation = {
  id: "signage_design_first",
  label: "Signage (Design First)",
  stages: [
    "enquiry",
    "site_visit",
    "design",
    "quotation",
    "production",
    "installation",
  ],
};

const OPS = [SIGNAGE, FLEX, FLEX_PRODUCTION_LAST, DESIGN_FIRST_OP];

describe("businessOperations", () => {
  it("resolves known ops and falls back to signage", () => {
    expect(getBusinessOperation("flex_printing", OPS).id).toBe("flex_printing");
    expect(getBusinessOperation("unknown", OPS).id).toBe("signage");
    expect(getBusinessOperation(null, OPS).id).toBe("signage");
  });

  it("lists stages for an op", () => {
    expect(getStagesForOp("flex_printing", OPS)).toEqual([
      "enquiry",
      "quotation",
      "production",
      "installation",
    ]);
    expect(isStageInOp("flex_printing", "site_visit", OPS)).toBe(false);
    expect(isStageInOp("flex_printing", "quotation", OPS)).toBe(true);
  });

  it("builds pipeline order without site visit for flex", () => {
    const order = getPipelineStageOrderForOp("flex_printing", OPS);
    expect(order[0]).toBe("Quotation In Progress");
    expect(order).not.toContain("Site Visit Pending");
    expect(order).toContain("Production");
    expect(order.at(-1)).toBe("Closed");
  });

  it("supports design-before-quote via stage list order", () => {
    const order = getPipelineStageOrderForOp("signage_design_first", OPS);
    const designIdx = order.indexOf("Design In Progress");
    const quoteIdx = order.indexOf("Quotation In Progress");
    expect(designIdx).toBeGreaterThanOrEqual(0);
    expect(quoteIdx).toBeGreaterThan(designIdx);
  });

  it("returns next stage and skips excluded modules", () => {
    expect(nextStageAfter("signage", "Site Visit Completed", OPS)).toBe(
      "Quotation In Progress"
    );
    expect(nextStageAfter("flex_printing", "Quotation Approved", OPS)).toBe(
      "Production"
    );
    expect(nextStageAfter("flex_printing", "Closed", OPS)).toBeNull();
    expect(nextStageAfter("flex_printing_last", "Production", OPS)).toBe(
      "Completed"
    );
  });

  it("treats customer pickup as a branch, not the step after installation", () => {
    const order = getPipelineStageOrderForOp("signage", OPS);
    expect(order).not.toContain("Customer Pickup");
    expect(nextStageAfter("signage", "Installation Scheduled", OPS)).toBe(
      "Completed"
    );
    expect(moduleKeyForPipelineStage("Customer Pickup")).toBe("installation");
  });

  it("production-last flex has no installation stages", () => {
    const order = getPipelineStageOrderForOp("flex_printing_last", OPS);
    expect(order).toContain("Design In Progress");
    expect(order).toContain("Production");
    expect(order).not.toContain("Ready For Installation");
    expect(order).not.toContain("Installation Scheduled");
    expect(order).not.toContain("Site Visit Pending");
    expect(nextStageAfter("flex_printing_last", "Production", OPS)).toBe(
      "Completed"
    );
  });

  it("picks first pipeline stage for new orders", () => {
    expect(firstPipelineStageForOp("signage", OPS)).toBe("Site Visit Pending");
    expect(firstPipelineStageForOp("flex_printing", OPS)).toBe(
      "Quotation In Progress"
    );
  });

  it("maps pipeline stages to module keys", () => {
    expect(moduleKeyForPipelineStage("Design Approved")).toBe("design");
    expect(moduleKeyForPipelineStage("Site Visit Scheduled")).toBe("site_visit");
    expect(isPipelineStageInOp("flex_printing", "Site Visit Pending", OPS)).toBe(
      false
    );
    expect(isPipelineStageInOp("flex_printing", "Production", OPS)).toBe(true);
  });

  it("offers quote/design choice when both follow site visit", () => {
    expect(canChooseQuoteOrDesignAfterSiteVisit("signage", OPS)).toBe(true);
    expect(canChooseQuoteOrDesignAfterSiteVisit("signage_design_first", OPS)).toBe(
      true
    );
    expect(canChooseQuoteOrDesignAfterSiteVisit("flex_printing", OPS)).toBe(
      false
    );
    expect(
      canChooseQuoteOrDesignAfterSiteVisit("flex_printing_last", OPS)
    ).toBe(false);
  });

  it("picks first stage after site visit from business op", () => {
    expect(firstStageAfterSiteVisitModule("signage", OPS)).toBe(
      "Quotation In Progress"
    );
    expect(firstStageAfterSiteVisitModule("signage_design_first", OPS)).toBe(
      "Design In Progress"
    );
    expect(inferWorkflowTypeForBusinessOp("signage", OPS)).toBe("quote_first");
    expect(inferWorkflowTypeForBusinessOp("signage_design_first", OPS)).toBe(
      "design_first"
    );
  });

  it("design_first reorders Quote after Design for signage config", () => {
    const pipeline = getPipelineStageOrderForOp("signage", OPS, "design_first");
    expect(pipeline.indexOf("Design In Progress")).toBeLessThan(
      pipeline.indexOf("Quotation In Progress")
    );
    expect(nextStageAfter("signage", "Site Visit Completed", OPS, "design_first")).toBe(
      "Design In Progress"
    );
    expect(nextStageAfter("signage", "Design Approved", OPS, "design_first")).toBe(
      "Quotation In Progress"
    );
  });

  it("resolveStageOrder applies design_first on known ops", () => {
    const fromOp = resolveStageOrder("signage", "design_first", OPS);
    expect(fromOp.indexOf("Design In Progress")).toBeLessThan(
      fromOp.indexOf("Quotation In Progress")
    );
  });

  it("resolveStageOrder prefers business op stage list when workflow is quote_first", () => {
    const fromOp = resolveStageOrder("signage_design_first", "quote_first", OPS);
    expect(fromOp.indexOf("Design In Progress")).toBeLessThan(
      fromOp.indexOf("Quotation In Progress")
    );
  });

  it("design_first worksheet modules put Design before Quote", () => {
    const modules = getWorksheetModuleKeysForOp("signage", OPS, "design_first");
    expect(modules.indexOf("design")).toBeLessThan(modules.indexOf("quotation"));
    expect(
      isWorksheetModuleDone("quotation", "Design In Progress", "signage", OPS, "design_first")
    ).toBe(false);
    expect(
      isWorksheetModuleDone("site_visit", "Design In Progress", "signage", OPS, "design_first")
    ).toBe(true);
  });
});
