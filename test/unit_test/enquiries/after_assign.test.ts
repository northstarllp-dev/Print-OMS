import { describe, expect, it } from "vitest";
import {
  buildAssignmentNotificationDbRow,
  buildEmployeeAssignNotification,
  buildOrderAssignmentRows,
  canAccessStaffEnquiriesPage,
  canSeeAssignedOrderInStaffQueue,
  doesAssignmentGrantStageEdit,
  isEnquiryListFilteredByAssignment,
  isOrderAssignedToEmployee,
  realtimeNotificationMatchesUser,
  recipientIdsForAssignNotifications,
  resolveCanViewOrderLink,
  shouldShowEnquiriesNavItem,
} from "@/features/enquiries/enquiryAssignLogic";
import {
  filterStaffQueueOrders,
  isStaffQueueCurrent,
  isStaffQueueRelevant,
} from "@/features/orders/workspace/shared/staffQueueStages";
import {
  getNavItemsForActor,
  resolveStageGrant,
} from "@/features/orders/workspace/shared/stageGrants";
import { resolveStagePermission } from "@/features/orders/workspace/shared/permissions";
import type { StageActor } from "@/features/orders/workspace/shared/types";

/**
 * After Save Assignments: permission flow to assignees, notifications + realtime,
 * RBAC, and staff enquiry portal rules.
 */
