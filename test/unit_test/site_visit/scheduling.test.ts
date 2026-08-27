import { describe, expect, it } from "vitest";
import {
  buildCalendarEvents,
  eventStatus,
  toDateKey,
} from "@/features/calendar/buildCalendarEvents";
import {
  canAdminOverrideSchedule,
  canCreateSchedule,
  canCustomerReschedule,
  defaultSiteVisitConfig,
  hasEmployeeScheduleConflict,
  isHoliday,
  isWithinWorkingHours,
  nextScheduleApprovalStep,
  slotsOverlap,
} from "@/features/orders/workspace/modules/site-visit/siteVisitChecklistLogic";
import {
  canSubmitSiteVisitSchedule,
  getNextBusinessDays,
  isSiteVisitSlotBooked,
} from "@/features/orders/workspace/modules/site-visit/siteVisitUiLogic";

function makeOrders(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `ord-${i}`,
    stage: "Site Visit Scheduled",
    assigned_employees: i % 3 === 0 ? ["user-a"] : ["user-b"],
    workflow_type: "quote_first" as const,
    siteVisitDetails:
      i % 2 === 0
        ? {
            auditDate: `2026-08-${String((i % 28) + 1).padStart(2, "0")}`,
            auditTime: i % 4 === 0 ? "10:00" : "14:00",
          }
        : null,
  }));
}

