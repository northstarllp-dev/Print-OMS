import { describe, expect, it } from "vitest";
import {
  buildProductImageStoragePath,
  canAddProductImages,
  extractProductImageStoragePaths,
  isAcceptedProductImageMime,
  isProductImageUrl,
  MAX_PRODUCT_IMAGE_BYTES,
  MAX_PRODUCT_IMAGES,
  normalizeProductImageUrls,
  PRODUCT_IMAGE_BUCKET,
  PRODUCT_IMAGE_PIPELINE,
  PRODUCT_IMAGE_REJECT,
  remainingProductImageSlots,
  takeProductImageSlots,
  validateCreateProductForm,
  validateProductImageFile,
} from "@/features/products/productLogic";
import { isPublicBucket } from "@/utils/supabase/storageConfig";
import { shouldAttemptCompression } from "@/utils/storage/compressImage";

/**
 * Product catalog images:
 * - Public bucket by design (shown in portal / quotation without auth)
 * - Image pipeline: MIME allowlist, 50 MB, compression, concurrency-capped uploads
 * - Paths under products/… ; deletes validated + admin-gated
 */

describe("product images - architecture", () => {
  it("uses the public product-images catalog bucket (not signed-read)", () => {
    expect(PRODUCT_IMAGE_BUCKET).toBe("product-images");
    expect(isPublicBucket(PRODUCT_IMAGE_BUCKET)).toBe(true);
    expect(PRODUCT_IMAGE_PIPELINE).toBe("image");
  });

  it("shares the 50 MB image-pipeline size ceiling", () => {
    expect(MAX_PRODUCT_IMAGE_BYTES).toBe(50 * 1024 * 1024);
  });
});

describe("product images - UI / UX", () => {
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

  it("slices multi-select down to remaining slots", () => {
    const files = [
      new File(["a"], "a.jpg", { type: "image/jpeg" }),
      new File(["b"], "b.jpg", { type: "image/jpeg" }),
      new File(["c"], "c.jpg", { type: "image/jpeg" }),
    ];
    expect(remainingProductImageSlots(3)).toBe(2);
    const { accepted, rejectedCount } = takeProductImageSlots(files, 3);
    expect(accepted).toHaveLength(2);
    expect(rejectedCount).toBe(1);
    expect(takeProductImageSlots(files, 5)).toEqual({
      accepted: [],
      rejectedCount: 3,
    });
  });
});

describe("product images - validation", () => {
  it("accepts standard images within 50 MB", () => {
    for (const f of [
      { fileName: "a.jpg", mime: "image/jpeg", size: 2_000_000 },
      { fileName: "a.png", mime: "image/png", size: 4_000_000 },
      { fileName: "a.webp", mime: "image/webp", size: 1_000_000 },
      { fileName: "a.gif", mime: "image/gif", size: 500_000 },
    ]) {
      expect(validateProductImageFile(f).ok).toBe(true);
    }
  });

  it("accepts at the exact 50 MB boundary", () => {
    expect(
      validateProductImageFile({
        fileName: "big.jpg",
        size: MAX_PRODUCT_IMAGE_BYTES,
        mime: "image/jpeg",
      }).ok
    ).toBe(true);
  });

  it("rejects files over 50 MB", () => {
    const r = validateProductImageFile({
      fileName: "huge.jpg",
      size: MAX_PRODUCT_IMAGE_BYTES + 1,
      mime: "image/jpeg",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("file_size");
  });

  it("rejects empty files", () => {
    const r = validateProductImageFile({
      fileName: "empty.jpg",
      size: 0,
      mime: "image/jpeg",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("file_empty");
  });

  it("rejects non-image types", () => {
    for (const f of [
      { fileName: "doc.pdf", mime: "application/pdf", size: 1024 },
      { fileName: "clip.mp4", mime: "video/mp4", size: 1024 },
      { fileName: "x.exe", mime: "application/x-msdownload", size: 1024 },
      { fileName: "z.zip", mime: "application/zip", size: 1024 },
    ]) {
      const r = validateProductImageFile(f);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe("file_type");
    }
  });

  it("accepts by extension when mime is missing", () => {
    expect(
      validateProductImageFile({ fileName: "cam.JPG", size: 1024 }).ok
    ).toBe(true);
  });
});

describe("product images - compression", () => {
  it("compresses large JPEGs before upload", () => {
    expect(
      shouldAttemptCompression({
        type: "image/jpeg",
        size: 5 * 1024 * 1024,
        name: "a.jpg",
      })
    ).toBe(true);
  });

  it("skips compression for small images", () => {
    expect(
      shouldAttemptCompression({
        type: "image/jpeg",
        size: 100 * 1024,
        name: "a.jpg",
      })
    ).toBe(false);
  });
});

describe("product images - storage paths", () => {
  it("builds path under products/ folder in product-images bucket", () => {
    const path = buildProductImageStoragePath("photo.webp", 1700000000000);
    expect(path.startsWith("products/")).toBe(true);
    expect(path.endsWith(".webp")).toBe(true);
    expect(path.includes("..")).toBe(false);
  });

  it("falls back to .jpg for unknown extensions", () => {
    const path = buildProductImageStoragePath("weird.xyz", 1700000000000);
    expect(path.endsWith(".jpg")).toBe(true);
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

  it("strips query strings from public URLs", () => {
    expect(
      extractProductImageStoragePaths([
        "https://host/storage/v1/object/public/product-images/products/kept.webp?token=abc",
      ])
    ).toEqual(["products/kept.webp"]);
  });

  it("rejects other buckets and path traversal", () => {
    expect(
      extractProductImageStoragePaths([
        "https://host/storage/v1/object/public/other-bucket/products/private-image.webp",
      ])
    ).toEqual([]);
    expect(
      extractProductImageStoragePaths([
        "https://host/storage/v1/object/public/product-images/products/../secret.webp",
      ])
    ).toEqual([]);
    expect(
      extractProductImageStoragePaths([
        "https://host/storage/v1/object/public/product-images/not-products/x.webp",
      ])
    ).toEqual([]);
  });

  it("recognizes valid product image URLs", () => {
    expect(
      isProductImageUrl(
        "https://host/storage/v1/object/public/product-images/products/ok.webp"
      )
    ).toBe(true);
    expect(isProductImageUrl("https://cdn.example/photo.jpg")).toBe(false);
    expect(isProductImageUrl("product-images/products/ok.webp")).toBe(true);
  });

  it("normalizes image lists before DB write (cap + allowlist)", () => {
    const urls = [
      "https://host/storage/v1/object/public/product-images/products/1.webp",
      "https://evil.example/hack.jpg",
      "https://host/storage/v1/object/public/product-images/products/2.webp",
      "https://host/storage/v1/object/public/product-images/products/3.webp",
      "https://host/storage/v1/object/public/product-images/products/4.webp",
      "https://host/storage/v1/object/public/product-images/products/5.webp",
      "https://host/storage/v1/object/public/product-images/products/6.webp",
    ];
    const normalized = normalizeProductImageUrls(urls);
    expect(normalized).toHaveLength(5);
    expect(normalized.every(isProductImageUrl)).toBe(true);
  });
});

describe("product images - business", () => {
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
