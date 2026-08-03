import { describe, expect, it } from "vitest";
import {
  buildCreateProductDefaults,
  generateFinalProductId,
  generateProductId,
  isDuplicateProductId,
  isDuplicateProductName,
  isProductSubmitLocked,
  nextProductIdFromCodes,
  shouldReuseDeletedProductIds,
  validateCreateProductForm,
  validateGstRate,
  validateNonNegative,
  validateProductName,
} from "@/features/products/productLogic";

describe("product creation", () => {
  describe("Business Rules", () => {
    it("never reuses deleted product IDs (max+1)", () => {
      expect(shouldReuseDeletedProductIds()).toBe(false);
      // PRD-001, PRD-002 deleted, PRD-003 exists → next is PRD-004
      expect(nextProductIdFromCodes(["PRD-001", "PRD-003"])).toBe("PRD-004");
      expect(generateProductId([{ product_id: "PRD-002" }, { product_id: "PRD-010" }])).toBe(
        "PRD-011"
      );
    });

    it("scopes IDs per tenant company", () => {
      const existing = [
        { product_id: "PRD-005", company_id: "co-a" },
        { product_id: "PRD-099", company_id: "co-b" },
      ];
      expect(generateProductId(existing, "co-a")).toBe("PRD-006");
      expect(generateProductId(existing, "co-b")).toBe("PRD-100");
    });

    it("assigns FP### for final products", () => {
      expect(generateFinalProductId([{ product_id: "FP001" }, { product_id: "PRD-001" }])).toBe(
        "FP002"
      );
      expect(nextProductIdFromCodes(["FP009"], true)).toBe("FP010");
    });
  });

  describe("UI / UX", () => {
    it("defaults new product to Active with inventory tracked and empty images", () => {
      const defaults = buildCreateProductDefaults({
        existing: [{ product_id: "PRD-001" }],
      });
      expect(defaults.is_active).toBe(true);
      expect(defaults.track_inventory).toBe(true);
      expect(defaults.images).toEqual([]);
      expect(defaults.product_id).toBe("PRD-002");
    });

    it("locks submit while pending (double-click / duplicate submission)", () => {
      expect(isProductSubmitLocked(false)).toBe(false);
      expect(isProductSubmitLocked(true)).toBe(true);
    });
  });

  describe("Business Functions", () => {
    it("supports normal vs final product defaults", () => {
      expect(buildCreateProductDefaults({ final_prdt: false }).final_prdt).toBe(false);
      expect(buildCreateProductDefaults({ final_prdt: true }).final_prdt).toBe(true);
      expect(
        buildCreateProductDefaults({
          final_prdt: true,
          existing: [{ product_id: "FP003" }],
        }).product_id
      ).toBe("FP004");
    });
  });

  describe("Validation", () => {
    it("requires product name", () => {
      expect(validateProductName("")).toBe("Product name is required");
      expect(validateProductName("   ")).toBe("Product name is required");
      expect(validateProductName("Banner Vinyl")).toBeNull();
    });

    it("detects duplicate product name and ID", () => {
      const existing = [
        { id: "1", name: "Flex Board", product_id: "PRD-001" },
        { id: "2", name: "Acrylic Sign", product_id: "PRD-002" },
      ];
      expect(isDuplicateProductName("flex board", existing)).toBe(true);
      expect(isDuplicateProductName("New Item", existing)).toBe(false);
      expect(isDuplicateProductName("Flex Board", existing, "1")).toBe(false);
      expect(isDuplicateProductId("PRD-002", existing)).toBe(true);
      expect(isDuplicateProductId("PRD-003", existing)).toBe(false);
    });

    it("rejects negative price / stock and invalid GST", () => {
      expect(validateNonNegative(-1, "Price")).toMatch(/negative/);
      expect(validateNonNegative(0, "Price")).toBeNull();
      expect(validateGstRate(-1)).toMatch(/0 and 100/);
      expect(validateGstRate(118)).toMatch(/0 and 100/);
      expect(validateGstRate(18)).toBeNull();
      expect(validateGstRate(null)).toBeNull();
    });

    it("aggregates create-form validation errors", () => {
      const errors = validateCreateProductForm({
        name: "",
        gst_rate: 150,
        price_per_unit: -5,
        min_stock: -1,
        images: ["a", "b", "c", "d", "e", "f"],
      });
      expect(errors.name).toBeTruthy();
      expect(errors.gst_rate).toBeTruthy();
      expect(errors.price).toBeTruthy();
      expect(errors.stock).toBeTruthy();
      expect(errors.images).toMatch(/Max 5/);
    });

    it("accepts a valid create payload shape", () => {
      expect(
        validateCreateProductForm({
          name: "LED Module",
          gst_rate: 18,
          price_per_unit: 120,
          min_stock: 0,
          max_stock: 100,
          images: ["https://x/img.webp"],
        })
      ).toEqual({});
    });
  });

  describe("Double Click / Duplicate Submission", () => {
    it("only allows one in-flight create when button is pending", () => {
      let creates = 0;
      const submit = (pending: boolean) => {
        if (isProductSubmitLocked(pending)) return;
        creates += 1;
      };
      submit(false);
      submit(true);
      submit(true);
      submit(true);
      expect(creates).toBe(1);
    });
  });
});