describe("site visit scheduling", () => {
  describe("UI submit gates, business days, slots, calendar", () => {
    it("requires date, time, and non-blank address to submit schedule", () => {
      expect(
        canSubmitSiteVisitSchedule({
          selectedDate: "2026-08-03",
          selectedTime: "10:00",
          siteAddress: "  MG Road  ",
        })
      ).toBe(true);
      expect(
        canSubmitSiteVisitSchedule({
          selectedDate: "2026-08-03",
          selectedTime: "10:00",
          siteAddress: "   ",
        })
      ).toBe(false);
      expect(
        canSubmitSiteVisitSchedule({
          selectedDate: null,
          selectedTime: "10:00",
          siteAddress: "A",
        })
      ).toBe(false);
    });

    it("returns next N non-Sunday days starting tomorrow", () => {
      const from = new Date(2026, 7, 1);
      const days = getNextBusinessDays(3, from);
      expect(days).toHaveLength(3);
      expect(days.every((d) => d.getDay() !== 0)).toBe(true);
      expect(days[0].getDate()).toBe(3);
    });

    it("detects conflicting portal slots and excludes self", () => {
      const orders = [
        { id: "a", siteVisitDetails: { auditDate: "2026-08-03", auditTime: "10:00" } },
        { id: "b", siteVisitDetails: { preferredDate: "2026-08-04", preferredTime: "14:00" } },
      ];
      expect(isSiteVisitSlotBooked(orders, "2026-08-03", "10:00")).toBe(true);
      expect(isSiteVisitSlotBooked(orders, "2026-08-03", "10:00", "a")).toBe(false);
      expect(isSiteVisitSlotBooked(orders, "2026-08-04", "14:00")).toBe(true);
      expect(isSiteVisitSlotBooked(orders, "2026-08-05", "10:00")).toBe(false);
    });

    it("builds site_visit calendar events from audit/preferred date", () => {
      const events = buildCalendarEvents([
        {
          id: "ord-1",
          orderCode: "ORD-1",
          stage: "Site Visit Scheduled",
          clientName: "Acme",
          businessName: "Acme Signs",
          assignedEmployees: [],
          siteVisitDetails: {
            auditDate: "2026-08-03",
            auditTime: "11:00",
            customerAddress: "MG Road",
            gpsLocation: "12.97, 77.59",
          },
        },
      ]);
      const sv = events.find((e) => e.type === "site_visit");
      expect(sv).toMatchObject({
        id: "ord-1-site_visit",
        dateKey: "2026-08-03",
        time: "11:00",
        address: "MG Road",
      });
      expect(sv?.gmapLink).toContain("12.97");
    });

    it("eventStatus marks inactive site visit stages done", () => {
      expect(toDateKey("2026-08-03")).toBe("2026-08-03");
      expect(
        eventStatus(
          {
            id: "1",
            type: "site_visit",
            dateKey: "2026-08-01",
            projectName: "P",
            clientName: "C",
            assigneeIds: [],
            stage: "Site Visit Completed",
          },
          "2026-08-03"
        )
      ).toBe("done");
      expect(
        eventStatus(
          {
            id: "2",
            type: "site_visit",
            dateKey: "2026-08-03",
            projectName: "P",
            clientName: "C",
            assigneeIds: [],
            stage: "Site Visit Scheduled",
          },
          "2026-08-03"
        )
      ).toBe("today");
    });
  });

  describe("business rules hours, holidays, conflicts, reschedule, approval", () => {
    const cfg = defaultSiteVisitConfig({
      holidays: ["2026-08-15"],
      workingHoursStart: "09:00",
      workingHoursEnd: "18:00",
      bufferMinutes: 30,
      visitDurationMinutes: 60,
      maxReschedules: 3,
    });

    it("create schedule: date/time/address + working hours + holiday + conflict", () => {
      expect(
        canCreateSchedule({
          date: "2026-08-10",
          time: "10:00",
          address: "MG Road",
          config: cfg,
        }).ok
      ).toBe(true);
      expect(
        canCreateSchedule({
          date: "2026-08-15",
          time: "10:00",
          address: "MG Road",
          config: cfg,
        }).reason
      ).toBe("holiday");
      expect(
        canCreateSchedule({
          date: "2026-08-10",
          time: "20:00",
          address: "MG Road",
          config: cfg,
        }).reason
      ).toBe("outside_working_hours");
      expect(isWithinWorkingHours("09:00", cfg)).toBe(true);
      expect(isHoliday("2026-08-15", cfg)).toBe(true);
    });

    it("employee availability + buffer conflict detection", () => {
      expect(slotsOverlap("10:00", 60, "10:30", 60, 0)).toBe(true);
      expect(slotsOverlap("10:00", 60, "11:30", 60, 0)).toBe(false);
      expect(slotsOverlap("10:00", 60, "11:00", 60, 30)).toBe(true);
      expect(
        hasEmployeeScheduleConflict({
          employeeId: "e1",
          date: "2026-08-10",
          time: "10:00",
          config: cfg,
          existing: [
            { orderId: "o2", employeeId: "e1", date: "2026-08-10", time: "10:30" },
          ],
        })
      ).toBe(true);
      expect(
        hasEmployeeScheduleConflict({
          employeeId: "e1",
          date: "2026-08-10",
          time: "10:00",
          excludeOrderId: "o2",
          config: cfg,
          existing: [
            { orderId: "o2", employeeId: "e1", date: "2026-08-10", time: "10:30" },
          ],
        })
      ).toBe(false);
    });

    it("customer reschedule only before confirmation and under maxReschedules", () => {
      expect(
        canCustomerReschedule({ confirmation: "draft", rescheduleCount: 0, config: cfg })
      ).toBe(true);
      expect(
        canCustomerReschedule({ confirmation: "confirmed", rescheduleCount: 0, config: cfg })
      ).toBe(false);
      expect(
        canCustomerReschedule({ confirmation: "draft", rescheduleCount: 3, config: cfg })
      ).toBe(false);
    });

    it("admin can override schedule; approval flow advances and rejects to scheduling", () => {
      expect(canAdminOverrideSchedule("admin")).toBe(true);
      expect(canAdminOverrideSchedule("marketer")).toBe(false);
      expect(nextScheduleApprovalStep("customer_schedule", "submit")).toBe("employee_approve");
      expect(nextScheduleApprovalStep("employee_approve", "approve")).toBe("admin_approve");
      expect(nextScheduleApprovalStep("admin_approve", "approve")).toBe("confirmed");
      expect(nextScheduleApprovalStep("employee_approve", "reject")).toBe("back_to_scheduling");
      expect(nextScheduleApprovalStep("back_to_scheduling", "submit")).toBe("employee_approve");
    });
  });

  describe("performance / scale", () => {
    it("getNextBusinessDays is bounded to requested count", () => {
      const start = performance.now();
      const days = getNextBusinessDays(30, new Date(2026, 0, 1));
      expect(days).toHaveLength(30);
      expect(days.every((d) => d.getDay() !== 0)).toBe(true);
      expect(performance.now() - start).toBeLessThan(50);
    });

    it("calendar event build stays linear for many site visits", () => {
      const orders = Array.from({ length: 2000 }, (_, i) => ({
        id: `ord-${i}`,
        orderCode: `O-${i}`,
        stage: "Site Visit Scheduled",
        clientName: `Client ${i}`,
        businessName: `Biz ${i}`,
        assignedEmployees: [] as string[],
        siteVisitDetails: {
          preferredDate: "2026-08-10",
          preferredTime: "10:00",
          customerAddress: `Addr ${i}`,
        },
      }));
      const start = performance.now();
      const events = buildCalendarEvents(orders);
      expect(events.filter((e) => e.type === "site_visit")).toHaveLength(2000);
      expect(performance.now() - start).toBeLessThan(250);
    });

    it("finds a conflict in a large order list and ignores self", () => {
      const orders = makeOrders(500).map((o, i) => ({
        ...o,
        siteVisitDetails:
          i === 250
            ? { auditDate: "2026-12-25", auditTime: "09:30" }
            : o.siteVisitDetails,
      }));
      expect(isSiteVisitSlotBooked(orders, "2026-12-25", "09:30")).toBe(true);
      expect(isSiteVisitSlotBooked(orders, "2026-12-25", "09:30", "ord-250")).toBe(false);
      expect(isSiteVisitSlotBooked(orders, "2026-12-25", "11:11")).toBe(false);
    });
  });
});
