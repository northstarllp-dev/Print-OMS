import { describe, expect, it } from "vitest";
import {
  buildEmployeeAssignNotification,
  buildEmployeeStats,
  buildOrderAssignmentRows,
  buildTeamAssignedActivity,
  canSaveAssignments,
  canSkipAssignViaClose,
  canStartAssignSubmit,
  dedupeEmployeeIds,
  formatEmployeeJobTitle,
  isActiveAssignmentOrderStage,
  isAssignSubmitDisabled,
  requiresCompanyIdForAssignment,
  selectionSummaryLabel,
  shouldOpenAssignTeamAfterConvert,
  toggleEmployeeSelection,
} from "@/features/enquiries/enquiryAssignLogic";
import { resolveStagePermission } from "@/features/orders/workspace/shared/permissions";

describe("assign team (after convert)", () => {
  describe("1. Business Operations", () => {
    it("opens Assign Employees only after convert message closes with assignTeam", () => {
      expect(shouldOpenAssignTeamAfterConvert("assignTeam")).toBe(true);
      expect(shouldOpenAssignTeamAfterConvert(undefined)).toBe(false);
      expect(shouldOpenAssignTeamAfterConvert("done")).toBe(false);
    });

    it("allows skipping assignment via Close, but Save requires ≥1 employee", () => {
      expect(canSkipAssignViaClose()).toBe(true);
      expect(canSaveAssignments(0, false)).toBe(false);
      expect(canSaveAssignments(2, false)).toBe(true);
    });

    it("counts only non-Completed/Closed orders as active jobs", () => {
      expect(isActiveAssignmentOrderStage("Site Visit Pending")).toBe(true);
      expect(isActiveAssignmentOrderStage("Production")).toBe(true);
      expect(isActiveAssignmentOrderStage("Completed")).toBe(false);
      expect(isActiveAssignmentOrderStage("Closed")).toBe(false);
    });
  });

  describe("2. Functions / Business Logic", () => {
    it("toggles multi-select and dedupes employee ids", () => {
      expect(toggleEmployeeSelection([], "e1")).toEqual(["e1"]);
      expect(toggleEmployeeSelection(["e1", "e2"], "e1")).toEqual(["e2"]);
      expect(dedupeEmployeeIds(["a", "a", "b", ""])).toEqual(["a", "b"]);
    });

    it("aggregates employee activeJobs + job titles from assignments", () => {
      const stats = buildEmployeeStats(
        [
          { id: "e1", name: "Priya", staff_role: "Designer" },
          { id: "e2", name: "Arun", staff_role: "Installation" },
        ],
        [
          {
            employee_id: "e1",
            orders: {
              business_name: "Cafe",
              client_name: "Ramesh",
              stage: "Design In Progress",
            },
          },
          {
            employee_id: "e1",
            orders: {
              business_name: "Mart",
              client_name: "Anita",
              stage: "Completed",
            },
          },
          {
            employee_id: "e2",
            orders: {
              business_name: "Board Co",
              client_name: "Sam",
              stage: "Installation Scheduled",
            },
          },
        ]
      );

      expect(stats[0]).toMatchObject({
        id: "e1",
        name: "Priya",
        activeJobs: 1,
        jobTitles: ["Cafe - Ramesh"],
      });
      expect(stats[1].activeJobs).toBe(1);
      expect(formatEmployeeJobTitle({ business_name: "A", client_name: "B" })).toBe("A - B");
    });

    it("double-submit guard while saving", () => {
      expect(canStartAssignSubmit(false)).toBe(true);
      expect(canStartAssignSubmit(true)).toBe(false);
      expect(isAssignSubmitDisabled(1, true)).toBe(true);
      expect(isAssignSubmitDisabled(1, false)).toBe(false);
    });
  });

  describe("3. Components / UI", () => {
    it("selection summary copy matches modal footer", () => {
      expect(selectionSummaryLabel(0)).toBe("Select employees above");
      expect(selectionSummaryLabel(1)).toBe("1 employee selected");
      expect(selectionSummaryLabel(3)).toBe("3 employees selected");
    });

    it("Save Assignments disabled until someone is selected", () => {
      expect(isAssignSubmitDisabled(0, false)).toBe(true);
      expect(isAssignSubmitDisabled(2, false)).toBe(false);
    });
  });

  describe("4. Backend / Database", () => {
    it("writes order_assignments rows with order uuid + employee ids", () => {
      expect(buildOrderAssignmentRows("order-uuid", ["e1", "e2", "e1"])).toEqual([
        { order_id: "order-uuid", employee_id: "e1" },
        { order_id: "order-uuid", employee_id: "e2" },
      ]);
    });

    it("builds activity log tied to company_id + friendly order id", () => {
      expect(
        buildTeamAssignedActivity({
          orderFriendlyId: "ORD042",
          companyId: "co-1",
          employeeCount: 2,
        })
      ).toEqual({
        order_id: "ORD042",
        company_id: "co-1",
        actor_name: "System",
        actor_role: "System",
        content: "Team assigned: 2 employee(s) allocated to this order.",
        metadata: { action: "team_assigned", count: 2 },
      });
    });

    it("requires company_id before logging assignment (fails closed)", () => {
      expect(requiresCompanyIdForAssignment(null)).toBe(true);
      expect(requiresCompanyIdForAssignment("co-1")).toBe(false);
    });

    it("builds per-employee notification pointing at staff order path", () => {
      expect(
        buildEmployeeAssignNotification({
          orderFriendlyId: "ORD042",
          orderUuid: "uuid",
          companyId: "co-1",
        })
      ).toMatchObject({
        title: "You've been assigned to Order ORD042",
        link: "/staff/orders/ORD042",
        type: "info",
      });
    });
  });

  describe("5. Security", () => {
    it("assign UI follows convert path only enquiry editors reach it in normal flow", () => {
      expect(
        resolveStagePermission("enquiry", { role: "staff", staff_role: "Marketer" }).canEdit
      ).toBe(true);
      expect(
        resolveStagePermission("enquiry", { role: "staff", staff_role: "Production" }).canEdit
      ).toBe(false);
    });

    it("assignment rows never invent employee ids (empty list → clear assignments)", () => {
      expect(buildOrderAssignmentRows("order-uuid", [])).toEqual([]);
    });

    it("rejects missing company_id so cross-tenant activity cannot be written", () => {
      expect(requiresCompanyIdForAssignment(undefined)).toBe(true);
    });
  });

  describe("6. Performance", () => {
    it("selection toggles + assignment row builds stay under budget", () => {
      let selected: string[] = [];
      const start = performance.now();
      for (let i = 0; i < 5000; i++) {
        selected = toggleEmployeeSelection(selected, `e-${i % 200}`);
        buildOrderAssignmentRows("ord", selected);
      }
      // Wall-clock budget keep loose enough for busy CI hosts; still catches O(n²) blowups.
      expect(performance.now() - start).toBeLessThan(1000);
    });

    it("employee stats aggregation is fast for large staff lists", () => {
      const staff = Array.from({ length: 500 }, (_, i) => ({
        id: `e-${i}`,
        name: `Emp ${i}`,
        staff_role: "Designer",
      }));
      const assignments = Array.from({ length: 5000 }, (_, i) => ({
        employee_id: `e-${i % 500}`,
        orders: {
          business_name: `Biz ${i}`,
          client_name: `Client ${i}`,
          stage: i % 20 === 0 ? "Completed" : "Production",
        },
      }));
      const start = performance.now();
      const stats = buildEmployeeStats(staff, assignments);
      expect(stats).toHaveLength(500);
      expect(performance.now() - start).toBeLessThan(500);
    });
  });

  describe("7. Scalability", () => {
    it("handles large multi-select without duplicate assignment rows", () => {
      const ids = Array.from({ length: 1000 }, (_, i) => `e-${i % 100}`);
      const rows = buildOrderAssignmentRows("order-uuid", ids);
      expect(rows).toHaveLength(100);
      expect(new Set(rows.map((r) => r.employee_id)).size).toBe(100);
    });

    it("stats remain correct when many employees have many active jobs", () => {
      const staff = Array.from({ length: 200 }, (_, i) => ({
        id: `e-${i}`,
        name: `Emp ${i}`,
      }));
      const assignments = staff.flatMap((emp) =>
        Array.from({ length: 10 }, (_, j) => ({
          employee_id: emp.id,
          orders: {
            business_name: `B${j}`,
            client_name: `C${j}`,
            stage: "Quotation In Progress",
          },
        }))
      );
      const stats = buildEmployeeStats(staff, assignments);
      expect(stats.every((s) => s.activeJobs === 10)).toBe(true);
    });
  });
});
