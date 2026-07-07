import { getOrders } from "@/features/orders/actions/orderActions";
import { getEnquiries } from "@/features/enquiries/actions/enquiryActions";
import { AdminDashboardClient } from "@/features/orders/components/AdminDashboardClient";

export default async function AdminDashboardPage() {
  const [ordersData, enquiriesData] = await Promise.all([
    getOrders().catch(() => []),
    getEnquiries().catch(() => []),
  ]);

  const orders = (ordersData || []).map((o: any) => ({
    id: o.id,
    clientName: o.client_name,
    businessName: o.business_name || "",
    customerId: o.customer_id,
    customerName: o.business_name || "",
    stage: o.stage,
    health: o.health || "Active",
    dateCreated: o.date_created,
    orderCode: o.order_id || o.id,
    orderId: o.order_id || o.id,
    quotations: o.quotations,
    payments: o.payments
  }));

  const enquiries = (enquiriesData || []).map((e: any) => ({
    id: e.id,
    source: e.source,
    status: e.status,
  }));

  return <AdminDashboardClient orders={orders} enquiries={enquiries} />;
}
