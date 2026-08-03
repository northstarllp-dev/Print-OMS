import { describe, expect, it } from "vitest";
import {
  computeCustomerTotalSpend,
  getOrderHealthBadgeClass,
  linkedOrdersForCustomer,
  type CustomerOrderRow,
} from "@/features/customers/customerLogic";

const orders: CustomerOrderRow[] = [
  {
    id: "o1",
    customerId: "c1",
    stage: "Production",
    budget: 12000,
    orderCode: "ORD-001",
    health: "Active",
  },
  {
    id: "o2",
    customerId: "c1",
    stage: "Completed",
    budget: 8000,
    orderCode: "ORD-002",
    health: "Needs Attention",
  },
  {
    id: "o3",
    customerId: "c2",
    stage: "Quotation",
    budget: 5000,
    orderCode: "ORD-003",
    health: "On Hold",
  },
];

describe("customer details & linked orders", () => {
  describe("Customer Details Panel", () => {
    it("returns only linked orders for selected customer", () => {
      expect(linkedOrdersForCustomer("c1", orders).map((o) => o.id)).toEqual([
        "o1",
        "o2",
      ]);
      expect(linkedOrdersForCustomer("missing", orders)).toEqual([]);
    });

    it("computes total spend from linked order budgets", () => {
      expect(computeCustomerTotalSpend("c1", orders)).toBe(20000);
      expect(computeCustomerTotalSpend("c2", orders)).toBe(5000);
      expect(computeCustomerTotalSpend("c9", orders)).toBe(0);
    });
  });

  describe("Linked Orders", () => {
    it("preserves stage, amount, and health for drawer", () => {
      const [first] = linkedOrdersForCustomer("c1", orders);
      expect(first).toMatchObject({
        stage: "Production",
        budget: 12000,
        orderCode: "ORD-001",
        health: "Active",
      });
      expect(getOrderHealthBadgeClass("Needs Attention")).toMatch(/amber/);
      expect(getOrderHealthBadgeClass("Lost")).toMatch(/rose/);
    });
  });
});
