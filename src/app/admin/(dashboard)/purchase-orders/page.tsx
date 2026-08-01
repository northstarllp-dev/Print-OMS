import { ShoppingCart } from "lucide-react";
import { ComingSoonPage } from "@/features/admin/components/ComingSoonPage";

export const metadata = {
  title: "Purchase Orders | Admin",
};

export default function AdminPurchaseOrdersPage() {
  return (
    <ComingSoonPage
      title="Purchase Orders"
      description="This section is under development and is not available for use yet. Vendors, purchase requests, and goods receipts will open here once the module is ready."
      icon={ShoppingCart}
    />
  );
}
