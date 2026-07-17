import { getProducts, getProductCategories } from "@/features/products/actions/productActions";
import { ProductsView } from "@/features/products/components/ProductsView";
import { getAppSettings } from "@/features/settings/actions/settingsActions";

export default async function ProductsPage() {
  const [productsData, categoriesData, appSettings] = await Promise.all([
    getProducts().catch(() => []),
    getProductCategories().catch(() => []),
    getAppSettings().catch(() => null),
  ]);

  const products = (productsData || []).map((p: any) => ({
    id: p.id,
    product_id: p.product_id ?? null,
    name: p.name,
    description: p.description ?? null,
    category: p.category ?? null,
    pricing_type: p.pricing_type ?? null,
    is_active: p.is_active ?? true,
    created_at: p.created_at ?? null,
    price_per_sqft: p.price_per_sqft != null ? Number(p.price_per_sqft) : null,
    price_per_unit: p.price_per_unit != null ? Number(p.price_per_unit) : null,
    images: Array.isArray(p.images) ? p.images : [],
    final_prdt: p.final_prdt ?? false,
  }));

  const mappedCategories = (categoriesData || []).map((c: any) => ({
    id: c.id,
    company_id: c.company_id ?? null,
    name: c.name,
    created_at: c.created_at ?? null,
  }));

  return (
    <ProductsView
      initialProducts={products}
      initialCategories={mappedCategories}
      enableFinalProduct={appSettings?.enableFinalProduct ?? false}
    />
  );
}
