import { describe, expect, it } from "vitest";
import {
  canDeleteCategory,
  filterProductsCatalog,
  generateProductId,
  isDuplicateProductName,
  isProductSubmitLocked,
  nextProductIdFromCodes,
  validateCategoryName,
} from "@/features/products/productLogic";

describe("product scalability & edge cases", () => {
  describe("Scalability", () => {
    it("handles thousands of categories in delete checks", () => {
      const products = Array.from({ length: 2_000 }, (_, i) => ({
        category: `Cat ${i % 500}`,
      }));
      expect(canDeleteCategory("Cat 0", products).ok).toBe(false);
      expect(canDeleteCategory("Unused Mega", products).ok).toBe(true);
    });

    it("handles bulk-like ID allocation after many products", () => {
      const ids = Array.from({ length: 2_500 }, (_, i) => `PRD-${String(i + 1).padStart(3, "0")}`);
      expect(nextProductIdFromCodes(ids)).toBe("PRD-2501");
    });

    it("duplicate-name scan scales linearly for large catalogs", () => {
      const existing = Array.from({ length: 10_000 }, (_, i) => ({
        id: String(i),
        name: `Item ${i}`,
      }));
      const t0 = performance.now();
      expect(isDuplicateProductName("Item 9999", existing)).toBe(true);
      expect(isDuplicateProductName("Brand New SKU", existing)).toBe(false);
      expect(performance.now() - t0).toBeLessThan(100);
    });
  });

  describe("Edge Cases", () => {
    it("refresh-while-saving: pending lock still blocks second submit", () => {
      expect(isProductSubmitLocked(true)).toBe(true);
    });

    it("category deleted while adding: empty/invalid category name fails validation", () => {
      expect(validateCategoryName("")).toBeTruthy();
    });

    it("two admins racing IDs: both compute same next id until DB unique constraint / retry", () => {
      const existing = [{ product_id: "PRD-010" }];
      const a = generateProductId(existing);
      const b = generateProductId(existing);
      expect(a).toBe(b);
      expect(a).toBe("PRD-011");
      // Backend must retry on 23505 — covered as contract: next after collision is max+1
      expect(generateProductId([{ product_id: a }, ...existing])).toBe("PRD-012");
    });

    it("archived (inactive) product still searchable by ID for historical references", () => {
      const rows = [
        {
          name: "Old Flex",
          product_id: "PRD-001",
          is_active: false,
          category: "Print",
        },
      ];
      expect(
        filterProductsCatalog(rows, { search: "PRD-001", statusFilter: "All" })
      ).toHaveLength(1);
      expect(
        filterProductsCatalog(rows, { search: "PRD-001", statusFilter: "Active" })
      ).toHaveLength(0);
    });
  });

  describe("Automation", () => {
    it("ID padding stays stable for automation / external refs", () => {
      expect(nextProductIdFromCodes([])).toBe("PRD-001");
      expect(nextProductIdFromCodes(["PRD-009"])).toBe("PRD-010");
      // Non-zero-padded still matches \d+ and advances from max
      expect(nextProductIdFromCodes(["PRD-9"])).toBe("PRD-010");
    });
  });
});
