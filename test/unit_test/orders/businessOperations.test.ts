import { describe, expect, it } from "vitest";
import type { BusinessOperation } from "@/config/schema/businessOperations";
import {
  firstPipelineStageForOp,
  getBusinessOperation,
  getPipelineStageOrderForOp,
  getStagesForOp,
  isPipelineStageInOp,
  isStageInOp,
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

  it("resolveStageOrder prefers business op over legacy workflow_type", () => {
    const fromOp = resolveStageOrder("signage_design_first", "quote_first", OPS);
    expect(fromOp.indexOf("Design In Progress")).toBeLessThan(
      fromOp.indexOf("Quotation In Progress")
    );
  });
});
