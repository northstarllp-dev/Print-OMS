import { getOrders } from "@/features/orders/actions/orderActions";
import { InstallationDashboardClient } from "@/app/installation/(dashboard)/orders/InstallationDashboardClient";

export default async function StaffInstallationPage() {
  const orders = await getOrders();

  const installationStages = [
    "Ready For Installation",
    "Installation Scheduled",
    "Completed",
    "Closed",
  ];

  const filteredOrders = (orders || []).filter((o) =>
    installationStages.includes(o.stage)
  );

  const mappedOrders = filteredOrders.map((o) => ({
    id: o.id,
    projectName: o.project_name,
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
