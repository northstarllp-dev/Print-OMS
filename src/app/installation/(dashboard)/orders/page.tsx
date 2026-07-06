import React from "react";
import { getOrders } from "@/features/orders/actions/orderActions";
import { InstallationDashboardClient } from "./InstallationDashboardClient";

export default async function InstallationOrdersPage() {
  const orders = await getOrders();

  // Filter orders to only display those that are ready for or in installation
  const installationStages = [
    "Ready For Installation",
    "Installation Scheduled",
    "Completed",
    "Closed"
  ];

  const filteredOrders = (orders || []).filter(o => 
    installationStages.includes(o.stage)
  );

  const mappedOrders = filteredOrders.map(o => ({
    id: o.id,
    clientName: o.client_name,
    businessName: o.business_name || "",
    customerId: o.customer_id,
    customerName: o.business_name || "",
    stage: o.stage,
    dateCreated: o.date_created,
    orderId: o.order_id || o.id,
    orderCode: o.order_id || o.id
  }));

  return (
    <InstallationDashboardClient initialOrders={mappedOrders} />
  );
}
