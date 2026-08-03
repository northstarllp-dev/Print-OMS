import { Package } from "lucide-react";
import { ComingSoonPage } from "@/features/admin/components/ComingSoonPage";

export const metadata = {
  title: "Inventory | Admin",
};

export default function AdminInventoryPage() {
  return (
    <ComingSoonPage
      title="Inventory"
      description="This section is under development and is not available for use yet. Stock balances, warehouses, and movements will open here once the module is ready."
      icon={Package}
    />
  );
}
