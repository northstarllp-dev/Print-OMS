import { describe, expect, it } from "vitest";
import {
  canSelectWorkflow,
  customerCanSelectWorkflow,
  designerCanSelectWorkflow,
  notifyRolesForWorkflow,
  productionCanSelectWorkflow,
  resolveConcurrentWorkflowChoice,
  salesExecutiveCanChangeWorkflowAfterApproval,
  staffQueueForFirstStage,
} from "@/features/orders/workflowSelectionLogic";
import { isStaffQueueCurrent } from "@/features/orders/workspace/shared/staffQueueStages";

describe("workflow selection security & notifications", () => {
  describe("RBAC", () => {
    it("only admin can select workflow", () => {
      expect(canSelectWorkflow("admin")).toBe(true);
      expect(canSelectWorkflow("staff")).toBe(false);
      expect(salesExecutiveCanChangeWorkflowAfterApproval()).toBe(false);
      expect(designerCanSelectWorkflow()).toBe(false);
      expect(productionCanSelectWorkflow()).toBe(false);
      expect(customerCanSelectWorkflow()).toBe(false);
    });
  });

  describe("Notifications / queues", () => {
    it("Quote First notifies sales/marketer; Design First notifies designer", () => {
      expect(notifyRolesForWorkflow("quote_first")).toContain("Marketer");
      expect(notifyRolesForWorkflow("design_first")).toContain("Designer");
    });

    it("first staff queue is quotation vs design", () => {
      expect(staffQueueForFirstStage("quote_first")).toBe("quotation");
      expect(staffQueueForFirstStage("design_first")).toBe("design");
    });

    it("Designer current work is Design stages only", () => {
      expect(isStaffQueueCurrent("Design In Progress", "design")).toBe(true);
      expect(isStaffQueueCurrent("Quotation In Progress", "design")).toBe(false);
    });

    it("Sales/quotation current work is Quotation stages only", () => {
      expect(isStaffQueueCurrent("Quotation In Progress", "quotation")).toBe(true);
      expect(isStaffQueueCurrent("Design In Progress", "quotation")).toBe(false);
    });
  });

  describe("Concurrency", () => {
    it("rejects stale overwrite when another workflow already applied", () => {
      expect(
        resolveConcurrentWorkflowChoice({
          attempted: "design_first",
          existing: "quote_first",
        }).ok
      ).toBe(false);
      expect(
        resolveConcurrentWorkflowChoice({
          attempted: "quote_first",
          existing: "quote_first",
        }).ok
      ).toBe(true);
    });

    it("rejects when updated_at diverged", () => {
      expect(
        resolveConcurrentWorkflowChoice({
          attempted: "design_first",
          existingUpdatedAt: "t2",
          clientSeenUpdatedAt: "t1",
        }).ok
      ).toBe(false);
    });
  });
});
