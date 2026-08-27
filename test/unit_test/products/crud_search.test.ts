import { describe, expect, it } from "vitest";
import {
  computeProductKpis,
  filterProductsCatalog,
  isPricingFieldDisabled,
  mapPricingTypeFromDb,
  mapPricingTypeToDb,
  recommendHardDeleteWhenReferenced,
} from "@/features/products/productLogic";

type P = {
  id: string;
  name: string;
  product_id: string;
  category?: string | null;
  is_active: boolean;
  final_prdt?: boolean;
  barcode?: string | null;
  supplier_name?: string | null;
  track_inventory?: boolean;
};

const catalog: P[] = [
  {
    id: "1",
    name: "Flex Banner",
    product_id: "PRD-001",
    category: "Print",
    is_active: true,
    final_prdt: false,
    barcode: "8901001",
    supplier_name: "ABC Supplies",
    track_inventory: true,
  },
  {
    id: "2",
    name: "Acrylic Letter",
    product_id: "PRD-002",
    category: "Signage",
    is_active: false,
    final_prdt: false,
    barcode: "8901002",
    supplier_name: "XYZ Traders",
    track_inventory: false,
  },
  {
    id: "3",
    name: "Shop Kit",
    product_id: "FP001",
    category: "Kits",
    is_active: true,
    final_prdt: true,
    barcode: null,
    supplier_name: null,
    track_inventory: true,
  },
];

describe("product CRUD, search & filters", () => {
  describe("CRUD", () => {
    it("models activate/deactivate instead of recommending hard delete when referenced", () => {
      expect(recommendHardDeleteWhenReferenced()).toBe(false);
      const toggled = catalog.map((p) =>
        p.id === "1" ? { ...p, is_active: !p.is_active } : p
      );
      expect(toggled.find((p) => p.id === "1")?.is_active).toBe(false);
      expect(toggled).toHaveLength(3);
    });

    it("remove from list after delete (hard delete path in UI)", () => {
      const after = catalog.filter((p) => p.id !== "2");
      expect(after.map((p) => p.id)).toEqual(["1", "3"]);
    });
  });

  describe("KPI & Analytics", () => {
    it("computes active / inactive / final / inventory KPIs", () => {
      expect(computeProductKpis(catalog)).toEqual({
        total: 3,
        active: 2,
        inactive: 1,
        final: 1,
        inventoryTracked: 2,
      });
    });
  });

  describe("Search", () => {
    it("searches by name, ID, category", () => {
      expect(
        filterProductsCatalog(catalog, { search: "flex" }).map((p) => p.id)
      ).toEqual(["1"]);
      expect(
        filterProductsCatalog(catalog, { search: "prd-002" }).map((p) => p.id)
      ).toEqual(["2"]);
      expect(
        filterProductsCatalog(catalog, { search: "kits" }).map((p) => p.id)
      ).toEqual(["3"]);
    });

    it("can also search barcode and supplier when enabled", () => {
      expect(
        filterProductsCatalog(catalog, {
          search: "8901001",
          searchBarcode: true,
        }).map((p) => p.id)
      ).toEqual(["1"]);
      expect(
        filterProductsCatalog(catalog, {
          search: "xyz",
          searchSupplier: true,
        }).map((p) => p.id)
      ).toEqual(["2"]);
    });
  });

  describe("Filters", () => {
    it("filters Active / Inactive / Category / Final", () => {
      expect(
        filterProductsCatalog(catalog, { statusFilter: "Active" }).map((p) => p.id)
      ).toEqual(["1", "3"]);
      expect(
        filterProductsCatalog(catalog, { statusFilter: "Inactive" }).map((p) => p.id)
      ).toEqual(["2"]);
      expect(
        filterProductsCatalog(catalog, { categoryFilter: "Signage" }).map((p) => p.id)
      ).toEqual(["2"]);
      expect(
        filterProductsCatalog(catalog, { finalFilter: "Final" }).map((p) => p.id)
      ).toEqual(["3"]);
    });
  });

  describe("Business Functions pricing", () => {
    it("disables unrelated price fields for single pricing type", () => {
      expect(isPricingFieldDisabled("price_per_sqft", "Per Sq.Ft")).toBe(false);
      expect(isPricingFieldDisabled("price_per_unit", "Per Sq.Ft")).toBe(true);
      expect(isPricingFieldDisabled("price_per_unit", "Per Unit")).toBe(false);
      expect(isPricingFieldDisabled("price_per_sqft", "Multiple")).toBe(false);
    });

    it("maps pricing type UI ↔ DB", () => {
      expect(mapPricingTypeToDb("Per Sq.Ft")).toBe("per_sqft");
      expect(mapPricingTypeToDb("Per Unit")).toBe("per_unit");
      expect(mapPricingTypeFromDb("per_sqft")).toBe("Per Sq.Ft");
      expect(mapPricingTypeFromDb("per_unit")).toBe("Per Unit");
    });
  });
});
