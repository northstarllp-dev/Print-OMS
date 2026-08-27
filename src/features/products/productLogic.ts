/** Pure product catalog helpers (unit-tested). */

import type { Product } from "@/features/products/actions/productActions";

export const MAX_PRODUCT_IMAGES = 5;
/** Catalog images share the same 50 MB image-pipeline ceiling as other stage photos. */
export const MAX_PRODUCT_IMAGE_BYTES = 50 * 1024 * 1024;
export const PRODUCT_IMAGE_BUCKET = "product-images";
/** Public catalog bucket reads use public URLs (not signed). Writes remain admin-gated. */
export const PRODUCT_IMAGE_PIPELINE = "image" as const;
export const PRODUCT_IMAGE_ACCEPT = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;
export const PRODUCT_IMAGE_ACCEPT_EXT = [
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
] as const;
export const PRODUCT_IMAGE_REJECT = [
  "application/x-msdownload",
  "application/zip",
  "application/pdf",
  "application/octet-stream",
] as const;

export type ProductImageValidationOk = { ok: true };
export type ProductImageValidationError = {
  ok: false;
  reason: "file_type" | "file_size" | "file_empty" | "max_count";
  message: string;
};

export type ProductCatalogFilters = {
  search?: string;
  categoryFilter?: string;
  statusFilter?: "All" | "Active" | "Inactive";
  finalFilter?: "All" | "Final" | "Regular";
};

export type ProductFormErrors = Partial<
  Record<"name" | "gst_rate" | "price" | "stock" | "images" | "category", string>
>;

export function productsForTenant(
  existing: Array<Pick<Product, "company_id" | "product_id">>,
  companyId?: string | null
) {
  if (!companyId) return existing;
  return existing.filter((p) => p.company_id === companyId);
}

/** Next PRD-### max+1, never reuses deleted gaps (audit-safe). */
export function generateProductId(
  existing: Array<Pick<Product, "company_id" | "product_id">>,
  companyId?: string | null
): string {
  const scoped = productsForTenant(existing, companyId);
  const maxNum = scoped.reduce((max, p) => {
    const match = p.product_id?.match(/^PRD-(\d+)$/);
    if (match) return Math.max(max, parseInt(match[1], 10));
    return max;
  }, 0);
  return `PRD-${String(maxNum + 1).padStart(3, "0")}`;
}

/** Next FP### for final products. */
export function generateFinalProductId(
  existing: Array<Pick<Product, "company_id" | "product_id">>,
  companyId?: string | null
): string {
  const scoped = productsForTenant(existing, companyId);
  const maxNum = scoped.reduce((max, p) => {
    const match = p.product_id?.match(/^FP(\d+)$/);
    if (match) return Math.max(max, parseInt(match[1], 10));
    return max;
  }, 0);
  return `FP${String(maxNum + 1).padStart(3, "0")}`;
}

export function nextProductIdFromCodes(
  existingIds: string[],
  finalProduct = false
): string {
  const fake = existingIds.map((product_id) => ({ product_id }));
  return finalProduct
    ? generateFinalProductId(fake)
    : generateProductId(fake);
}

/** Business rule: never reuse deleted PRD/FP numbers. */
export function shouldReuseDeletedProductIds(): boolean {
  return false;
}

export function isPricingFieldDisabled(
  key: string,
  pricingType?: string | null
): boolean {
  if (!pricingType || pricingType === "Multiple") return false;
  if (pricingType === "Per Sq.Ft" && key === "price_per_sqft") return false;
  if (pricingType === "Per Unit" && key === "price_per_unit") return false;
  return true;
}

export function mapPricingTypeToDb(
  uiValue?: string | null
): string | null | undefined {
  if (!uiValue) return uiValue;
  if (uiValue === "Per Sq.Ft") return "per_sqft";
  if (uiValue === "Per Unit") return "per_unit";
  return uiValue; // Multiple stays as-is in current code
}

export function mapPricingTypeFromDb(dbValue?: string | null): string {
  if (dbValue === "per_sqft") return "Per Sq.Ft";
  if (dbValue === "per_unit" || dbValue === "per_running_ft") return "Per Unit";
  if (dbValue === "Multiple") return "Multiple";
  return dbValue || "";
}

export function filterProductsCatalog<T extends {
  name?: string | null;
  product_id?: string | null;
  category?: string | null;
  is_active?: boolean;
  final_prdt?: boolean | null;
  barcode?: string | null;
  supplier_name?: string | null;
}>(
  products: T[],
  opts: ProductCatalogFilters & { searchBarcode?: boolean; searchSupplier?: boolean } = {}
): T[] {
  const search = (opts.search || "").trim().toLowerCase();
  const categoryFilter = opts.categoryFilter ?? "All";
  const statusFilter = opts.statusFilter ?? "All";
  const finalFilter = opts.finalFilter ?? "All";

  return products.filter((p) => {
    const matchSearch =
      !search ||
      (p.name || "").toLowerCase().includes(search) ||
      (p.product_id || "").toLowerCase().includes(search) ||
      (p.category || "").toLowerCase().includes(search) ||
      (opts.searchBarcode && (p.barcode || "").toLowerCase().includes(search)) ||
      (opts.searchSupplier &&
        (p.supplier_name || "").toLowerCase().includes(search));

    const matchCategory =
      categoryFilter === "All" || p.category === categoryFilter;
    const matchStatus =
      statusFilter === "All" ||
      (statusFilter === "Active" ? p.is_active === true : p.is_active === false);
    const matchFinal =
      finalFilter === "All" ||
      (finalFilter === "Final" ? p.final_prdt === true : !p.final_prdt);

    return matchSearch && matchCategory && matchStatus && matchFinal;
  });
}

