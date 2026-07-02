import React from "react";
import { getOrders } from "@/features/orders/actions/orderActions";
import { ProductionDashboardClient } from "./ProductionDashboardClient";

export default async function ProductionOrdersPage() {
  const orders = await getOrders();

  // Filter orders to only display those that have crossed the design stage
  const productionReadyStages = [
    "Design Approved",
    "Production",
    "Ready For Installation",
    "Installation Scheduled",
    "Completed",
    "Closed"
  ];

  const filteredOrders = (orders || []).filter(o => 
    productionReadyStages.includes(o.stage)
  );

  const mappedOrders = filteredOrders.map(o => ({
    id: o.id,
    projectName: o.project_name,
    customerId: o.customer_id,
    customerName: o.business_name || "",
    stage: o.stage,
    dateCreated: o.date_created,
    orderId: o.order_id || o.id,
    orderCode: o.order_id || o.id
  }));

  return (
    <ProductionDashboardClient initialOrders={mappedOrders} />
  );
}
