import { describe, expect, it } from "vitest";
import {
  assertSameCompany,
  buildServiceTicketCreatePayload,
  buildServiceTicketPreset,
  canListOrders,
  computeOrderKpis,
  countActiveOrderFilters,
  createOrderDefaults,
  filterOrders,
  isOrdersEmptyState,
  isOrdersLoadingState,
  mapDbOrderToListRow,
  paginateOrders,
  resolveOrderDetailHref,
  resolveWriteCompanyIdPreference,
  sortOrdersByDateCreated,
  validateOrderCreateInput,
  type OrderListRow,
} from "@/features/orders/orderListLogic";
import { mapDbOrderToWorksheetOrder } from "@/features/orders/actions/orderClientMapper";
import { resolveStagePermission } from "@/features/orders/workspace/shared/permissions";

function row(partial: Partial<OrderListRow> & { id: string }): OrderListRow {
  return {
    clientName: "Client",
    businessName: "Biz",
    stage: "Site Visit Pending",
    health: "Active",
    dateCreated: "2026-08-01T10:00:00.000Z",
    assignedEmployees: [],
    orderCode: `ORD-${partial.id}`,
    orderId: `ORD-${partial.id}`,
    ...partial,
  };
}

const sampleRows = [
  row({
    id: "1",
    clientName: "Client A",
    businessName: "Gourmet Cafe",
    orderCode: "A001-001",
    orderId: "A001-001",
    customerId: "cust-1",
    stage: "Site Visit Pending",
    health: "Active",
    assignedEmployees: [],
    dateCreated: "2026-08-02T00:00:00.000Z",
  }),
  row({
    id: "2",
    clientName: "Client B",
    businessName: "Metro Mart",
    orderCode: "A002-001",
    orderId: "A002-001",
    customerId: "cust-2",
    stage: "Completed",
    health: "Warning" as any,
    assignedEmployees: ["emp-1"],
    dateCreated: "2026-07-15T00:00:00.000Z",
    stageStatus: "Normal",
  }),
  row({
    id: "3",
    clientName: "Client C",
    businessName: "Board Co",
    orderCode: "A003-001",
    orderId: "A003-001",
    customerId: "cust-3",
    stage: "Production",
    health: "On Hold",
    assignedEmployees: ["emp-2"],
    dateCreated: "2026-08-05T00:00:00.000Z",
    stageStatus: "Pending Admin Approval: Design Done",
  }),
];

