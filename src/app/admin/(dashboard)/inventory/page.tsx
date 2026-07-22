import { Boxes } from "lucide-react";
import { ComingSoonPage } from "@/features/admin/components/ComingSoonPage";

export const metadata = {
  title: "Inventory | Admin",
};

export default function AdminInventoryPage() {
  return (
    <ComingSoonPage
      title="Inventory & Vendors"
      description="Manage materials, stock levels, and supplier status tied to production jobs."
      icon={Boxes}
    />
  );
}
