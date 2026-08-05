import { getProducts, getProductCategories } from "@/features/products/actions/productActions";
import { ProductsView } from "@/features/products/components/ProductsView";

export default async function ProductsPage() {
  const [productsData, categoriesData] = await Promise.all([
    getProducts().catch(() => []),
    getProductCategories().catch(() => []),
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
    unit_price_max_sqft: p.unit_price_max_sqft != null ? Number(p.unit_price_max_sqft) : null,
    pricing_type_below: p.pricing_type_below ?? null,
    pricing_type_above: p.pricing_type_above ?? null,
    images: Array.isArray(p.images) ? p.images : [],
    final_prdt: p.final_prdt ?? false,
    unit: p.unit ?? null,
    brand: p.brand ?? null,
    supplier_name: p.supplier_name ?? null,
    purchase_price: p.purchase_price != null ? Number(p.purchase_price) : null,
    min_stock: p.min_stock != null ? Number(p.min_stock) : null,
    max_stock: p.max_stock != null ? Number(p.max_stock) : null,
    hsn_code: p.hsn_code ?? null,
    gst_rate: p.gst_rate != null ? Number(p.gst_rate) : null,
    barcode: p.barcode ?? null,
    qr_code: p.qr_code ?? null,
    default_warehouse_id: p.default_warehouse_id ?? null,
    track_inventory: p.track_inventory ?? true,
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
    />
  );
}
