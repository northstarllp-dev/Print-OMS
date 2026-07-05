import { getOrders } from "@/features/orders/actions/orderActions";
import { getUserSession } from "@/features/auth/actions/authActions";
import { ProductionDashboardClient } from "@/app/production/(dashboard)/orders/ProductionDashboardClient";

export default async function StaffProductionPage() {
  const orders = await getOrders();
  const user = await getUserSession();

  const productionReadyStages = [
    "Design Approved",
    "Production",
    "Ready For Installation",
    "Installation Scheduled",
    "Completed",
    "Closed",
  ];

  // Stage + assignment: orders in production stages AND assigned to this staff member
  const filteredOrders = (orders || []).filter(
    (o) =>
      o.assigned_employees?.includes(user?.id) &&
      productionReadyStages.includes(o.stage)
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
    <ProductionDashboardClient
      initialOrders={mappedOrders}
      orderDetailBasePath="/staff/orders"
      entryStage="production"
    />
  );
}
