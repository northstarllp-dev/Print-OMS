import { IndianRupee } from "lucide-react";
import { ComingSoonPage } from "@/features/admin/components/ComingSoonPage";

export const metadata = {
  title: "Payments | Admin",
};

export default function AdminPaymentsPage() {
  return (
    <ComingSoonPage
      title="Payments & Collections"
      description="Track outstanding invoices, partial payments, and customer follow-ups from one place."
      icon={IndianRupee}
    />
  );
}
