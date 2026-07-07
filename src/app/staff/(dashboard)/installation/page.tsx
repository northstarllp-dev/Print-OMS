import { getOrders } from "@/features/orders/actions/orderActions";
import { getUserSession } from "@/features/auth/actions/authActions";
import { InstallationDashboardClient } from "@/app/installation/(dashboard)/orders/InstallationDashboardClient";

export default async function StaffInstallationPage() {
  const orders = await getOrders();
  const user = await getUserSession();

  const installationStages = [
    "Ready For Installation",
    "Installation Scheduled",
    "Completed",
    "Closed",
  ];

  // Stage + assignment: orders in installation stages AND assigned to this staff member
  const filteredOrders = (orders || []).filter(
    (o) =>
      o.assigned_employees?.includes(user?.id) &&
      installationStages.includes(o.stage)
  );

  const mappedOrders = filteredOrders.map((o) => ({
    id: o.id,
    clientName: o.client_name,
    businessName: o.business_name || "",
    customerId: o.customer_id,
    customerName: o.business_name || "",
    stage: o.stage,
    dateCreated: o.date_created,
    orderId: o.order_id || o.id,
    orderCode: o.order_id || o.id,
  }));

  return (
    <InstallationDashboardClient
      initialOrders={mappedOrders}
      orderDetailBasePath="/staff/orders"
      entryStage="installation"
    />
  );
}
