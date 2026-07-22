import { getCompanyCollectionsData } from "@/features/payments/actions/paymentActions";
import { PaymentsCollectionsClient } from "@/features/payments/components/PaymentsCollectionsClient";

export const metadata = {
  title: "Payments | Admin",
};

export default async function AdminPaymentsPage() {
  const data = await getCompanyCollectionsData();

  return (
    <div className="flex-1 bg-slate-50 min-h-screen">
      <PaymentsCollectionsClient data={data} />
    </div>
  );
}