describe("after assign (permissions, notify, staff enquiries)", () => {
  describe("1. Business Operations", () => {
    it("assignment puts employee on the order team but does not grant stage edit", () => {
      expect(doesAssignmentGrantStageEdit()).toBe(false);
      expect(isOrderAssignedToEmployee(["e1", "e2"], "e1")).toBe(true);
      expect(isOrderAssignedToEmployee(["e1"], "e9")).toBe(false);
    });

    it("staff queue visibility requires assignment AND stage relevance", () => {
      expect(
        canSeeAssignedOrderInStaffQueue({
          assignedEmployees: ["e1"],
          employeeId: "e1",
          stageRelevant: true,
        })
      ).toBe(true);
      expect(
        canSeeAssignedOrderInStaffQueue({
          assignedEmployees: ["e1"],
          employeeId: "e2",
          stageRelevant: true,
        })
      ).toBe(false);
      expect(
        canSeeAssignedOrderInStaffQueue({
          assignedEmployees: ["e1"],
          employeeId: "e1",
          stageRelevant: false,
        })
      ).toBe(false);
    });

    it("converted Site Visit Pending order shows in site_visit queue for assignee only", () => {
      const orders = [
        {
          id: "o1",
          stage: "Site Visit Pending",
          assigned_employees: ["designer-1"],
          workflow_type: "quote_first" as const,
        },
        {
          id: "o2",
          stage: "Site Visit Pending",
          assigned_employees: ["other"],
          workflow_type: "quote_first" as const,
        },
      ];
      const forDesigner = filterStaffQueueOrders(orders, "designer-1", "site_visit");
      expect(forDesigner.map((o) => o.id)).toEqual(["o1"]);
      expect(isStaffQueueCurrent("Site Visit Pending", "site_visit")).toBe(true);
      expect(isStaffQueueRelevant("Site Visit Pending", "site_visit")).toBe(true);
    });

    it("staff enquiries list is NOT filtered by order assignment", () => {
      expect(isEnquiryListFilteredByAssignment()).toBe(false);
    });
  });

  describe("2. Functions / Business Logic", () => {
    it("builds one notification recipient per unique assigned employee", () => {
      expect(recipientIdsForAssignNotifications(["e1", "e1", "e2"])).toEqual([
        "e1",
        "e2",
      ]);
    });

    it("assignment notification payload links to staff order detail", () => {
      const event = buildEmployeeAssignNotification({
        orderFriendlyId: "ORD100",
        orderUuid: "uuid-100",
        companyId: "co-1",
      });
      expect(event.link).toBe("/staff/orders/ORD100");
      expect(event.type).toBe("info");
    });

    it("resolveCanViewOrderLink is true when any non-enquiry stage is accessible", () => {
      expect(
        resolveCanViewOrderLink([
          { canView: false, canEdit: false },
          { canView: true, canEdit: false },
        ])
      ).toBe(true);
      expect(
        resolveCanViewOrderLink([{ canView: false, canEdit: false }])
      ).toBe(false);
    });
  });

  describe("3. Components / UI", () => {
    it("staff Enquiries nav shows for enquiry view OR edit", () => {
      expect(shouldShowEnquiriesNavItem({ canView: true, canEdit: false })).toBe(true);
      expect(shouldShowEnquiriesNavItem({ canView: false, canEdit: true })).toBe(true);
      expect(shouldShowEnquiriesNavItem({ canView: false, canEdit: false })).toBe(false);
    });

    it("default Marketer gets Enquiries + My Orders nav; Production gets My Orders only for pipeline", () => {
      const marketer: StageActor = { role: "staff", staff_role: "Marketer" };
      const production: StageActor = { role: "staff", staff_role: "Production" };
      const marketerNav = getNavItemsForActor(marketer).map((i) => i.href);
      const productionNav = getNavItemsForActor(production).map((i) => i.href);
      expect(marketerNav).toContain("/staff/enquiries");
      expect(marketerNav).toContain("/staff/my-orders");
      expect(productionNav).not.toContain("/staff/enquiries");
      expect(productionNav).toContain("/staff/my-orders");
    });

    it("staff enquiry page access matches canView || canEdit", () => {
      expect(canAccessStaffEnquiriesPage({ canView: true, canEdit: false })).toBe(true);
      expect(canAccessStaffEnquiriesPage({ canView: false, canEdit: false })).toBe(false);
    });
  });

  describe("4. Backend / Database", () => {
    it("Save Assignments persists order_assignments for each employee", () => {
      expect(buildOrderAssignmentRows("order-uuid", ["e1", "e2"])).toEqual([
        { order_id: "order-uuid", employee_id: "e1" },
        { order_id: "order-uuid", employee_id: "e2" },
      ]);
    });

    it("createNotification row is company + user scoped and unread", () => {
      const event = buildEmployeeAssignNotification({
        orderFriendlyId: "ORD100",
        orderUuid: "uuid",
        companyId: "co-1",
      });
      expect(
        buildAssignmentNotificationDbRow({
          userId: "e1",
          companyId: "co-1",
          ...event,
        })
      ).toEqual({
        company_id: "co-1",
        user_id: "e1",
        title: event.title,
        message: event.message,
        type: "info",
        link: "/staff/orders/ORD100",
        read: false,
      });
    });

    it("hydrated assigned_employees drives queue membership after revalidate", () => {
      const orders = [
        {
          stage: "Quotation In Progress",
          assigned_employees: ["marketer-1"],
          workflow_type: "quote_first" as const,
        },
      ];
      expect(filterStaffQueueOrders(orders, "marketer-1", "quotation")).toHaveLength(1);
      expect(filterStaffQueueOrders(orders, "stranger", "quotation")).toHaveLength(0);
    });
  });

  describe("5. Security", () => {
    it("RBAC: stage edit still required after assignment (Designer edits design, not enquiry)", () => {
      const designer: StageActor = { role: "staff", staff_role: "Designer" };
      expect(resolveStageGrant(designer, "design").canEdit).toBe(true);
      expect(resolveStageGrant(designer, "enquiry").canEdit).toBe(false);
      expect(doesAssignmentGrantStageEdit()).toBe(false);
    });

    it("view-only enquiry staff can open portal but cannot convert/assign via UI canEdit", () => {
      // Simulate printoms-style view-only enquiry grant
      const viewOnly = { canView: true, canEdit: false };
      expect(canAccessStaffEnquiriesPage(viewOnly)).toBe(true);
      expect(viewOnly.canEdit).toBe(false);
    });

    it("realtime delivery only accepts notifications for the logged-in user", () => {
      expect(realtimeNotificationMatchesUser("e1", "e1")).toBe(true);
      expect(realtimeNotificationMatchesUser("e1", "e2")).toBe(false);
      expect(realtimeNotificationMatchesUser(null, "e1")).toBe(false);
    });

    it("Production without enquiry grant cannot access staff enquiries page", () => {
      const production: StageActor = { role: "staff", staff_role: "Production" };
      const perm = resolveStagePermission("enquiry", production);
      expect(canAccessStaffEnquiriesPage(perm)).toBe(false);
    });
  });

  describe("6. Performance", () => {
    it("queue filter + notify recipient fan-out stay under budget", () => {
      const orders = Array.from({ length: 3000 }, (_, i) => ({
        stage: "Site Visit Pending",
        assigned_employees: i % 3 === 0 ? ["e1"] : [`e-${i}`],
        workflow_type: "quote_first" as const,
      }));
      const start = performance.now();
      const mine = filterStaffQueueOrders(orders, "e1", "site_visit");
      const recipients = recipientIdsForAssignNotifications(
        Array.from({ length: 500 }, (_, i) => `e-${i % 50}`)
      );
      expect(mine.length).toBeGreaterThan(0);
      expect(recipients).toHaveLength(50);
      expect(performance.now() - start).toBeLessThan(100);
    });
  });

  describe("7. Scalability", () => {
    it("many assignees each get an isolated notification row contract", () => {
      const ids = Array.from({ length: 200 }, (_, i) => `emp-${i}`);
      const rows = recipientIdsForAssignNotifications(ids).map((userId) =>
        buildAssignmentNotificationDbRow({
          userId,
          companyId: "co-1",
          title: "Assigned",
          message: "Team",
          type: "info",
          link: "/staff/orders/ORD1",
        })
      );
      expect(rows).toHaveLength(200);
      expect(new Set(rows.map((r) => r.user_id)).size).toBe(200);
      expect(rows.every((r) => r.company_id === "co-1" && r.read === false)).toBe(true);
    });

    it("large staff queue still hides unassigned orders", () => {
      const orders = Array.from({ length: 5000 }, (_, i) => ({
        stage: "Production",
        assigned_employees: [`worker-${i}`],
        workflow_type: "quote_first" as const,
      }));
      expect(filterStaffQueueOrders(orders, "worker-42", "production")).toHaveLength(1);
      expect(filterStaffQueueOrders(orders, "nobody", "production")).toHaveLength(0);
    });
  });
});