export function computeProductKpis(
  products: Array<{ is_active?: boolean; final_prdt?: boolean | null; track_inventory?: boolean | null }>
) {
  return {
    total: products.length,
    active: products.filter((p) => p.is_active).length,
    inactive: products.filter((p) => !p.is_active).length,
    final: products.filter((p) => p.final_prdt).length,
    inventoryTracked: products.filter((p) => p.track_inventory !== false).length,
  };
}

export function validateProductName(name?: string | null): string | null {
  if (!name?.trim()) return "Product name is required";
  return null;
}

export function validateGstRate(rate?: number | null): string | null {
  if (rate == null || rate === ("" as unknown as number)) return null;
  if (Number.isNaN(Number(rate))) return "Invalid GST rate";
  if (rate < 0 || rate > 100) return "GST must be between 0 and 100";
  return null;
}

export function validateNonNegative(
  value: number | null | undefined,
  label: string
): string | null {
  if (value == null) return null;
  if (Number.isNaN(Number(value)) || value < 0) return `${label} cannot be negative`;
  return null;
}

export function validateCreateProductForm(form: {
  name?: string | null;
  gst_rate?: number | null;
  price_per_sqft?: number | null;
  price_per_unit?: number | null;
  min_stock?: number | null;
  max_stock?: number | null;
  images?: string[] | null;
}): ProductFormErrors {
  const errors: ProductFormErrors = {};
  const nameErr = validateProductName(form.name);
  if (nameErr) errors.name = nameErr;
  const gstErr = validateGstRate(form.gst_rate);
  if (gstErr) errors.gst_rate = gstErr;
  const priceErr =
    validateNonNegative(form.price_per_sqft, "Price") ||
    validateNonNegative(form.price_per_unit, "Price");
  if (priceErr) errors.price = priceErr;
  const stockErr =
    validateNonNegative(form.min_stock, "Min stock") ||
    validateNonNegative(form.max_stock, "Max stock");
  if (stockErr) errors.stock = stockErr;
  if ((form.images?.length || 0) > MAX_PRODUCT_IMAGES) {
    errors.images = `Max ${MAX_PRODUCT_IMAGES} images`;
  }
  return errors;
}

export function isDuplicateProductName(
  name: string,
  existing: Array<{ id?: string; name?: string | null }>,
  excludeId?: string
): boolean {
  const n = name.trim().toLowerCase();
  return existing.some(
    (p) => p.id !== excludeId && (p.name || "").trim().toLowerCase() === n
  );
}

export function isDuplicateProductId(
  productId: string,
  existing: Array<{ id?: string; product_id?: string | null }>,
  excludeId?: string
): boolean {
  return existing.some(
    (p) => p.id !== excludeId && p.product_id === productId
  );
}

export function validateCategoryName(name?: string | null): string | null {
  if (!name?.trim()) return "Category name is required";
  return null;
}

export function canDeleteCategory(
  categoryName: string,
  products: Array<{ category?: string | null }>
): { ok: boolean; reason?: string } {
  const count = products.filter((p) => p.category === categoryName).length;
  if (count > 0) {
    return {
      ok: false,
      reason: `Cannot delete: ${count} product(s) use this category`,
    };
  }
  return { ok: true };
}

export function isAcceptedProductImageMime(mime: string): boolean {
  return (PRODUCT_IMAGE_ACCEPT as readonly string[]).includes(mime);
}

export function isAcceptedProductImageExt(ext: string): boolean {
  return (PRODUCT_IMAGE_ACCEPT_EXT as readonly string[]).includes(ext.toLowerCase());
}

export function canAddProductImages(
  currentCount: number,
  incomingCount: number
): boolean {
  return currentCount + incomingCount <= MAX_PRODUCT_IMAGES;
}

/** How many more images can be added given current count. */
export function remainingProductImageSlots(currentCount: number): number {
  return Math.max(0, MAX_PRODUCT_IMAGES - currentCount);
}

/** Slice a FileList selection down to the remaining slots. */
export function takeProductImageSlots(
  files: File[],
  currentCount: number
): { accepted: File[]; rejectedCount: number } {
  const slots = remainingProductImageSlots(currentCount);
  if (slots <= 0) return { accepted: [], rejectedCount: files.length };
  if (files.length <= slots) return { accepted: files, rejectedCount: 0 };
  return { accepted: files.slice(0, slots), rejectedCount: files.length - slots };
}

