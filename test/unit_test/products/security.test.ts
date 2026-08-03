import { describe, expect, it } from "vitest";
import {
  canAccessAdminProducts,
  customerCanAccessProducts,
  extractProductImageStoragePaths,
  productsForTenant,
  salesCanMutateProducts,
} from "@/features/products/productLogic";

describe("product security", () => {
  describe("RBAC", () => {
    it("admin can access products module", () => {
      expect(canAccessAdminProducts("admin")).toBe(true);
    });

    it("sales / production / customer cannot use admin products mutations", () => {
      expect(canAccessAdminProducts("sales")).toBe(false);
      expect(canAccessAdminProducts("production")).toBe(false);
      expect(canAccessAdminProducts("customer")).toBe(false);
      expect(salesCanMutateProducts()).toBe(false);
      expect(customerCanAccessProducts()).toBe(false);
    });
  });

  describe("Database / tenancy", () => {
    it("scopes catalog to company_id", () => {
      const rows = [
        { product_id: "PRD-001", company_id: "a" },
        { product_id: "PRD-002", company_id: "b" },
        { product_id: "PRD-003", company_id: "a" },
      ];
      expect(productsForTenant(rows, "a").map((p) => p.product_id)).toEqual([
        "PRD-001",
        "PRD-003",
      ]);
    });
  });

  describe("Storage", () => {
    it("only derives object keys under product-images bucket path", () => {
      const privateGuess =
        "https://host/storage/v1/object/public/other-bucket/products/private-image.webp";
      expect(extractProductImageStoragePaths([privateGuess])).toEqual([]);
      expect(
        extractProductImageStoragePaths([
          "https://host/storage/v1/object/public/product-images/products/ok.webp",
        ])
      ).toEqual(["products/ok.webp"]);
    });
  });
});
