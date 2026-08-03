import { describe, expect, it } from "vitest";
import {
  computeCustomerKpis,
  filterCustomersCatalog,
  paginateCustomers,
  type CustomerListRow,
} from "@/features/customers/customerLogic";

function makeCustomers(n: number): CustomerListRow[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `c${i}`,
    name: `Customer ${i}`,
    phone: `9${String(100000000 + i).slice(0, 9)}`,
    email: `c${i}@example.com`,
    status: i % 5 === 0 ? "Inactive" : "Active",
    customerCode: `CUS-${String(i + 1).padStart(4, "0")}`,
    customerType: (["Retail", "Corporate", "Dealer"] as const)[i % 3],
    contactPerson: `Contact ${i}`,
    gstNumber: i % 7 === 0 ? "29AAAAA0000A1Z5" : null,
  }));
}

describe("customer performance", () => {
  describe("Performance", () => {
    it("filters 10 customers quickly", () => {
      const rows = makeCustomers(10);
      const t0 = performance.now();
      expect(filterCustomersCatalog(rows, [], { search: "Customer 5" })).toHaveLength(1);
      expect(performance.now() - t0).toBeLessThan(50);
    });

    it("filters 1,000 customers under budget", () => {
      const rows = makeCustomers(1_000);
      const t0 = performance.now();
      filterCustomersCatalog(rows, [], {
        statusFilter: "Active",
        customerTypeFilter: "Retail",
        search: "Customer 10",
      });
      expect(performance.now() - t0).toBeLessThan(100);
    });

    it("filters 100,000 customers under budget with pagination", () => {
      const rows = makeCustomers(100_000);
      const t0 = performance.now();
      const filtered = filterCustomersCatalog(rows, [], { statusFilter: "Active" });
      const page = paginateCustomers(filtered, 1, 50);
      computeCustomerKpis(rows);
      const ms = performance.now() - t0;
      expect(page.items).toHaveLength(50);
      expect(ms).toBeLessThan(1500);
    });
  });
});
