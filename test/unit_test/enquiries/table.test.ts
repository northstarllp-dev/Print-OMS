import { describe, expect, it } from "vitest";
import {
  canListEnquiries,
  computeEnquiryKpis,
  countActiveEnquiryFilters,
  filterEnquiries,
  mapDbEnquiryToViewRow,
  uniqueAddedByOptions,
  type EnquiryListRow,
} from "@/features/enquiries/enquiryListLogic";
import { resolveStagePermission } from "@/features/orders/workspace/shared/permissions";

function row(partial: Partial<EnquiryListRow> & { id: string }): EnquiryListRow {
  return {
    leadName: "Lead",
    businessName: "Biz",
    phone: "+919876543210",
    source: "Website",
    status: "Pending",
    health: "Active",
    addedBy: "Admin",
    dateReceived: "2026-08-01T10:00:00.000Z",
    ...partial,
  };
}

const sampleRows = [
  row({
    id: "1",
    businessName: "Gourmet Cafe",
    leadName: "Ramesh",
    phone: "+919811111111",
    source: "Website",
    status: "Pending",
    health: "Active",
    addedBy: "Priya",
    dateReceived: "2026-08-02T00:00:00.000Z",
    email: "ramesh@gourmet.test",
    enquireId: "ENQ-1001",
  }),
  row({
    id: "2",
    businessName: "Metro Mart",
    leadName: "Anita",
    phone: "+919822222222",
    source: "Meta Ads",
    status: "Converted",
    health: "On Hold",
    addedBy: "Admin",
    dateReceived: "2026-07-15T00:00:00.000Z",
  }),
  row({
    id: "3",
    businessName: "Lost Lead Co",
    leadName: "Sam",
    phone: "+919833333333",
    source: "Referrals",
    status: "Pending",
    health: "Lost",
    addedBy: "Priya",
    dateReceived: "2026-08-05T00:00:00.000Z",
  }),
];

describe("table", () => {
  describe("frontend", () => {
    it("computes KPI cards from full list", () => {
      expect(computeEnquiryKpis(sampleRows)).toEqual({
        total: 3,
        pending: 2,
        converted: 1,
        conversionRate: 33,
      });
      expect(computeEnquiryKpis([])).toEqual({
        total: 0,
        pending: 0,
        converted: 0,
        conversionRate: 0,
      });
    });

    it("filters by search, source, addedBy, health, KPI, and date", () => {
      expect(filterEnquiries(sampleRows, { search: "gourmet" }).map((e) => e.id)).toEqual(["1"]);
      expect(filterEnquiries(sampleRows, { search: "ramesh@gourmet.test" }).map((e) => e.id)).toEqual(["1"]);
      expect(filterEnquiries(sampleRows, { search: "ENQ-1001" }).map((e) => e.id)).toEqual(["1"]);
      expect(filterEnquiries(sampleRows, { search: "98333" }).map((e) => e.id)).toEqual(["3"]);
      expect(filterEnquiries(sampleRows, { sourceFilter: "Meta Ads" })).toHaveLength(1);
      expect(filterEnquiries(sampleRows, { addedByFilter: "Priya" })).toHaveLength(2);
      expect(filterEnquiries(sampleRows, { healthFilter: "Lost" }).map((e) => e.id)).toEqual(["3"]);
      expect(
        filterEnquiries(sampleRows, { selectedKpi: "pending" }).every((e) => e.status === "Pending")
      ).toBe(true);
      expect(filterEnquiries(sampleRows, { selectedKpi: "total" })).toHaveLength(3);
      expect(
        filterEnquiries(sampleRows, {
          dateFilterType: "range",
          startDate: "2026-08-01",
          endDate: "2026-08-31",
        }).map((e) => e.id)
      ).toEqual(["1", "3"]);
      expect(uniqueAddedByOptions(sampleRows)).toEqual(["Admin", "Priya"]);
      expect(
        countActiveEnquiryFilters({
          sourceFilter: "Website",
          startDate: "2026-08-01",
          selectedKpi: "pending",
        })
      ).toBe(3);
    });
  });

  describe("backend", () => {
    it("maps DB join row → table columns with friendly customer/order ids", () => {
      const mapped = mapDbEnquiryToViewRow({
        id: "uuid-1",
        date_received: "2026-08-01T12:00:00Z",
        lead_name: "Ramesh",
        business_name: null,
        phone: "+919876543210",
        whatsapp: "+919876543210",
        email: "a@b.com",
        source: "Website",
        status: "Pending",
        notes: "note",
        primary_communication_mode: "WHATSAPP",
        location: "Whitefield",
        customer_id: "cust-uuid",
        order_id: null,
        enquire_id: "ENQ001",
        added_by: "Priya",
        health: "Needs Attention",
        lost_reason: null,
        customers: { customer_id: "CUS001" },
        orders: null,
      });
      expect(mapped).toMatchObject({
        businessName: "Ramesh",
        enquireId: "ENQ001",
        customerId: "CUS001",
        health: "Needs Attention",
      });
    });

    it("falls back when friendly ids are missing", () => {
      const mapped = mapDbEnquiryToViewRow({
        id: "uuid-2",
        lead_name: "A",
        enquire_id: null,
        customer_id: "c-uuid",
        order_id: "o-uuid",
        orders: { order_id: "ORD099" },
      });
      expect(mapped.enquireId).toBe("uuid-2");
      expect(mapped.orderId).toBe("ORD099");
    });
  });

  describe("security", () => {
    it("list access: admin always; staff needs view or edit", () => {
      expect(canListEnquiries({ role: "admin", canView: false, canEdit: false })).toBe(true);
      expect(canListEnquiries({ role: "staff", canView: true, canEdit: false })).toBe(true);
      expect(canListEnquiries({ role: "staff", canView: false, canEdit: false })).toBe(false);
    });

    it("staff without enquiry grant cannot open editable table actions", () => {
      expect(
        resolveStagePermission("enquiry", { role: "staff", staff_role: "Production" }).canEdit
      ).toBe(false);
    });
  });

  describe("scalability", () => {
    it("filters thousands of rows with combined predicates", () => {
      const rows = Array.from({ length: 5000 }, (_, i) =>
        row({
          id: `e-${i}`,
          businessName: `Biz ${i}`,
          leadName: `Lead ${i}`,
          phone: `+9198${String(i).padStart(8, "0")}`,
          source: i % 2 === 0 ? "Website" : "Meta Ads",
          status: i % 5 === 0 ? "Converted" : "Pending",
          health: i % 7 === 0 ? "Lost" : "Active",
          addedBy: i % 3 === 0 ? "Admin" : "Priya",
        })
      );
      const filtered = filterEnquiries(rows, {
        sourceFilter: "Website",
        healthFilter: "Active",
        selectedKpi: "pending",
      });
      expect(filtered.every((r) => r.source === "Website")).toBe(true);
      expect(filtered.every((r) => r.status === "Pending")).toBe(true);
      expect(computeEnquiryKpis(rows).total).toBe(5000);
    });
  });

  describe("performance", () => {
    it("filters 8k rows under budget", () => {
      const rows = Array.from({ length: 8000 }, (_, i) =>
        row({
          id: `e-${i}`,
          businessName: `Biz ${i}`,
          leadName: `Lead ${i}`,
          phone: `+91${i}`,
        })
      );
      const start = performance.now();
      const out = filterEnquiries(rows, { search: "Biz 42", selectedKpi: "pending" });
      expect(out.length).toBeGreaterThan(0);
      // Wall-clock budget loose for busy hosts; still catches O(n²) blowups.
      expect(performance.now() - start).toBeLessThan(500);
    });
  });
});
