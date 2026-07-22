import React from "react";
import { getOrders } from "@/features/orders/actions/orderActions";
import { resolveSiteVisitInstallationAddress } from "@/features/orders/actions/siteVisitMapper";
import { InstallationDashboardClient } from "./InstallationDashboardClient";
import { filterFloorQueueOrders } from "@/features/orders/workspace/shared/staffQueueStages";

export default async function InstallationOrdersPage() {
  const orders = await getOrders();

  const filteredOrders = filterFloorQueueOrders(orders, "installation");

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
    workflow_type: o.workflow_type,
    scheduledDate: o.installationDetails?.scheduledDate ?? null,
    scheduledTime: o.installationDetails?.scheduledTime ?? null,
    siteAddress: resolveSiteVisitInstallationAddress(o.siteVisitDetails),
  }));

  return (
    <InstallationDashboardClient initialOrders={mappedOrders} entryStage="installation" />
  );
}
