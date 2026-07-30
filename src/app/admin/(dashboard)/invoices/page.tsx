import { listInvoices } from "@/features/invoices/actions/invoiceActions";
import { InvoiceListClient } from "@/features/invoices/components/InvoiceListClient";

export const metadata = {
  title: "Invoices | Admin",
};

export default async function AdminInvoicesPage() {
  const invoices = await listInvoices();

  return (
    <div className="flex-1 bg-slate-50 min-h-screen">
      <InvoiceListClient
        invoices={invoices}
        basePath="/admin/invoices"
        orderBasePath="/admin/orders"
      />
    </div>
  );
}
