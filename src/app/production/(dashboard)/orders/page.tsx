import React from "react";
import { getOrders } from "@/features/orders/actions/orderActions";
import { ProductionDashboardClient } from "./ProductionDashboardClient";
import { filterFloorQueueOrders } from "@/features/orders/workspace/shared/staffQueueStages";

export default async function ProductionOrdersPage() {
  const orders = await getOrders();

  const filteredOrders = filterFloorQueueOrders(orders, "production");

  const mappedOrders = filteredOrders.map(o => ({
    id: o.id,
    clientName: o.client_name,
    businessName: o.business_name || "",
    customerId: o.customer_id,
    customerName: o.business_name || "",
    stage: o.stage,
    dateCreated: o.date_created,
    orderId: o.order_id || o.id,
    orderCode: o.order_id || o.id,
    productionDeadline:
      o.productionDetails?.installation_deadline ||
      o.productionDetails?.deadline ||
      null,
    workflow_type: o.workflow_type,
  }));

  return (
    <ProductionDashboardClient initialOrders={mappedOrders} entryStage="production" />
  );
}
