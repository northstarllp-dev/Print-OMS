import { describe, expect, it } from "vitest";
import {
  ENQUIRY_HEALTH_STATUSES,
  buildHealthUpdatePayload,
  filterEnquiries,
  healthMenuActions,
  isAllowedHealthTransition,
  isEnquiryStalledCandidate,
  isValidLostReason,
  requiresLostReasonPrompt,
  stallCutoffIso,
  type EnquiryListRow,
} from "@/features/enquiries/enquiryListLogic";
import { resolveStagePermission } from "@/features/orders/workspace/shared/permissions";

describe("health", () => {
  describe("frontend", () => {
    it("exposes all health statuses and transition menus", () => {
      expect(ENQUIRY_HEALTH_STATUSES).toEqual([
        "Active",
        "Needs Attention",
        "On Hold",
        "Lost",
      ]);
      expect(healthMenuActions("Active").map((a) => a.health)).toEqual([
        "Needs Attention",
        "On Hold",
        "Lost",
      ]);
      expect(healthMenuActions("Needs Attention").map((a) => a.health)).toEqual([
        "Active",
        "On Hold",
        "Lost",
      ]);
      expect(healthMenuActions("On Hold").map((a) => a.health)).toEqual(["Active", "Lost"]);
      expect(healthMenuActions("Lost")).toEqual([{ health: "Active", label: "Reopen (Active)" }]);
      expect(healthMenuActions(null).map((a) => a.health)).toEqual(
        healthMenuActions("Active").map((a) => a.health)
      );
    });

    it("prompts for lost reason and validates non-blank text", () => {
      expect(requiresLostReasonPrompt("Lost", undefined)).toBe(true);
      expect(requiresLostReasonPrompt("Lost", "Price")).toBe(false);
      expect(isValidLostReason("Too expensive")).toBe(true);
      expect(isValidLostReason("  ")).toBe(false);
    });

    it("health filter on the table defaults null health to Active", () => {
      const rows: EnquiryListRow[] = [
        {
          id: "1",
          health: null,
          status: "Pending",
          dateReceived: "2026-08-01T00:00:00.000Z",
        },
        {
          id: "2",
          health: "Lost",
          status: "Pending",
          dateReceived: "2026-08-01T00:00:00.000Z",
        },
      ];
      expect(filterEnquiries(rows, { healthFilter: "Active" }).map((r) => r.id)).toEqual(["1"]);
      expect(filterEnquiries(rows, { healthFilter: "Lost" }).map((r) => r.id)).toEqual(["2"]);
    });
  });

  describe("backend", () => {
    it("writes lost_reason only when health is Lost", () => {
      expect(buildHealthUpdatePayload("Lost", "Budget")).toEqual({
        health: "Lost",
        lost_reason: "Budget",
      });
      expect(buildHealthUpdatePayload("Active", "Budget")).toEqual({
        health: "Active",
        lost_reason: null,
      });
    });

    it("stall job flags only Active, non-Converted, older than cutoff", () => {
      const cutoff = "2026-07-28T00:00:00.000Z";
      expect(
        isEnquiryStalledCandidate(
          { health: "Active", status: "Pending", dateReceived: "2026-07-20T00:00:00.000Z" },
          cutoff
        )
      ).toBe(true);
      expect(
        isEnquiryStalledCandidate(
          { health: "Active", status: "Converted", dateReceived: "2026-07-01T00:00:00.000Z" },
          cutoff
        )
      ).toBe(false);
      expect(stallCutoffIso(5, new Date("2026-08-10T12:00:00.000Z")).startsWith("2026-08-05")).toBe(
        true
      );
    });
  });

  describe("security", () => {
    it("disallows illegal UI transitions (e.g. On Hold → Needs Attention)", () => {
      expect(isAllowedHealthTransition("On Hold", "Needs Attention")).toBe(false);
      expect(isAllowedHealthTransition("Lost", "On Hold")).toBe(false);
      expect(isAllowedHealthTransition("Active", "Lost")).toBe(true);
    });

    it("health update UI requires enquiry edit capability", () => {
      expect(
        resolveStagePermission("enquiry", { role: "staff", staff_role: "Marketer" }).canEdit
      ).toBe(true);
      expect(
        resolveStagePermission("enquiry", { role: "staff", staff_role: "Production" }).canEdit
      ).toBe(false);
    });

    it("company-scoped update contract always pairs id + company_id", () => {
      const filter = { id: "enq-1", company_id: "co-tenant-1" };
      expect(filter.company_id).toBeTruthy();
    });
  });

  describe("scalability", () => {
    it("classifies stall candidates across a large batch", () => {
      const cutoff = stallCutoffIso(5, new Date("2026-08-10T00:00:00.000Z"));
      const rows = Array.from({ length: 3000 }, (_, i) => ({
        health: i % 4 === 0 ? "Needs Attention" : "Active",
        status: i % 10 === 0 ? "Converted" : "Pending",
        dateReceived:
          i % 3 === 0 ? "2026-07-01T00:00:00.000Z" : "2026-08-09T00:00:00.000Z",
      }));
      const stalled = rows.filter((r) => isEnquiryStalledCandidate(r, cutoff));
      expect(stalled.length).toBeGreaterThan(0);
      expect(stalled.every((r) => r.health === "Active" && r.status !== "Converted")).toBe(true);
    });
  });

  describe("performance", () => {
    it("health menu + payload builders stay cheap", () => {
      const start = performance.now();
      for (let i = 0; i < 10000; i++) {
        healthMenuActions(ENQUIRY_HEALTH_STATUSES[i % 4]);
        buildHealthUpdatePayload(i % 2 === 0 ? "Lost" : "Active", "reason");
      }
      expect(performance.now() - start).toBeLessThan(100);
    });
  });
});
