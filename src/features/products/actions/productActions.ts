"use server";

import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { assertAdminOnly } from "@/features/orders/workspace/shared/serverPermissions";
import {
  extractProductImageStoragePaths,
  generateFinalProductId,
  generateProductId,
  MAX_PRODUCT_IMAGES,
  normalizeProductImageUrls,
  PRODUCT_IMAGE_BUCKET,
} from "../productLogic";

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}

function assertValidImagePayload(images: unknown): string[] {
  const normalized = normalizeProductImageUrls(images);
  if (Array.isArray(images) && images.length > MAX_PRODUCT_IMAGES) {
    throw new Error(`Max ${MAX_PRODUCT_IMAGES} product images allowed`);
  }
  // Reject payloads that smuggle non-catalog URLs.
  if (Array.isArray(images) && images.length > 0 && normalized.length !== images.filter((u) => typeof u === "string" && u.length > 0).length) {
    throw new Error("Invalid product image URL");
  }
  return normalized;
}

export type Product = {
  id: string;
  product_id: string;
  company_id?: string;
  name: string;
  description?: string | null;
  category?: string | null;
  pricing_type?: string | null;
  // New pricing fields
  price_per_sqft?: number | null;
  price_per_unit?: number | null;
  /** ≤ this sqft → below band; above → above band (Multiple). */
  unit_price_max_sqft?: number | null;
  /** Multiple: billing type ≤ threshold (per_unit | per_sqft). Amount in price_per_unit. */
  pricing_type_below?: string | null;
  /** Multiple: billing type > threshold (per_unit | per_sqft). Amount in price_per_sqft. */
  pricing_type_above?: string | null;
  images?: string[];
  is_active: boolean;
  final_prdt?: boolean;
  created_at?: string;
  // Inventory attributes
  unit?: string | null;
  brand?: string | null;
  supplier_name?: string | null;
  purchase_price?: number | null;
  min_stock?: number | null;
  max_stock?: number | null;
  hsn_code?: string | null;
  gst_rate?: number | null;
  barcode?: string | null;
  qr_code?: string | null;
  default_warehouse_id?: string | null;
  track_inventory?: boolean;
  /**
   * Business operation ids this product is available for.
   * Empty / null = all operations.
   */
  business_operations?: string[] | null;
};

export type CreateProductPayload = {
  product_id: string;
  name: string;
  description?: string;
  category?: string;
  pricing_type?: string | null;
  // New
  price_per_sqft?: number | null;
  price_per_unit?: number | null;
  unit_price_max_sqft?: number | null;
  pricing_type_below?: string | null;
  pricing_type_above?: string | null;
  images?: string[];
  is_active?: boolean;
  final_prdt?: boolean;
  // Inventory attributes
  unit?: string | null;
  brand?: string | null;
  supplier_name?: string | null;
  purchase_price?: number | null;
  min_stock?: number | null;
  max_stock?: number | null;
  hsn_code?: string | null;
  gst_rate?: number | null;
  barcode?: string | null;
  qr_code?: string | null;
  default_warehouse_id?: string | null;
  track_inventory?: boolean;
  business_operations?: string[] | null;
};

export async function getProducts(): Promise<Product[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []).map((p: any) => ({
    ...p,
    images: Array.isArray(p.images) ? p.images : [],
  }));
}

export async function getActiveProducts(): Promise<Product[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []).map((p: any) => ({
    ...p,
    images: Array.isArray(p.images) ? p.images : [],
  }));
}

export async function createProduct(formData: CreateProductPayload) {
  await assertAdminOnly();
  const supabase = await getSupabase();
  const { resolveWriteCompanyId } = await import("@/lib/resolveWriteCompanyId");
  const companyId = await resolveWriteCompanyId();
  const images = assertValidImagePayload(formData.images);
  const payload = {
    company_id: companyId,
    is_active: true,
    ...formData,
    images,
  };
  let { data, error } = await supabase
    .from("products")
    .insert([payload])
    .select();

  // Retry if product_id collides within this tenant
  if (
    error &&
    error.code === "23505" &&
    (error.message.includes("products_product_id_key") ||
      error.message.includes("products_company_product_id_key") ||
      error.message.includes("idx_products_product_id"))
  ) {
    const { data: existing } = await supabase
      .from("products")
      .select("product_id")
      .eq("company_id", companyId);
    if (payload.final_prdt) {
      payload.product_id = generateFinalProductId(existing || [], companyId);
    } else {
      payload.product_id = generateProductId(existing || [], companyId);
    }
    
    const retry = await supabase.from("products").insert([payload]).select();
    data = retry.data;
    error = retry.error;
  }

  if (error) throw new Error(error.message);
  revalidatePath("/admin/products");
  return data;
}