export function validateProductImageFile(input: {
  fileName: string;
  size: number;
  mime?: string;
}): ProductImageValidationOk | ProductImageValidationError {
  if (!input.size || input.size <= 0) {
    return { ok: false, reason: "file_empty", message: "File is empty" };
  }
  if (input.size > MAX_PRODUCT_IMAGE_BYTES) {
    return {
      ok: false,
      reason: "file_size",
      message: `File exceeds ${Math.round(MAX_PRODUCT_IMAGE_BYTES / (1024 * 1024))} MB limit`,
    };
  }
  const ext = (input.fileName.split(".").pop() || "").toLowerCase();
  const mimeOk = input.mime ? isAcceptedProductImageMime(input.mime) : false;
  const extOk = isAcceptedProductImageExt(ext);
  if (!mimeOk && !extOk) {
    return {
      ok: false,
      reason: "file_type",
      message: "Only JPEG, PNG, WebP, and GIF images are allowed",
    };
  }
  return { ok: true };
}

export function buildProductImageStoragePath(fileName: string, now = Date.now()): string {
  const rawExt = (fileName.split(".").pop() || "jpg").toLowerCase();
  const ext = isAcceptedProductImageExt(rawExt) ? rawExt : "jpg";
  // Sanitize: no path separators, no traversal.
  return `products/${now}_${Math.random().toString(36).slice(2)}.${ext}`;
}

/** True when a stored URL/ref belongs to the public product-images bucket. */
export function isProductImageUrl(url: string): boolean {
  if (!url) return false;
  if (url.includes(`/object/public/${PRODUCT_IMAGE_BUCKET}/`)) return true;
  // Modern "bucket/path" ref form (if ever stored that way).
  if (url.startsWith(`${PRODUCT_IMAGE_BUCKET}/products/`)) return true;
  return false;
}

/**
 * Extract object keys under product-images/products/… for deletion.
 * Rejects other buckets, path traversal, and non-products prefixes.
 */
export function extractProductImageStoragePaths(urls: string[]): string[] {
  const out: string[] = [];
  for (const url of urls) {
    if (!url) continue;
    let path: string | null = null;

    const publicMarker = `/object/public/${PRODUCT_IMAGE_BUCKET}/`;
    const pubIdx = url.indexOf(publicMarker);
    if (pubIdx !== -1) {
      path = decodeURIComponent(url.slice(pubIdx + publicMarker.length).split("?")[0] || "");
    } else if (url.startsWith(`${PRODUCT_IMAGE_BUCKET}/`)) {
      path = url.slice(PRODUCT_IMAGE_BUCKET.length + 1).split("?")[0];
    }

    if (!path) continue;
    if (path.includes("..") || path.includes("\\") || path.startsWith("/")) continue;
    if (!path.startsWith("products/")) continue;
    out.push(path);
  }
  return out;
}

/** Normalize + validate image URL list before persisting to products.images. */
export function normalizeProductImageUrls(images: unknown): string[] {
  if (!Array.isArray(images)) return [];
  const urls = images
    .filter((u): u is string => typeof u === "string" && u.length > 0)
    .filter(isProductImageUrl);
  return urls.slice(0, MAX_PRODUCT_IMAGES);
}

export function inventoryFieldsVisible(trackInventory?: boolean | null): boolean {
  return trackInventory !== false;
}

export function isInventoryCatalogProduct(p: {
  track_inventory?: boolean | null;
  is_active?: boolean;
}): boolean {
  return p.track_inventory !== false && p.is_active === true;
}

/** Double-submit guard for Add Product button. */
export function isProductSubmitLocked(isPending: boolean): boolean {
  return isPending;
}

export function canAccessAdminProducts(role?: string | null): boolean {
  return role === "admin";
}

export function customerCanAccessProducts(): boolean {
  return false;
}

export function salesCanMutateProducts(): boolean {
  return false;
}

/** Prefer deactivate over hard delete when product may be referenced. */
export function recommendHardDeleteWhenReferenced(): boolean {
  return false;
}

/**
 * Empty / null business_operations = available for every business op.
 * Non-empty = only those op ids.
 */
export function productAppliesToBusinessOp(
  product: { business_operations?: string[] | null },
  opId?: string | null
): boolean {
  const ops = product.business_operations;
  if (!ops || ops.length === 0) return true;
  if (!opId) return true;
  return ops.includes(opId);
}

export function normalizeProductBusinessOperations(
  value: unknown
): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map((v) => v.trim());
}

export function buildCreateProductDefaults(input?: {
  final_prdt?: boolean;
  existing?: Array<Pick<Product, "company_id" | "product_id">>;
  companyId?: string | null;
}): Partial<{
  product_id: string;
  is_active: boolean;
  final_prdt: boolean;
  track_inventory: boolean;
  images: string[];
}> {
  const final = input?.final_prdt ?? false;
  const existing = input?.existing ?? [];
  return {
    product_id: final
      ? generateFinalProductId(existing, input?.companyId)
      : generateProductId(existing, input?.companyId),
    is_active: true,
    final_prdt: final,
    track_inventory: true,
    images: [],
  };
}
