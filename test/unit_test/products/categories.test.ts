import { describe, expect, it } from "vitest";
import {
  canDeleteCategory,
  validateCategoryName,
} from "@/features/products/productLogic";

describe("product categories", () => {
  describe("Business Rules", () => {
    it("blocks delete when products still use the category", () => {
      const result = canDeleteCategory("Signage", [
        { category: "Signage" },
        { category: "Print" },
        { category: "Signage" },
      ]);
      expect(result.ok).toBe(false);
      expect(result.reason).toMatch(/2 product/);
    });

    it("allows delete when unused", () => {
      expect(canDeleteCategory("Unused", [{ category: "Print" }])).toEqual({
        ok: true,
      });
    });

    it("never silently deletes products with the category", () => {
      // Contract: delete is blocked — products stay intact
      const products = [{ category: "Flex" }, { category: "Flex" }];
      const gate = canDeleteCategory("Flex", products);
      expect(gate.ok).toBe(false);
      expect(products).toHaveLength(2);
    });
  });

  describe("Validation", () => {
    it("rejects empty category name", () => {
      expect(validateCategoryName("")).toBe("Category name is required");
      expect(validateCategoryName("   ")).toBe("Category name is required");
      expect(validateCategoryName("Outdoor")).toBeNull();
    });

    it("allows special characters in name (trim only)", () => {
      expect(validateCategoryName("A&B / Signs")).toBeNull();
      expect(validateCategoryName("LED (Indoor)")).toBeNull();
    });
  });

  describe("Business Functions", () => {
    it("models create vs duplicate as separate name checks", () => {
      const existing = ["Flex", "Acrylic"];
      const create = (name: string) => {
        const err = validateCategoryName(name);
        if (err) throw new Error(err);
        if (existing.some((n) => n.toLowerCase() === name.trim().toLowerCase())) {
          throw new Error("Category already exists.");
        }
        return name.trim();
      };
      expect(create("Vinyl")).toBe("Vinyl");
      expect(() => create("")).toThrow(/required/);
      expect(() => create("flex")).toThrow(/already exists/);
    });
  });
});
