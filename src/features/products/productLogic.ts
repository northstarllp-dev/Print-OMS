/** Pure product catalog helpers (unit-tested). */

import type { Product } from "@/features/products/actions/productActions";

export const MAX_PRODUCT_IMAGES = 5;
export const PRODUCT_IMAGE_BUCKET = "product-images";
export const PRODUCT_IMAGE_ACCEPT = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;
export const PRODUCT_IMAGE_REJECT = [
  "application/x-msdownload",
  "application/zip",
  "application/pdf",
  "application/octet-stream",
] as const;

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

/** Next PRD-### — max+1, never reuses deleted gaps (audit-safe). */
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

export function canAddProductImages(
  currentCount: number,
  incomingCount: number
): boolean {
  return currentCount + incomingCount <= MAX_PRODUCT_IMAGES;
}

export function buildProductImageStoragePath(fileName: string, now = Date.now()): string {
  const ext = fileName.split(".").pop() || "jpg";
  return `products/${now}_${Math.random().toString(36).slice(2)}.${ext}`;
}

export function extractProductImageStoragePaths(urls: string[]): string[] {
  return urls
    .map((url) => {
      const parts = url.split(`/${PRODUCT_IMAGE_BUCKET}/`);
      return parts.length > 1 ? parts[1] : null;
    })
    .filter(Boolean) as string[];
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
