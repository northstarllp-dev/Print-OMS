import { describe, expect, it } from "vitest";
import {
  canArchiveCustomer,
  countOrdersForCustomer,
  filterCustomersCatalog,
  isCustomerSubmitLocked,
  isDuplicateCustomerEmail,
  portalTokenMatchesCustomer,
  type CustomerListRow,
} from "@/features/customers/customerLogic";

describe("customer scalability & edge cases", () => {
  describe("Scalability", () => {
    it("counts linked orders across thousands of rows", () => {
      const orders = Array.from({ length: 5_000 }, (_, i) => ({
        customerId: i % 100 === 0 ? "hot" : `c${i}`,
      }));
      expect(countOrdersForCustomer("hot", orders)).toBe(50);
    });

    it("duplicate-email scan scales for large CRM catalogs", () => {
      const existing = Array.from({ length: 20_000 }, (_, i) => ({
        id: String(i),
        email: `user${i}@example.com`,
      }));
      const t0 = performance.now();
      expect(isDuplicateCustomerEmail("user19999@example.com", existing)).toBe(true);
      expect(isDuplicateCustomerEmail("fresh@example.com", existing)).toBe(false);
      expect(performance.now() - t0).toBeLessThan(100);
    });
  });

  describe("Edge Cases", () => {
    it("refresh-while-saving keeps submit locked", () => {
      expect(isCustomerSubmitLocked(true)).toBe(true);
    });

    it("archive gate with mixed order stages", () => {
      expect(
        canArchiveCustomer("c1", [
          { customerId: "c1", stage: "Completed" },
          { customerId: "other", stage: "Production" },
        ]).ok
      ).toBe(true);
    });

    it("status + type + search combination on large set", () => {
      const customers: CustomerListRow[] = Array.from({ length: 200 }, (_, i) => ({
        id: `c${i}`,
        name: `Biz ${i}`,
        phone: "9876543210",
        email: `b${i}@x.com`,
        status: i % 2 === 0 ? "Active" : "Blocked",
        customerCode: `CUS-${i}`,
        customerType: i % 2 === 0 ? "Corporate" : "Retail",
      }));
      const out = filterCustomersCatalog(customers, [], {
        statusFilter: "Active",
        customerTypeFilter: "Corporate",
        search: "Biz 10",
      });
      expect(out.every((c) => c.status === "Active")).toBe(true);
      expect(out.some((c) => c.id === "c10")).toBe(true);
    });

    it("one customer cannot use another customer's portal token", () => {
      expect(portalTokenMatchesCustomer("a", "b")).toBe(false);
    });
  });
});
