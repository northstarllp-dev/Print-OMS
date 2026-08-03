import { describe, expect, it } from "vitest";
import {
  PATH_DESIGN_FIRST,
  PATH_QUOTE_FIRST,
  WORKFLOW_CHOICE_DESCRIPTION,
  WORKFLOW_CHOICE_TITLE,
  canOpenWorkflowChoiceModal,
  isWorkflowChoiceSubmitLocked,
  shouldOfferWorkflowChoice,
  workflowDisplayName,
  workflowPathSteps,
  workflowSubtitle,
} from "@/features/orders/workflowSelectionLogic";

describe("workflow selection UI", () => {
  describe("Modal", () => {
    it("has correct title and description after site visit approval", () => {
      expect(WORKFLOW_CHOICE_TITLE).toBe("Choose Workflow Path");
      expect(WORKFLOW_CHOICE_DESCRIPTION).toMatch(/Site visit is approved/);
    });

    it("opens only after Site Visit pending approval", () => {
      expect(
        shouldOfferWorkflowChoice({
          stage: "Site Visit Completed",
          stageStatus: "Pending Admin Approval: Site Visit Completed",
        })
      ).toBe(true);
      expect(
        shouldOfferWorkflowChoice({
          stage: "Site Visit Completed",
          stageStatus: "Normal",
        })
      ).toBe(false);
      expect(
        shouldOfferWorkflowChoice({
          stage: "Quotation In Progress",
          stageStatus: "Pending Admin Approval",
        })
      ).toBe(false);
    });

    it("cannot open twice / already open", () => {
      expect(canOpenWorkflowChoiceModal({ alreadyOpen: true }).ok).toBe(false);
      expect(
        canOpenWorkflowChoiceModal({
          stage: "Quotation In Progress",
          workflowType: "quote_first",
        }).ok
      ).toBe(false);
      expect(
        canOpenWorkflowChoiceModal({
          stage: "Site Visit Completed",
          alreadyOpen: false,
        }).ok
      ).toBe(true);
    });
  });

  describe("Workflow Options", () => {
    it("Quote First path: Site Visit → Quote → Design → Production → Installation", () => {
      expect(PATH_QUOTE_FIRST.map((s) => s.label)).toEqual([
        "Site Visit",
        "Quote",
        "Design",
        "Production",
        "Installation",
      ]);
      expect(workflowSubtitle("quote_first")).toBe("Standard workflow");
      expect(workflowDisplayName("quote_first")).toBe("Quote First");
    });

    it("Design First path: Site Visit → Design → Quote → Production → Installation", () => {
      expect(PATH_DESIGN_FIRST.map((s) => s.label)).toEqual([
        "Site Visit",
        "Design",
        "Quote",
        "Production",
        "Installation",
      ]);
      expect(workflowSubtitle("design_first")).toBe("Design before quote");
      expect(workflowPathSteps("design_first")[1].label).toBe("Design");
    });
  });

  describe("Double Click", () => {
    it("locks both buttons while one choice is loading", () => {
      expect(isWorkflowChoiceSubmitLocked(null)).toBe(false);
      expect(isWorkflowChoiceSubmitLocked("quote_first")).toBe(true);
      expect(isWorkflowChoiceSubmitLocked("design_first")).toBe(true);
    });

    it("only one in-flight selection increments", () => {
      let writes = 0;
      let loading: "quote_first" | "design_first" | null = null;
      const click = (type: "quote_first" | "design_first") => {
        if (isWorkflowChoiceSubmitLocked(loading)) return;
        loading = type;
        writes += 1;
      };
      click("quote_first");
      click("quote_first");
      click("design_first");
      expect(writes).toBe(1);
    });
  });
});
