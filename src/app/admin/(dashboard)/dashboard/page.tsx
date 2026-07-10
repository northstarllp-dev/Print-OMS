import { getOrders } from "@/features/orders/actions/orderActions";
import { getEnquiries } from "@/features/enquiries/actions/enquiryActions";
import { getServiceTickets } from "@/features/service-tickets/actions/serviceTicketActions";
import { AdminDashboardClient } from "@/features/orders/components/AdminDashboardClient";

export default async function AdminDashboardPage() {
  const [ordersData, enquiriesData, ticketsData] = await Promise.all([
    getOrders().catch(() => []),
    getEnquiries().catch(() => []),
    getServiceTickets().catch(() => []),
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
    business_name: e.business_name,
    lead_name: e.lead_name,
    phone: e.phone,
    enquire_id: e.enquire_id,
  }));

  const tickets = (ticketsData || []).filter((t: any) => t.status !== "closed");

  return <AdminDashboardClient orders={orders} enquiries={enquiries} tickets={tickets} />;
}
