import { Package } from "lucide-react";
import { ComingSoonPage } from "@/features/admin/components/ComingSoonPage";
import { getCurrentUser } from "@/features/auth/actions/authActions";
import {
  getInventoryOverview,
  getStockLedger,
  getWarehouses,
} from "@/features/inventory/actions/inventoryActions";
import { InventoryDashboard } from "@/features/inventory/components/InventoryDashboard";

export const metadata = {
  title: "Inventory | Admin",
};

export default async function AdminInventoryPage() {
  const profile = await getCurrentUser();
  const [stock, ledger, warehouses] = await Promise.all([
    getInventoryOverview().catch(() => []),
    getStockLedger().catch(() => []),
    getWarehouses().catch(() => []),
  ]);

  return (
    <ComingSoonPage
      title="Inventory"
      description="This section is under development and is not available for use yet. Stock balances, warehouses, and movements will open here once the module is ready."
      icon={Package}
    >
      <InventoryDashboard
        stock={stock}
        ledger={ledger}
        warehouses={warehouses}
        isAdmin={profile?.role === "admin"}
      />
    </ComingSoonPage>
  );
}
