import { describe, expect, it } from "vitest";
import { getPipelineStageOrder } from "@/features/orders/workspace/shared/staffQueueStages";
import {
  buildWorkflowChoiceActivity,
  buildWorkflowChoiceUpdate,
  canChangeWorkflowLater,
  firstStageAfterWorkflowChoice,
  isValidWorkflowType,
  isWorkflowSelectionLocked,
  portalProgressLabels,
} from "@/features/orders/workflowSelectionLogic";

describe("workflow selection business logic", () => {
  describe("Business Logic", () => {
    it("Quote First advances to Quotation In Progress", () => {
      expect(firstStageAfterWorkflowChoice("quote_first")).toBe(
        "Quotation In Progress"
      );
      const update = buildWorkflowChoiceUpdate("quote_first");
      expect(update).toEqual({
        workflow_type: "quote_first",
        stage: "Quotation In Progress",
        stage_status: "Normal",
        stage_admin_notes: "",
      });
    });

    it("Design First advances to Design In Progress", () => {
      expect(firstStageAfterWorkflowChoice("design_first")).toBe(
        "Design In Progress"
      );
      expect(buildWorkflowChoiceUpdate("design_first").stage).toBe(
        "Design In Progress"
      );
    });

    it("pipeline order puts Quote before Design for quote_first", () => {
      const order = getPipelineStageOrder("quote_first");
      expect(order.indexOf("Quotation In Progress")).toBeLessThan(
        order.indexOf("Design In Progress")
      );
    });

    it("pipeline order puts Design before Quote for design_first", () => {
      const order = getPipelineStageOrder("design_first");
      expect(order.indexOf("Design In Progress")).toBeLessThan(
        order.indexOf("Quotation In Progress")
      );
    });

    it("rejects invalid workflow type", () => {
      expect(isValidWorkflowType("QUOTE_FIRST")).toBe(false);
      expect(isValidWorkflowType("quote_first")).toBe(true);
      expect(isValidWorkflowType("design_first")).toBe(true);
    });
  });

  describe("Edit Rules", () => {
    it("locks workflow once past the first post-site-visit stage", () => {
      expect(
        isWorkflowSelectionLocked({
          workflowType: "quote_first",
          stage: "Quotation In Progress",
        })
      ).toBe(false);
      expect(
        isWorkflowSelectionLocked({
          workflowType: "quote_first",
          stage: "Quotation Sent",
        })
      ).toBe(true);
      expect(
        canChangeWorkflowLater({
          workflowType: "design_first",
          stage: "Design Approved",
        }).ok
      ).toBe(false);
    });
  });

  describe("Audit / Timeline payload", () => {
    it("builds activity content and metadata", () => {
      const activity = buildWorkflowChoiceActivity("design_first");
      expect(activity.content).toMatch(/Design First/);
      expect(activity.content).toMatch(/Design In Progress/);
      expect(activity.metadata).toEqual({
        action: "workflow_type_set",
        workflow_type: "design_first",
        stage: "Design In Progress",
      });
    });
  });

  describe("Portal Synchronization", () => {
    it("portal progress labels follow chosen path", () => {
      expect(portalProgressLabels("quote_first")).toEqual([
        "Site Visit",
        "Quote",
        "Design",
        "Production",
        "Installation",
      ]);
      expect(portalProgressLabels("design_first")[1]).toBe("Design");
      expect(portalProgressLabels("design_first")[2]).toBe("Quote");
    });
  });
});
