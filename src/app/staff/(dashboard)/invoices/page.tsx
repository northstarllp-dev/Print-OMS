import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/actions/authActions";
import { resolveStagePermission } from "@/features/orders/workspace/shared/permissions";
import { listInvoices } from "@/features/invoices/actions/invoiceActions";
import { InvoiceListClient } from "@/features/invoices/components/InvoiceListClient";

export const metadata = {
  title: "Invoices | Staff",
};

export default async function StaffInvoicesPage() {
  const profile = await getCurrentUser();
  if (!profile) redirect("/staff/login");

  const perm = resolveStagePermission("invoice", {
    role: profile.role,
    staff_role: profile.staff_role ?? null,
    company_id: profile.company_id ?? null,
  });
  if (!perm.canView && !perm.canEdit) {
    redirect("/staff/my-orders");
  }

  const invoices = await listInvoices();

  return (
    <div className="flex-1 bg-slate-50 min-h-screen">
      <InvoiceListClient
        invoices={invoices}
        basePath="/staff/invoices"
        orderBasePath="/staff/orders"
      />
    </div>
  );
}
