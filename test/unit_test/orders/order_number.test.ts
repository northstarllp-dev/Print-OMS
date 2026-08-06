import { describe, expect, it } from "vitest";
import {
  formatOrderId,
  maxOrderSequence,
  nextOrderIdAfterDelete,
  nextOrderIdForCreate,
  parseOrderSequence,
  requiresCompanyIdForOrderNumber,
} from "@/features/orders/orderNumberLogic";
import { orderDeleteMode, validateOrderCreateInput } from "@/features/orders/orderListLogic";

describe("order number generation", () => {
  describe("1. Business Operations", () => {
    it("formats customer-scoped friendly ids like A001-001", () => {
      expect(formatOrderId("A001", 1)).toBe("A001-001");
      expect(formatOrderId("A001", 42)).toBe("A001-042");
      expect(parseOrderSequence("A001-007")).toBe(7);
      expect(parseOrderSequence("bad")).toBeNull();
    });

    it("requires company_id before the DB trigger can allocate", () => {
      expect(requiresCompanyIdForOrderNumber(null)).toBe(true);
      expect(requiresCompanyIdForOrderNumber("co-1")).toBe(false);
      expect(
        validateOrderCreateInput({ company_id: null, customer_id: "c1" })
      ).toContain("company_id is required");
    });
  });

  describe("2. Delete → next order number", () => {
    it("uses hard delete (no soft-delete restore of order_id)", () => {
      expect(orderDeleteMode()).toBe("hard");
    });

    it("after deleting a middle order, next id still advances past MAX", () => {
      // Remaining: A001-001, A001-003 → max=3 → next A001-004 (gap at 002 not reused)
      expect(nextOrderIdAfterDelete("A001", ["A001-001", "A001-003"])).toBe("A001-004");
    });

    it("after deleting the highest order, next id reuses that sequence", () => {
      // Had 001,002,003; delete 003 → remaining max=2 → next A001-003
      expect(nextOrderIdAfterDelete("A001", ["A001-001", "A001-002"])).toBe("A001-003");
    });

    it("after deleting all orders for a customer, next id is 001", () => {
      expect(nextOrderIdAfterDelete("A001", [])).toBe("A001-001");
      expect(maxOrderSequence([])).toBe(0);
    });

    it("create uses the same MAX+1 rule within customer+company scope", () => {
      expect(nextOrderIdForCreate("B010", ["B010-001", "B010-002"])).toBe("B010-003");
    });

    it("ignores other customers' sequences (caller must pass same-customer ids only)", () => {
      // Caller scopes by customer_id + company_id like the trigger
      expect(nextOrderIdForCreate("A001", ["A001-001", "A001-002"])).toBe("A001-003");
      expect(nextOrderIdForCreate("A002", ["A002-009"])).toBe("A002-010");
    });
  });

  describe("3. Performance / scale", () => {
    it("computes next id over large remaining sets quickly", () => {
      const ids = Array.from({ length: 20_000 }, (_, i) =>
        formatOrderId("A001", i + 1)
      );
      const start = performance.now();
      expect(nextOrderIdAfterDelete("A001", ids)).toBe("A001-20001");
      // Budget is generous: catches O(n²) regressions, not wall-clock noise on busy CI/dev machines.
      expect(performance.now() - start).toBeLessThan(150);
    });
  });
});
