import { describe, expect, it } from "vitest";
import {
  mergeOrderDetailPatch,
  patchFromMeasurementEvent,
  patchFromSiteVisitRow,
} from "@/features/orders/realtime/orderDetailPatch";
import {
  SITE_VISIT_AUDIT_ACTIONS,
  buildSiteVisitAuditEntry,
  computeSiteVisitKpis,
  defaultSiteVisitConfig,
  isStaleSiteVisitSave,
  resolveConcurrentEdit,
  siteVisitNotificationEvents,
} from "@/features/orders/workspace/modules/site-visit/siteVisitChecklistLogic";
import {
  countQueueViews,
  filterFloorQueueOrders,
  filterStaffQueueOrders,
  isStaffQueueCompleted,
  isStaffQueueCurrent,
  isStaffQueueIncoming,
  isStaffQueueRelevant,
  partitionQueueOrdersByView,
  queueHasIncomingTab,
} from "@/features/orders/workspace/shared/staffQueueStages";

function makeOrders(n: number) {
  const stages = [
    "Site Visit Pending",
    "Site Visit Scheduled",
    "Site Visit Completed",
    "Quotation In Progress",
    "Production",
    "Installation Scheduled",
  ] as const;

  return Array.from({ length: n }, (_, i) => ({
    id: `ord-${i}`,
    stage: stages[i % stages.length],
    assigned_employees: i % 3 === 0 ? ["user-a"] : ["user-b"],
    workflow_type: i % 5 === 0 ? ("design_first" as const) : ("quote_first" as const),
    siteVisitDetails:
      i % 2 === 0
        ? {
            auditDate: `2026-08-${String((i % 28) + 1).padStart(2, "0")}`,
            auditTime: i % 4 === 0 ? "10:00" : "14:00",
          }
        : null,
  }));
}

