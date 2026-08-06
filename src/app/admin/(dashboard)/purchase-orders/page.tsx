import { ShoppingCart } from "lucide-react";
import { ComingSoonPage } from "@/features/admin/components/ComingSoonPage";
import { getCurrentUser } from "@/features/auth/actions/authActions";
import { getWarehouses } from "@/features/inventory/actions/inventoryActions";
import { getProducts } from "@/features/products/actions/productActions";
import {
  getPurchaseOrders,
  getPurchaseRequests,
  getVendors,
} from "@/features/purchases/actions/purchaseActions";
import { PurchasesDashboard } from "@/features/purchases/components/PurchasesDashboard";

export const metadata = {
  title: "Purchase Orders | Admin",
};

export default async function AdminPurchaseOrdersPage() {
  const profile = await getCurrentUser();
  const [purchaseOrders, requests, vendors, productsRaw, warehousesRaw] =
    await Promise.all([
      getPurchaseOrders().catch(() => []),
      getPurchaseRequests().catch(() => []),
      getVendors().catch(() => []),
      getProducts().catch(() => []),
      getWarehouses().catch(() => []),
    ]);

  const products = (productsRaw || []).map((p: any) => ({
    id: p.id,
    product_id: p.product_id ?? p.id,
    name: p.name,
    unit: p.unit ?? null,
    purchase_price: p.purchase_price != null ? Number(p.purchase_price) : null,
    gst_rate: p.gst_rate != null ? Number(p.gst_rate) : null,
  }));

  const warehouses = (warehousesRaw || []).map((w: any) => ({
    id: w.id,
    name: w.name,
  }));

  return (
    <ComingSoonPage
      title="Purchase Orders"
      description="This section is under development and is not available for use yet. Vendors, purchase requests, and goods receipts will open here once the module is ready."
      icon={ShoppingCart}
    >
      <PurchasesDashboard
        purchaseOrders={purchaseOrders}
        requests={requests}
        vendors={vendors}
        products={products}
        warehouses={warehouses}
        isAdmin={profile?.role === "admin"}
      />
    </ComingSoonPage>
  );
}
