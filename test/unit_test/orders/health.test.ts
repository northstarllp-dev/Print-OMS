import { describe, expect, it } from "vitest";
import {
  ORDER_HEALTH_VALUES,
  buildHealthUpdatePayload,
  canManageOrderHealth,
  filterOrders,
  healthMenuActions,
  isAllowedHealthTransition,
  isOrderStalledCandidate,
  isValidLostReason,
  requiresLostReasonPrompt,
  stallCutoffIso,
  type OrderListRow,
} from "@/features/orders/orderListLogic";
import { isOrderHealth, stageProgressPatch } from "@/features/orders/lib/orderHealth";

describe("order health", () => {
  describe("1. Business Operations", () => {
    it("exposes Active / Needs Attention / On Hold / Lost", () => {
      expect(ORDER_HEALTH_VALUES).toEqual([
        "Active",
        "Needs Attention",
        "On Hold",
        "Lost",
      ]);
      expect(isOrderHealth("On Hold")).toBe(true);
      expect(isOrderHealth("Warning")).toBe(false);
    });

    it("On Hold and Mark Lost appear from Active menu", () => {
      expect(healthMenuActions("Active").map((a) => a.health)).toEqual(["On Hold", "Lost"]);
      expect(healthMenuActions("On Hold").map((a) => a.health)).toEqual(["Active", "Lost"]);
      expect(healthMenuActions("Lost")).toEqual([{ health: "Active", label: "Reopen (Active)" }]);
      expect(isAllowedHealthTransition("Active", "On Hold")).toBe(true);
      expect(isAllowedHealthTransition("Active", "Needs Attention")).toBe(false);
    });
  });

  describe("2. Functions / Validation", () => {
    it("requires non-blank lost reason when marking Lost", () => {
      expect(requiresLostReasonPrompt("Lost", undefined)).toBe(true);
      expect(requiresLostReasonPrompt("On Hold", undefined)).toBe(false);
      expect(isValidLostReason("Budget")).toBe(true);
      expect(isValidLostReason("  ")).toBe(false);
    });

    it("writes lost_reason only when health is Lost", () => {
      expect(buildHealthUpdatePayload("Lost", "Price")).toEqual({
        health: "Lost",
        lost_reason: "Price",
      });
      expect(buildHealthUpdatePayload("On Hold", "Price")).toEqual({
        health: "On Hold",
        lost_reason: null,
      });
    });

    it("stage progress clears Needs Attention back to Active", () => {
      const patch = stageProgressPatch("Needs Attention");
      expect(patch.health).toBe("Active");
      expect(patch.lost_reason).toBeNull();
      expect(stageProgressPatch("On Hold").health).toBeUndefined();
    });
  });

  describe("3. Components / filter", () => {
    it("health filter defaults null health to Active", () => {
      const rows: OrderListRow[] = [
        {
          id: "1",
          health: null,
          stage: "Production",
          dateCreated: "2026-08-01T00:00:00.000Z",
        },
        {
          id: "2",
          health: "Lost",
          stage: "Production",
          dateCreated: "2026-08-01T00:00:00.000Z",
        },
      ];
      expect(filterOrders(rows, { healthFilter: "Active", dateFilterType: "all" }).map((r) => r.id)).toEqual([
        "1",
      ]);
      expect(filterOrders(rows, { healthFilter: "Lost", dateFilterType: "all" }).map((r) => r.id)).toEqual([
        "2",
      ]);
    });
  });

  describe("4. Backend stall flag", () => {
    it("flags Active non-terminal orders past cutoff", () => {
      const cutoff = stallCutoffIso(6, new Date("2026-08-10T00:00:00.000Z"));
      expect(
        isOrderStalledCandidate(
          {
            health: "Active",
            stage: "Production",
            stage_changed_at: "2026-08-01T00:00:00.000Z",
          },
          cutoff
        )
      ).toBe(true);
      expect(
        isOrderStalledCandidate(
          {
            health: "On Hold",
            stage: "Production",
            stage_changed_at: "2026-08-01T00:00:00.000Z",
          },
          cutoff
        )
      ).toBe(false);
      expect(
        isOrderStalledCandidate(
          {
            health: "Active",
            stage: "Completed",
            stage_changed_at: "2026-08-01T00:00:00.000Z",
          },
          cutoff
        )
      ).toBe(false);
    });
  });

  describe("5. Security", () => {
    it("only admin manages health from the list menu", () => {
      expect(canManageOrderHealth({ role: "Admin" })).toBe(true);
      expect(canManageOrderHealth({ role: "Employee" })).toBe(false);
    });
  });
});