export async function updateProduct(
  id: string,
  updates: Partial<CreateProductPayload>
) {
  await assertAdminOnly();
  const supabase = await getSupabase();
  const payload: Partial<CreateProductPayload> = { ...updates };
  if (updates.images !== undefined) {
    payload.images = assertValidImagePayload(updates.images);
  }
  const { data, error } = await supabase
    .from("products")
    .update(payload)
    .eq("id", id)
    .select();
  if (error) throw new Error(error.message);
  revalidatePath("/admin/products");
  return data;
}

export async function deleteProduct(id: string) {
  await assertAdminOnly();
  const supabase = await getSupabase();
  
  // Fetch product first to get the images
  const { data: product } = await supabase
    .from("products")
    .select("images")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw new Error(error.message);
  
  // If deletion succeeded, wipe the images from storage (best-effort)
  if (product && Array.isArray(product.images) && product.images.length > 0) {
    await deleteImagesFromStorage(product.images).catch((err) => {
      console.error("Product image cleanup failed after delete:", err);
    });
  }

  revalidatePath("/admin/products");
}

/**
 * Securely deletes product catalog images from the public product-images bucket.
 * Admin-only; paths are validated to products/… under product-images only.
 */
export async function deleteImagesFromStorage(urls: string[]) {
  if (!urls || urls.length === 0) return;
  await assertAdminOnly();

  const paths = extractProductImageStoragePaths(urls);
  if (paths.length === 0) return;

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    // Fallback to user-scoped client when service role is unavailable locally.
    const supabase = await getSupabase();
    const { error } = await supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove(paths);
    if (error) throw new Error(error.message);
    return;
  }

  const adminSupabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey
  );
  const { error } = await adminSupabase.storage.from(PRODUCT_IMAGE_BUCKET).remove(paths);
  if (error) {
    console.error(`Failed to delete product images:`, error);
    throw new Error(error.message);
  }
}

export type ProductCategory = {
  id: string;
  company_id?: string;
  name: string;
  created_at?: string;
};

export async function getProductCategories(): Promise<ProductCategory[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("product_categories")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function createProductCategory(name: string): Promise<ProductCategory> {
  if (!name || !name.trim()) throw new Error("Category name is required.");
  
  const supabase = await getSupabase();
  const { resolveWriteCompanyId } = await import("@/lib/resolveWriteCompanyId");
  const companyId = await resolveWriteCompanyId();
  const payload = {
    company_id: companyId,
    name: name.trim(),
  };
  const { data, error } = await supabase
    .from("product_categories")
    .insert([payload])
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("Category already exists.");
    }
    throw new Error(error.message);
  }

  revalidatePath("/admin/products");
  return data;
}

export async function deleteProductCategory(id: string): Promise<void> {
  const supabase = await getSupabase();
  
  // 1. Fetch the category name
  const { data: catData, error: catError } = await supabase
    .from("product_categories")
    .select("name")
    .eq("id", id)
    .single();
    
  if (catError) throw new Error("Category not found.");
  
  // 2. Check if any products are using this category
  const { count, error: countError } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("category", catData.name);
    
  if (countError) throw new Error(countError.message);
  
  if (count && count > 0) {
    throw new Error(`Cannot delete this category because it is currently used by ${count} product(s). Please reassign them first.`);
  }

  // 3. Delete the category
  const { error } = await supabase
    .from("product_categories")
    .delete()
    .eq("id", id);
    
  if (error) throw new Error(error.message);
  revalidatePath("/admin/products");
}
