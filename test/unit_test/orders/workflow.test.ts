import { describe, expect, it } from "vitest";
import {
  countQueueViews,
  filterStaffQueueOrders,
  getPipelineStageOrder,
  isStaffQueueCompleted,
  isStaffQueueCurrent,
  isStaffQueueIncoming,
  partitionQueueOrdersByView,
} from "@/features/orders/workspace/shared/staffQueueStages";
import {
  getStagePermissionInContext,
  isTimelineStageAccessible,
  resolveStagePermission,
} from "@/features/orders/workspace/shared/permissions";
import { stageProgressPatch } from "@/features/orders/lib/orderHealth";

describe("order workflow / timeline / assignment", () => {
  describe("1. Business Operations — workflow", () => {
    it("uses quote_first pipeline by default and design_first when set", () => {
      expect(getPipelineStageOrder("quote_first")[3]).toBe("Quotation In Progress");
      expect(getPipelineStageOrder("design_first")[3]).toBe("Design In Progress");
    });

    it("classifies staff queue incoming / current / completed", () => {
      expect(isStaffQueueIncoming("Site Visit Pending", "quotation")).toBe(true);
      expect(isStaffQueueCurrent("Quotation Sent", "quotation")).toBe(true);
      expect(isStaffQueueCompleted("Production", "quotation")).toBe(true);
      expect(isStaffQueueIncoming("Site Visit Pending", "site_visit")).toBe(false);
    });
  });

  describe("2. Timeline / queue views", () => {
    const orders = [
      { id: "1", stage: "Site Visit Pending", workflow_type: "quote_first" as const },
      { id: "2", stage: "Quotation In Progress", workflow_type: "quote_first" as const },
      { id: "3", stage: "Production", workflow_type: "quote_first" as const },
    ];

    it("partitions and counts queue tabs", () => {
      expect(partitionQueueOrdersByView(orders, "quotation", "incoming").map((o) => o.id)).toEqual([
        "1",
      ]);
      expect(partitionQueueOrdersByView(orders, "quotation", "current").map((o) => o.id)).toEqual([
        "2",
      ]);
      expect(partitionQueueOrdersByView(orders, "quotation", "completed").map((o) => o.id)).toEqual([
        "3",
      ]);
      expect(countQueueViews(orders, "quotation")).toEqual({
        incoming: 1,
        current: 1,
        completed: 1,
      });
    });
  });

  describe("3. Assignment filtering", () => {
    it("staff queue requires assignment by default", () => {
      const orders = [
        {
          stage: "Production",
          assigned_employees: ["emp-1"],
          workflow_type: "quote_first" as const,
        },
        {
          stage: "Production",
          assigned_employees: ["emp-2"],
          workflow_type: "quote_first" as const,
        },
      ];
      expect(filterStaffQueueOrders(orders, "emp-1", "production")).toHaveLength(1);
      expect(
        filterStaffQueueOrders(orders, "emp-1", "production", { requireAssignment: false })
      ).toHaveLength(2);
    });
  });

  describe("4. Permissions / security", () => {
    it("admin has full view+edit; production edits production only", () => {
      expect(resolveStagePermission("design", { role: "admin" })).toEqual({
        canView: true,
        canEdit: true,
      });
      const prod = resolveStagePermission("production", {
        role: "staff",
        staff_role: "Production",
      });
      expect(prod.canEdit).toBe(true);
      expect(
        resolveStagePermission("quotation", {
          role: "staff",
          staff_role: "Production",
        }).canEdit
      ).toBe(false);
    });

    it("entryStage locks other stages to view-only for staff", () => {
      const inCtx = getStagePermissionInContext(
        "design",
        { role: "staff", staff_role: "Production" },
        "production"
      );
      expect(inCtx.canEdit).toBe(false);
      expect(isTimelineStageAccessible("production", { role: "admin" }, null)).toBe(true);
    });
  });

  describe("5. Stage change utility", () => {
    it("stage change patches stall clock and clears Needs Attention", () => {
      const patch = stageProgressPatch("Needs Attention");
      expect(patch.stage_changed_at).toBeTruthy();
      expect(patch.health).toBe("Active");
    });
  });

  describe("6. Scalability", () => {
    it("partitions large queues without blowing up", () => {
      const orders = Array.from({ length: 10_000 }, (_, i) => ({
        stage:
          i % 3 === 0
            ? "Site Visit Pending"
            : i % 3 === 1
              ? "Quotation Sent"
              : "Production",
        workflow_type: "quote_first" as const,
      }));
      const start = performance.now();
      const counts = countQueueViews(orders, "quotation");
      expect(counts.incoming + counts.current + counts.completed).toBe(10_000);
      expect(performance.now() - start).toBeLessThan(100);
    });
  });
});
