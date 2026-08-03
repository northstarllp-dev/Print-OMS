import { describe, expect, it } from "vitest";
import {
  buildWorkflowChoiceUpdate,
  firstStageAfterWorkflowChoice,
  isValidWorkflowType,
  shouldOfferWorkflowChoice,
  workflowPathSteps,
} from "@/features/orders/workflowSelectionLogic";
import { getPipelineStageOrder } from "@/features/orders/workspace/shared/staffQueueStages";

describe("workflow selection edge cases & performance", () => {
  describe("Validation", () => {
    it("prevents selecting none / invalid", () => {
      expect(isValidWorkflowType(null)).toBe(false);
      expect(isValidWorkflowType("")).toBe(false);
      expect(isValidWorkflowType("both")).toBe(false);
    });

    it("does not offer choice when site visit approval revoked (Normal again)", () => {
      expect(
        shouldOfferWorkflowChoice({
          stage: "Site Visit Completed",
          stageStatus: "Normal",
        })
      ).toBe(false);
    });

    it("does not offer when order already progressed", () => {
      expect(
        shouldOfferWorkflowChoice({
          stage: "Production",
          stageStatus: "Pending Admin Approval",
        })
      ).toBe(false);
    });
  });

  describe("Database contracts", () => {
    it("persists lowercase quote_first / design_first (not QUOTE_FIRST)", () => {
      expect(buildWorkflowChoiceUpdate("quote_first").workflow_type).toBe(
        "quote_first"
      );
      expect(buildWorkflowChoiceUpdate("design_first").workflow_type).toBe(
        "design_first"
      );
    });
  });

  describe("Performance", () => {
    it("path + pipeline lookups are cheap for many orders", () => {
      const t0 = performance.now();
      for (let i = 0; i < 10_000; i++) {
        firstStageAfterWorkflowChoice(i % 2 === 0 ? "quote_first" : "design_first");
        workflowPathSteps(i % 2 === 0 ? "quote_first" : "design_first");
        getPipelineStageOrder(i % 2 === 0 ? "quote_first" : "design_first");
      }
      expect(performance.now() - t0).toBeLessThan(100);
    });
  });

  describe("Configuration (future)", () => {
    it("documents that only two workflows are hard-coded today", () => {
      // Future: company-configurable stage graphs. Today: two fixed paths.
      expect(workflowPathSteps("quote_first")).toHaveLength(5);
      expect(workflowPathSteps("design_first")).toHaveLength(5);
    });
  });
});
