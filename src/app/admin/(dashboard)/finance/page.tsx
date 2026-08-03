import { Wallet } from "lucide-react";
import { ComingSoonPage } from "@/features/admin/components/ComingSoonPage";

export const metadata = {
  title: "Finance | Admin",
};

export default function AdminFinancePage() {
  return (
    <ComingSoonPage
      title="Finance"
      description="This section is under development and is not available for use yet. Receipts, payments, expenses, and reports will open here once the module is ready."
      icon={Wallet}
    />
  );
}
