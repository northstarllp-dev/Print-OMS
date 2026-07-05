"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

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
  images?: string[];
  is_active: boolean;
  final_prdt?: boolean;
  created_at?: string;
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
  images?: string[];
  is_active?: boolean;
  final_prdt?: boolean;
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
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  let companyId = "11111111-1111-1111-1111-111111111111"; // default fallback
  if (user) {
    const { data: profile } = await supabase.from("users").select("company_id").eq("id", user.id).single();
    if (profile && profile.company_id) {
      companyId = profile.company_id;
    }
  }
  const payload = {
    company_id: companyId,
    is_active: true,
    ...formData,
    images: formData.images ?? [],
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
      error.message.includes("products_company_product_id_key"))
  ) {
    const { data: existing } = await supabase
      .from("products")
      .select("product_id")
      .eq("company_id", companyId);
    if (payload.final_prdt) {
      const maxNum = (existing || []).reduce((max, p) => {
        const match = p.product_id?.match(/^FP(\d+)$/);
        if (match) return Math.max(max, parseInt(match[1], 10));
        return max;
      }, 0);
      payload.product_id = `FP${String(maxNum + 1).padStart(3, "0")}`;
    } else {
      const maxNum = (existing || []).reduce((max, p) => {
        const match = p.product_id?.match(/^PRD-(\d+)$/);
        if (match) return Math.max(max, parseInt(match[1], 10));
        return max;
      }, 0);
      payload.product_id = `PRD-${String(maxNum + 1).padStart(3, "0")}`;
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
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("products")
    .update(updates)
    .eq("id", id)
    .select();
  if (error) throw new Error(error.message);
  revalidatePath("/admin/products");
  return data;
}

export async function deleteProduct(id: string) {
  const supabase = await getSupabase();
  
  // Fetch product first to get the images
  const { data: product } = await supabase
    .from("products")
    .select("images")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw new Error(error.message);
  
  // If deletion succeeded, wipe the images from storage
  if (product && Array.isArray(product.images) && product.images.length > 0) {
    await deleteImagesFromStorage(product.images);
  }

  revalidatePath("/admin/products");
}

export async function deleteImagesFromStorage(urls: string[]) {
  if (!urls || urls.length === 0) return;
  const supabase = await getSupabase();
  
  const paths = urls.map(url => {
    // Extract path after /product-images/
    const parts = url.split("/product-images/");
    return parts.length > 1 ? parts[1] : null;
  }).filter(Boolean) as string[];

  if (paths.length > 0) {
    await supabase.storage.from("product-images").remove(paths);
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
  const { data: { user } } = await supabase.auth.getUser();
  let companyId = "11111111-1111-1111-1111-111111111111"; // default fallback
  if (user) {
    const { data: profile } = await supabase.from("users").select("company_id").eq("id", user.id).single();
    if (profile && profile.company_id) {
      companyId = profile.company_id;
    }
  }
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
