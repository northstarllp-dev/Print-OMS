import { describe, expect, it } from "vitest";
import {
  computeProductKpis,
  filterProductsCatalog,
  generateProductId,
} from "@/features/products/productLogic";

function makeProducts(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: String(i),
    name: `Product ${i}`,
    product_id: `PRD-${String(i + 1).padStart(3, "0")}`,
    category: `Cat ${i % 20}`,
    is_active: i % 3 !== 0,
    final_prdt: i % 11 === 0,
    barcode: `BC${i}`,
    supplier_name: `Sup ${i % 50}`,
    track_inventory: i % 2 === 0,
  }));
}

describe("product performance", () => {
  describe("Performance", () => {
    it("filters 10 products quickly", () => {
      const products = makeProducts(10);
      const t0 = performance.now();
      const out = filterProductsCatalog(products, { search: "Product 5" });
      const ms = performance.now() - t0;
      expect(out).toHaveLength(1);
      expect(ms).toBeLessThan(50);
    });

    it("filters 1,000 products under budget", () => {
      const products = makeProducts(1_000);
      const t0 = performance.now();
      const out = filterProductsCatalog(products, {
        statusFilter: "Active",
        categoryFilter: "Cat 3",
      });
      const ms = performance.now() - t0;
      expect(out.length).toBeGreaterThan(0);
      expect(ms).toBeLessThan(100);
    });

    it("filters 50,000 products under budget", () => {
      const products = makeProducts(50_000);
      const t0 = performance.now();
      filterProductsCatalog(products, { search: "prd-25000" });
      computeProductKpis(products);
      const ms = performance.now() - t0;
      expect(ms).toBeLessThan(500);
    });

    it("generates next ID from large catalog without scanning gaps incorrectly", () => {
      const existing = makeProducts(5_000).map((p) => ({
        product_id: p.product_id,
      }));
      const t0 = performance.now();
      expect(generateProductId(existing)).toBe("PRD-5001");
      expect(performance.now() - t0).toBeLessThan(100);
    });
  });
});