describe("order table", () => {
  describe("1. Business Operations / UI list", () => {
    it("computes KPI cards from toolbar-filtered list", () => {
      expect(computeOrderKpis(sampleRows)).toEqual({
        active: 2,
        unassigned: 1,
        approvals: 1,
        completed: 1,
      });
      expect(computeOrderKpis([])).toEqual({
        active: 0,
        unassigned: 0,
        approvals: 0,
        completed: 0,
      });
    });

    it("filters by search, stage, health, KPI, and date", () => {
      expect(filterOrders(sampleRows, { search: "gourmet", dateFilterType: "all" }).map((o) => o.id)).toEqual([
        "1",
      ]);
      expect(filterOrders(sampleRows, { search: "a001-001", dateFilterType: "all" }).map((o) => o.id)).toEqual([
        "1",
      ]);
      expect(
        filterOrders(sampleRows, { stageFilter: "Production", dateFilterType: "all" }).map((o) => o.id)
      ).toEqual(["3"]);
      expect(
        filterOrders(sampleRows, { healthFilter: "On Hold", dateFilterType: "all" }).map((o) => o.id)
      ).toEqual(["3"]);
      expect(
        filterOrders(sampleRows, { selectedKpi: "completed", dateFilterType: "all" }).map((o) => o.id)
      ).toEqual(["2"]);
      expect(
        filterOrders(sampleRows, { selectedKpi: "unassigned", dateFilterType: "all" }).map((o) => o.id)
      ).toEqual(["1"]);
      expect(
        filterOrders(sampleRows, { selectedKpi: "approvals", dateFilterType: "all" }).map((o) => o.id)
      ).toEqual(["3"]);
      expect(
        filterOrders(sampleRows, {
          dateFilterType: "range",
          startDate: "2026-08-01",
          endDate: "2026-08-31",
        }).map((o) => o.id)
      ).toEqual(["1", "3"]);
      expect(
        countActiveOrderFilters({
          stageFilter: "Site Visit",
          healthFilter: "Active",
          startDate: "2026-08-01",
          selectedKpi: "active",
        })
      ).toBe(4);
    });

    it("sorts newest-first by default and paginates", () => {
      const sorted = sortOrdersByDateCreated(sampleRows);
      expect(sorted.map((o) => o.id)).toEqual(["3", "1", "2"]);
      const page1 = paginateOrders(sorted, 1, 2);
      expect(page1.items.map((o) => o.id)).toEqual(["3", "1"]);
      expect(page1.totalPages).toBe(2);
      expect(paginateOrders(sorted, 99, 2).page).toBe(2);
    });

    it("empty + loading states", () => {
      expect(isOrdersEmptyState([])).toBe(true);
      expect(isOrdersEmptyState(sampleRows)).toBe(false);
      expect(isOrdersLoadingState(true, false)).toBe(true);
      expect(isOrdersLoadingState(true, true)).toBe(false);
    });

    it("employee role only sees assigned orders", () => {
      expect(
        filterOrders(sampleRows, {
          userRole: "Employee",
          employeeId: "emp-1",
          dateFilterType: "all",
        }).map((o) => o.id)
      ).toEqual(["2"]);
    });
  });

  describe("2. View order / detail mapping", () => {
    it("maps DB join row → list columns with friendly order ids", () => {
      const mapped = mapDbOrderToListRow({
        id: "uuid-1",
        client_name: "Ramesh",
        business_name: "Cafe",
        customer_id: "cust-uuid",
        stage: "Design In Progress",
        stage_status: "Normal",
        health: "Needs Attention",
        order_id: "A001-002",
        date_created: "2026-08-01T12:00:00Z",
        assigned_employees: ["e1"],
        company_id: "co-1",
      });
      expect(mapped).toMatchObject({
        clientName: "Ramesh",
        orderCode: "A001-002",
        orderId: "A001-002",
        health: "Needs Attention",
        company_id: "co-1",
      });
    });

    it("maps getOrderById result → worksheet detail shape", () => {
      const mapped = mapDbOrderToWorksheetOrder({
        id: "uuid-1",
        client_name: "Ramesh",
        business_name: "Cafe",
        customer_id: "cust-1",
        stage: "Quotation Sent",
        order_id: "A001-003",
        assigned_employees: ["e1"],
        date_created: "2026-08-01",
        health: "Active",
        workflow_type: "design_first",
      });
      expect(mapped.orderCode).toBe("A001-003");
      expect(mapped.workflow_type).toBe("design_first");
      expect(mapped.assignedEmployees).toEqual(["e1"]);
    });

    it("builds admin/staff detail href with optional entryStage", () => {
      expect(
        resolveOrderDetailHref({
          id: "uuid",
          orderId: "A001-001",
          userRole: "Admin",
        })
      ).toBe("/admin/orders/A001-001");
      expect(
        resolveOrderDetailHref({
          id: "uuid",
          orderId: "A001-001",
          userRole: "Employee",
          entryStage: "production",
        })
      ).toBe("/staff/orders/A001-001?entryStage=production");
    });
  });

  describe("3. Service ticket button → API payload", () => {
    it("presets phone/customer/order from the row click", () => {
      expect(
        buildServiceTicketPreset({
          order: {
            id: "uuid-1",
            orderCode: "A001-001",
            customerId: "cust-1",
            clientName: "Ramesh",
          },
          customerPhone: "+919876543210",
        })
      ).toEqual({
        phone: "+919876543210",
        customerId: "cust-1",
        orderId: "uuid-1",
        orderLabel: "A001-001 - Ramesh",
      });
    });

    it("builds create ticket insert with logged-in company_id", () => {
      const payload = buildServiceTicketCreatePayload({
        companyId: "company-123",
        customerId: "cust-1",
        orderId: "uuid-1",
        phone: "+91 98765 43210",
        description: "LED panel flicker",
        createdBy: "admin-1",
      });
      expect(payload).toMatchObject({
        company_id: "company-123",
        customer_id: "cust-1",
        order_id: "uuid-1",
        phone: "+919876543210",
        description: "LED panel flicker",
        source: "admin",
        status: "open",
      });
    });
  });

  describe("4. Backend constraints / company slug", () => {
    it("prefers profile company_id then deploy slug companyId", () => {
      expect(
        resolveWriteCompanyIdPreference({
          profileCompanyId: "profile-co",
          deployCompanyId: "deploy-co",
        })
      ).toBe("profile-co");
      expect(
        resolveWriteCompanyIdPreference({
          profileCompanyId: null,
          deployCompanyId: "deploy-co",
        })
      ).toBe("deploy-co");
      expect(() =>
        resolveWriteCompanyIdPreference({ profileCompanyId: null, deployCompanyId: null })
      ).toThrow(/Company context missing/);
    });

    it("create defaults require company_id; validates required fields", () => {
      expect(createOrderDefaults("co-1", { client_name: "A" })).toMatchObject({
        company_id: "co-1",
        health: "Active",
      });
      expect(
        validateOrderCreateInput({
          company_id: null,
          customer_id: null,
          workflow_type: "bad",
        })
      ).toEqual([
        "company_id is required",
        "customer_id is required",
        "invalid workflow_type",
      ]);
      expect(assertSameCompany("co-1", "co-1")).toBe(true);
      expect(assertSameCompany("co-2", "co-1")).toBe(false);
    });
  });

  describe("5. Security", () => {
    it("list access: admin always; staff needs view or edit", () => {
      expect(canListOrders({ role: "admin" })).toBe(true);
      expect(canListOrders({ role: "staff", canView: true })).toBe(true);
      expect(canListOrders({ role: "staff", canView: false, canEdit: false })).toBe(false);
    });

    it("production staff cannot edit quotation stage", () => {
      expect(
        resolveStagePermission("quotation", {
          role: "staff",
          staff_role: "Production",
        }).canEdit
      ).toBe(false);
    });
  });

  describe("6. Performance", () => {
    it("filters 8k rows under budget", () => {
      const rows = Array.from({ length: 8000 }, (_, i) =>
        row({
          id: `o-${i}`,
          businessName: `Biz ${i}`,
          clientName: `Client ${i}`,
          orderCode: `A${String(i).padStart(3, "0")}-001`,
          stage: i % 5 === 0 ? "Completed" : "Production",
          health: i % 7 === 0 ? "On Hold" : "Active",
        })
      );
      const start = performance.now();
      const out = filterOrders(rows, {
        search: "Biz 42",
        selectedKpi: "active",
        dateFilterType: "all",
      });
      expect(out.length).toBeGreaterThan(0);
      expect(performance.now() - start).toBeLessThan(100);
    });
  });

  describe("7. Scalability", () => {
    it("filters thousands with combined predicates + paginates", () => {
      const rows = Array.from({ length: 5000 }, (_, i) =>
        row({
          id: `o-${i}`,
          businessName: `Biz ${i}`,
          stage: i % 10 === 0 ? "Completed" : "Site Visit Pending",
          health: i % 11 === 0 ? "Lost" : "Active",
          assignedEmployees: i % 3 === 0 ? [] : ["emp-1"],
        })
      );
      const filtered = filterOrders(rows, {
        healthFilter: "Active",
        selectedKpi: "unassigned",
        dateFilterType: "all",
      });
      expect(filtered.every((r) => (r.assignedEmployees || []).length === 0)).toBe(true);
      expect(computeOrderKpis(rows).active).toBeGreaterThan(4000);
      expect(paginateOrders(filtered, 1, 50).items).toHaveLength(50);
    });
  });
});
