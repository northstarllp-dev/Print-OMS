import { describe, expect, it } from "vitest";
import {
  buildCreateProductDefaults,
  filterProductsCatalog,
  inventoryFieldsVisible,
  isInventoryCatalogProduct,
} from "@/features/products/productLogic";

describe("inventory & final product", () => {
  describe("UI / UX", () => {
    it("shows stock/purchase/supplier fields when track inventory is ON", () => {
      expect(inventoryFieldsVisible(true)).toBe(true);
      expect(inventoryFieldsVisible(undefined)).toBe(true);
    });

    it("hides inventory fields when track inventory is OFF", () => {
      expect(inventoryFieldsVisible(false)).toBe(false);
    });

    it("toggles visibility repeatedly without losing rule", () => {
      let track = true;
      for (let i = 0; i < 10; i++) {
        track = !track;
        expect(inventoryFieldsVisible(track)).toBe(track);
      }
    });
  });

  describe("Business Rules", () => {
    it("defaults track_inventory ON for new products", () => {
      expect(buildCreateProductDefaults().track_inventory).toBe(true);
    });

    it("final product toggle switches ID series", () => {
      const existing = [{ product_id: "PRD-001" }, { product_id: "FP001" }];
      expect(
        buildCreateProductDefaults({ final_prdt: false, existing }).product_id
      ).toBe("PRD-002");
      expect(
        buildCreateProductDefaults({ final_prdt: true, existing }).product_id
      ).toBe("FP002");
    });

    it("inactive final products are excluded from active-only views", () => {
      const products = [
        { name: "Kit A", is_active: true, final_prdt: true },
        { name: "Kit B", is_active: false, final_prdt: true },
        { name: "Vinyl", is_active: true, final_prdt: false },
      ];
      const activeFinal = filterProductsCatalog(products, {
        statusFilter: "Active",
        finalFilter: "Final",
      });
      expect(activeFinal.map((p) => p.name)).toEqual(["Kit A"]);
    });
  });

  describe("Business Functions", () => {
    it("inventory catalog requires track_inventory and active", () => {
      expect(
        isInventoryCatalogProduct({ track_inventory: true, is_active: true })
      ).toBe(true);
      expect(
        isInventoryCatalogProduct({ track_inventory: false, is_active: true })
      ).toBe(false);
      expect(
        isInventoryCatalogProduct({ track_inventory: true, is_active: false })
      ).toBe(false);
    });
  });

  describe("Filters", () => {
    it("filters Final vs Regular", () => {
      const products = [
        { name: "A", final_prdt: true, is_active: true },
        { name: "B", final_prdt: false, is_active: true },
      ];
      expect(
        filterProductsCatalog(products, { finalFilter: "Final" }).map((p) => p.name)
      ).toEqual(["A"]);
      expect(
        filterProductsCatalog(products, { finalFilter: "Regular" }).map((p) => p.name)
      ).toEqual(["B"]);
    });
  });
});
