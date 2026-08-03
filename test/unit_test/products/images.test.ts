import { describe, expect, it } from "vitest";
import {
  buildProductImageStoragePath,
  canAddProductImages,
  extractProductImageStoragePaths,
  isAcceptedProductImageMime,
  MAX_PRODUCT_IMAGES,
  PRODUCT_IMAGE_BUCKET,
  PRODUCT_IMAGE_REJECT,
  validateCreateProductForm,
} from "@/features/products/productLogic";

describe("product images", () => {
  describe("UI / UX", () => {
    it("accepts PNG JPG WEBP GIF mime types", () => {
      expect(isAcceptedProductImageMime("image/png")).toBe(true);
      expect(isAcceptedProductImageMime("image/jpeg")).toBe(true);
      expect(isAcceptedProductImageMime("image/webp")).toBe(true);
      expect(isAcceptedProductImageMime("image/gif")).toBe(true);
    });

    it("rejects EXE ZIP PDF and octet-stream", () => {
      for (const mime of PRODUCT_IMAGE_REJECT) {
        expect(isAcceptedProductImageMime(mime)).toBe(false);
      }
      expect(isAcceptedProductImageMime("application/pdf")).toBe(false);
    });

    it("enforces max 5 images (6th rejected)", () => {
      expect(MAX_PRODUCT_IMAGES).toBe(5);
      expect(canAddProductImages(0, 5)).toBe(true);
      expect(canAddProductImages(5, 1)).toBe(false);
      expect(canAddProductImages(4, 2)).toBe(false);
      expect(canAddProductImages(3, 2)).toBe(true);
      expect(
        validateCreateProductForm({
          name: "X",
          images: ["1", "2", "3", "4", "5", "6"],
        }).images
      ).toMatch(/Max 5/);
    });
  });

  describe("Integrations / Storage", () => {
    it("builds path under products/ folder in product-images bucket", () => {
      const path = buildProductImageStoragePath("photo.webp", 1700000000000);
      expect(path.startsWith("products/")).toBe(true);
      expect(path.endsWith(".webp")).toBe(true);
      expect(PRODUCT_IMAGE_BUCKET).toBe("product-images");
    });

    it("extracts storage object paths from public URLs", () => {
      const urls = [
        "https://xyz.supabase.co/storage/v1/object/public/product-images/products/1_abc.webp",
        "https://xyz.supabase.co/storage/v1/object/public/product-images/products/2_def.png",
        "https://bad.example/no-bucket/file.jpg",
      ];
      expect(extractProductImageStoragePaths(urls)).toEqual([
        "products/1_abc.webp",
        "products/2_def.png",
      ]);
    });

    it("delete uses extracted paths so rename does not orphan via wrong key", () => {
      const paths = extractProductImageStoragePaths([
        "https://host/storage/v1/object/public/product-images/products/kept.webp",
      ]);
      expect(paths).toEqual(["products/kept.webp"]);
    });
  });

  describe("Business Functions", () => {
    it("supports create with and without images", () => {
      expect(validateCreateProductForm({ name: "A", images: [] })).toEqual({});
      expect(
        validateCreateProductForm({
          name: "B",
          images: ["https://x/1.webp"],
        })
      ).toEqual({});
    });
  });
});
