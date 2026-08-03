import { describe, expect, it } from "vitest";
import {
  computeCustomerKpis,
  filterCustomersCatalog,
  mapDbCustomerToListRow,
  paginateCustomers,
  resetCustomerFilters,
  type CustomerListRow,
} from "@/features/customers/customerLogic";

const customers: CustomerListRow[] = [
  {
    id: "c1",
    name: "Gourmet Cafe",
    phone: "9876543210",
    email: "a@cafe.com",
    status: "Active",
    customerCode: "CUS-001",
    customerType: "Retail",
  },
  {
    id: "c2",
    name: "Acme Corp",
    phone: "9123456780",
    email: "ops@acme.com",
    status: "Inactive",
    customerCode: "CUS-002",
    customerType: "Corporate",
  },
  {
    id: "c3",
    name: "Pending Lead",
    phone: "9000000000",
    email: "p@lead.com",
    status: "Pending",
    customerCode: "CUS-003",
    customerType: "Dealer",
  },
];

describe("customer list", () => {
  describe("Display", () => {
    it("maps DB rows to list columns", () => {
      const row = mapDbCustomerToListRow({
        id: "uuid-1",
        name: "Biz",
        phone: "9999999999",
        email: "b@x.com",
        whatsapp: "9999999999",
        city: "BLR",
        billing_address: "Bill St",
        shipping_address: "Ship St",
        status: "Active",
        customer_id: "CUS-010",
      });
      expect(row).toMatchObject({
        id: "uuid-1",
        name: "Biz",
        phone: "9999999999",
        email: "b@x.com",
        billingAddress: "Bill St",
        shippingAddress: "Ship St",
        customerCode: "CUS-010",
        status: "Active",
      });
    });

    it("shows empty state when filter yields nothing", () => {
      expect(
        filterCustomersCatalog(customers, [], { search: "zzz-no-match" })
      ).toHaveLength(0);
    });

    it("paginates list results", () => {
      const page1 = paginateCustomers(customers, 1, 2);
      expect(page1.items).toHaveLength(2);
      expect(page1.totalPages).toBe(2);
      expect(paginateCustomers(customers, 2, 2).items.map((c) => c.id)).toEqual([
        "c3",
      ]);
    });
  });

  describe("KPI & Analytics", () => {
    it("computes active / pending KPIs", () => {
      expect(computeCustomerKpis(customers)).toMatchObject({
        total: 3,
        active: 1,
        pending: 1,
        inactive: 1,
        activePercentage: 33,
      });
    });
  });

  describe("Filters", () => {
    it("filters by status", () => {
      expect(
        filterCustomersCatalog(customers, [], { statusFilter: "Active" }).map(
          (c) => c.id
        )
      ).toEqual(["c1"]);
      expect(
        filterCustomersCatalog(customers, [], { statusFilter: "Inactive" }).map(
          (c) => c.id
        )
      ).toEqual(["c2"]);
    });

    it("filters by customer type", () => {
      expect(
        filterCustomersCatalog(customers, [], {
          customerTypeFilter: "Corporate",
        }).map((c) => c.id)
      ).toEqual(["c2"]);
    });

    it("filters by order count", () => {
      const orders = [
        { customerId: "c1" },
        { customerId: "c1" },
        { customerId: "c2" },
      ];
      expect(
        filterCustomersCatalog(customers, orders, {
          orderCountFilter: "0",
        }).map((c) => c.id)
      ).toEqual(["c3"]);
      expect(
        filterCustomersCatalog(customers, orders, {
          orderCountFilter: "1",
        }).map((c) => c.id)
      ).toEqual(["c2"]);
      expect(
        filterCustomersCatalog(customers, orders, {
          orderCountFilter: "multiple",
        }).map((c) => c.id)
      ).toEqual(["c1"]);
    });

    it("combines status + search and resets defaults", () => {
      expect(
        filterCustomersCatalog(customers, [], {
          search: "acme",
          statusFilter: "Inactive",
        }).map((c) => c.id)
      ).toEqual(["c2"]);
      expect(resetCustomerFilters()).toEqual({
        search: "",
        statusFilter: "ALL",
        customerTypeFilter: "ALL",
        orderCountFilter: "ALL",
      });
    });
  });
});