describe("site visit operations", () => {
  describe("realtime data flow", () => {
    it("preserves existing locations when visit update has none nested", () => {
      const prev: { siteVisitDetails?: import("@/types").SiteVisitDetails } = {
        siteVisitDetails: {
          id: "sv",
          completed: false,
          locations: [{ id: "m1", name: "Keep me", photos: [], obstacles: [] }],
        },
      };
      const next = mergeOrderDetailPatch(
        prev,
        patchFromSiteVisitRow({
          id: "sv",
          completed: true,
          customer_address: "Updated",
          site_visit_measurements: [],
        })
      );
      expect(next.siteVisitDetails?.completed).toBe(true);
      expect(next.siteVisitDetails?.customerAddress).toBe("Updated");
      expect(next.siteVisitDetails?.locations).toHaveLength(1);
      expect(next.siteVisitDetails?.locations?.[0].name).toBe("Keep me");
    });

    it("INSERT / UPDATE / DELETE measurement events mutate locations", () => {
      let state: {
        siteVisitDetails?: {
          locations: Array<{ id?: string; name?: string; photos: unknown[]; obstacles: unknown[] }>;
        };
      } = { siteVisitDetails: { locations: [] } };

      state = mergeOrderDetailPatch(
        state,
        patchFromMeasurementEvent("INSERT", { id: "m1", name: "A", width: 1, height: 1 }, null)
      );
      expect(state.siteVisitDetails?.locations).toHaveLength(1);

      state = mergeOrderDetailPatch(
        state,
        patchFromMeasurementEvent(
          "UPDATE",
          { id: "m1", name: "A-updated", width: 2, height: 1 },
          { id: "m1" }
        )
      );
      expect(state.siteVisitDetails?.locations?.[0].name).toBe("A-updated");

      state = mergeOrderDetailPatch(
        state,
        patchFromMeasurementEvent("DELETE", null, { id: "m1" })
      );
      expect(state.siteVisitDetails?.locations).toEqual([]);
    });

    it("clears siteVisitDetails when mapped visit row is nullish", () => {
      const next = mergeOrderDetailPatch(
        { siteVisitDetails: { completed: false, locations: [] } },
        { siteVisitUpdateEvent: { row: null as unknown as Record<string, unknown> } }
      );
      expect(next.siteVisitDetails).toBeUndefined();
    });

    it("realtime visit updates do not wipe locations (avoids costly refetch)", () => {
      const locations = Array.from({ length: 100 }, (_, i) => ({
        id: `m-${i}`,
        name: `Loc ${i}`,
        photos: [] as unknown[],
        obstacles: [] as unknown[],
      }));
      const prev = {
        siteVisitDetails: {
          id: "sv",
          completed: false,
          customerAddress: "Old",
          locations,
        },
      };
      const start = performance.now();
      const next = mergeOrderDetailPatch(
        prev,
        patchFromSiteVisitRow({
          id: "sv",
          completed: false,
          customer_address: "New address only",
          site_visit_measurements: [],
        })
      );
      expect(next.siteVisitDetails?.customerAddress).toBe("New address only");
      expect(next.siteVisitDetails?.locations).toHaveLength(100);
      expect(performance.now() - start).toBeLessThan(50);
    });

    it("measurement INSERT patches are O(n) append/update without full remount payload", () => {
      let state: {
        siteVisitDetails: {
          locations: Array<{ id?: string; name?: string; photos: unknown[]; obstacles: unknown[] }>;
        };
      } = { siteVisitDetails: { locations: [] } };
      const start = performance.now();
      for (let i = 0; i < 200; i++) {
        state = mergeOrderDetailPatch(
          state,
          patchFromMeasurementEvent(
            "INSERT",
            { id: `m-${i}`, name: `N${i}`, width: 1, height: 1 },
            null
          )
        );
      }
      expect(state.siteVisitDetails.locations).toHaveLength(200);
      expect(performance.now() - start).toBeLessThan(100);
    });
  });

  describe("queue scale", () => {
    it("site_visit has no incoming tab and never classifies incoming", () => {
      expect(queueHasIncomingTab("site_visit")).toBe(false);
      expect(isStaffQueueIncoming("Enquiry", "site_visit")).toBe(false);
      expect(isStaffQueueIncoming("Site Visit Pending", "site_visit")).toBe(false);
    });

    it("current stages are exactly the three Site Visit* stages", () => {
      expect(isStaffQueueCurrent("Site Visit Pending", "site_visit")).toBe(true);
      expect(isStaffQueueCurrent("Site Visit Scheduled", "site_visit")).toBe(true);
      expect(isStaffQueueCurrent("Site Visit Completed", "site_visit")).toBe(true);
      expect(isStaffQueueCurrent("Quotation In Progress", "site_visit")).toBe(false);
    });

    it("downstream stages count as completed for the site_visit queue", () => {
      expect(isStaffQueueCompleted("Quotation In Progress", "site_visit")).toBe(true);
      expect(isStaffQueueCompleted("Production", "site_visit")).toBe(true);
      expect(isStaffQueueCompleted("Site Visit Pending", "site_visit")).toBe(false);
    });

    it("partition counts sum to filtered relevant set", () => {
      const orders = [
        { stage: "Site Visit Pending", workflow_type: "quote_first" as const },
        { stage: "Site Visit Scheduled", workflow_type: "quote_first" as const },
        { stage: "Quotation Sent", workflow_type: "quote_first" as const },
        { stage: "Enquiry", workflow_type: "quote_first" as const },
      ];
      const relevant = orders.filter((o) =>
        isStaffQueueRelevant(o.stage, "site_visit", o.workflow_type)
      );
      const counts = countQueueViews(relevant, "site_visit");
      expect(counts.incoming).toBe(0);
      expect(counts.current).toBe(2);
      expect(counts.completed).toBe(1);
      expect(counts.incoming + counts.current + counts.completed).toBe(relevant.length);
      expect(partitionQueueOrdersByView(relevant, "site_visit", "incoming")).toHaveLength(0);
      expect(partitionQueueOrdersByView(relevant, "site_visit", "current")).toHaveLength(2);
    });

    it("staff filter respects assignment; floor filter ignores it", () => {
      const orders = makeOrders(60);
      const staffA = filterStaffQueueOrders(orders, "user-a", "site_visit");
      expect(staffA.every((o) => o.assigned_employees.includes("user-a"))).toBe(true);
      const floor = filterFloorQueueOrders(orders, "site_visit");
      expect(floor.length).toBeGreaterThan(staffA.length);
    });

    it("requireAssignment:false still drops rows without a stage", () => {
      const mixed = [
        { stage: "Site Visit Pending", assigned_employees: [] as string[] },
        { stage: null, assigned_employees: ["user-a"] },
      ];
      const filtered = filterStaffQueueOrders(mixed, "user-a", "site_visit", {
        requireAssignment: false,
      });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].stage).toBe("Site Visit Pending");
    });

    it("handles null/empty order lists without throwing", () => {
      expect(filterStaffQueueOrders(null, "user-a", "site_visit")).toEqual([]);
      expect(filterFloorQueueOrders(undefined, "site_visit")).toEqual([]);
    });

    it("filters and counts a large staff queue within a tight budget", () => {
      const orders = Array.from({ length: 5000 }, (_, i) => ({
        stage:
          i % 4 === 0
            ? "Site Visit Pending"
            : i % 4 === 1
              ? "Site Visit Scheduled"
              : i % 4 === 2
                ? "Quotation In Progress"
                : "Production",
        assigned_employees: i % 2 === 0 ? ["user-a"] : ["user-b"],
        workflow_type: "quote_first" as const,
      }));
      const start = performance.now();
      const filtered = filterStaffQueueOrders(orders, "user-a", "site_visit");
      const counts = countQueueViews(filtered, "site_visit");
      expect(filtered.length).toBeGreaterThan(0);
      expect(counts.incoming).toBe(0);
      expect(counts.current + counts.completed).toBe(filtered.length);
      expect(performance.now() - start).toBeLessThan(100);
    });
  });

  describe("notifications, concurrency, KPIs, audit, config", () => {
    it("schedule/complete/assignment events fan out to customer/employee/admin", () => {
      expect(siteVisitNotificationEvents("schedule_created")).toEqual([
        "customer",
        "employee",
        "admin",
      ]);
      expect(siteVisitNotificationEvents("visit_completed")).toEqual(["customer", "admin"]);
      expect(siteVisitNotificationEvents("new_assignment")).toEqual(["employee"]);
      expect(siteVisitNotificationEvents("pending_approval")).toEqual(["admin"]);
    });

    it("covers customer/employee/admin event catalog", () => {
      for (const event of [
        "schedule_created",
        "schedule_approved",
        "schedule_rejected",
        "rescheduled",
        "visit_completed",
        "new_assignment",
        "pending_approval",
      ]) {
        expect(siteVisitNotificationEvents(event).length).toBeGreaterThan(0);
      }
    });

    it("rejects stale saves (optimistic locking / version)", () => {
      expect(isStaleSiteVisitSave({ clientVersion: 12, serverVersion: 13 })).toBe(true);
      expect(resolveConcurrentEdit({ clientVersion: 12, serverVersion: 13 })).toBe(
        "reject_stale"
      );
      expect(resolveConcurrentEdit({ clientVersion: 13, serverVersion: 13 })).toBe("accept");
    });

    it("computes scheduled/completed/cancelled/rescheduled/no-show + averages + productivity", () => {
      const kpis = computeSiteVisitKpis([
        { status: "scheduled" },
        {
          status: "completed",
          visitMinutes: 60,
          approvalMinutes: 30,
          measurementCount: 2,
          photoCount: 4,
          employeeId: "e1",
        },
        {
          status: "completed",
          visitMinutes: 40,
          approvalMinutes: 10,
          measurementCount: 4,
          photoCount: 6,
          employeeId: "e1",
        },
        { status: "cancelled" },
        { status: "rescheduled" },
        { status: "no_show" },
      ]);
      expect(kpis).toMatchObject({
        scheduled: 1,
        completed: 2,
        cancelled: 1,
        rescheduled: 1,
        noShow: 1,
        averageVisitTime: 50,
        averageApprovalTime: 20,
        averageMeasurements: 3,
        averagePhotos: 5,
        employeeProductivity: { e1: 2 },
      });
    });

    it("KPI over 5k visits under budget", () => {
      const rows = Array.from({ length: 5000 }, (_, i) => ({
        status: (i % 5 === 0 ? "completed" : "scheduled") as "completed" | "scheduled",
        visitMinutes: 45,
        approvalMinutes: 20,
        measurementCount: 3,
        photoCount: 8,
        employeeId: `e-${i % 50}`,
      }));
      const start = performance.now();
      const kpis = computeSiteVisitKpis(rows);
      expect(kpis.completed).toBe(1000);
      expect(performance.now() - start).toBeLessThan(100);
    });

    it("catalog covers full history chain and requires company_id", () => {
      expect(SITE_VISIT_AUDIT_ACTIONS).toEqual(
        expect.arrayContaining([
          "customer_scheduled",
          "employee_confirmed",
          "admin_approved",
          "employee_uploaded_photos",
          "measurements_updated",
          "visit_completed",
          "admin_approved_completion",
        ])
      );
      const entry = buildSiteVisitAuditEntry({
        action: "customer_scheduled",
        orderId: "A001-001",
        companyId: "co-1",
        actorName: "Cust",
        actorRole: "Customer",
      });
      expect(entry.metadata).toEqual({ action: "customer_scheduled", module: "site_visit" });
      expect(() =>
        buildSiteVisitAuditEntry({
          action: "deleted",
          orderId: "A001-001",
          companyId: "",
          actorName: "Admin",
          actorRole: "Admin",
        })
      ).toThrow(/company_id/);
    });

    it("defaults match checklist recommendation table", () => {
      expect(defaultSiteVisitConfig()).toMatchObject({
        maxMeasurementItems: 20,
        maxPhotosPerItem: 10,
        allowedFileTypes: ["jpg", "jpeg", "png", "pdf"],
        maxUploadSizeMb: 20,
        workingHoursStart: "09:00",
        workingHoursEnd: "18:00",
        visitDurationMinutes: 60,
        bufferMinutes: 30,
        maxReschedules: 3,
        gpsRequired: true,
        mandatoryPhotos: true,
        mandatoryCustomerSignature: false,
        approvalRequired: true,
        autoStageProgression: false,
      });
    });

    it("all listed knobs are company-overridable without shared mutation", () => {
      const a = defaultSiteVisitConfig({ maxMeasurementItems: 5 });
      const b = defaultSiteVisitConfig({ maxMeasurementItems: 50 });
      expect(a.maxMeasurementItems).toBe(5);
      expect(b.maxMeasurementItems).toBe(50);
      expect(defaultSiteVisitConfig().maxMeasurementItems).toBe(20);

      const custom = defaultSiteVisitConfig({
        maxPhotosPerItem: 3,
        allowedFileTypes: ["jpg", "png", "mp4"],
        maxUploadSizeMb: 50,
        workingHoursStart: "08:00",
        workingHoursEnd: "20:00",
        visitDurationMinutes: 90,
        bufferMinutes: 15,
        maxReschedules: 1,
        gpsRequired: false,
        mandatoryPhotos: false,
        mandatoryCustomerSignature: true,
        approvalRequired: false,
        autoStageProgression: true,
        holidays: ["2026-01-01"],
      });
      expect(custom.allowedFileTypes).toContain("mp4");
      expect(custom.mandatoryCustomerSignature).toBe(true);
      expect(custom.autoStageProgression).toBe(true);
    });
  });
});
