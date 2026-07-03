import React from "react";
import { redirect } from "next/navigation";
import { getOrderById } from "@/features/orders/actions/orderActions";
import { getCustomers } from "@/features/customers/actions/customerActions";
import { getInstallationByOrderId } from "@/features/installations/actions/installationActions";
import { InstallationOrderDetailClient } from "./InstallationOrderDetailClient";

export default async function InstallationOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const order = await getOrderById(id);
  if (!order) {
    redirect("/installation/orders");
  }

  // Ensure order is in installation stages
  const installationStages = [
    "Ready For Installation",
    "Installation Scheduled",
    "Completed",
    "Closed"
  ];
  if (!installationStages.includes(order.stage)) {
    redirect("/installation/orders");
  }

  const [customersData, installationData] = await Promise.all([
    getCustomers().catch(() => []),
    getInstallationByOrderId(order.id).catch(() => null),
  ]);

  const mappedOrder = {
    id: order.id,
    projectName: order.project_name,
    customerId: order.customer_id,
    stage: order.stage,
    budget: order.budget,
    depositPaid: order.deposit_paid,
    dimensions: order.dimensions,
    notes: order.notes,
    assignedEmployees: order.assigned_employees || [],
    dateCreated: order.date_created,
    imageMockup: order.image_mockup,
    siteVisitDetails: order.siteVisitDetails,
    design: order.design,
    customerName: order.business_name || "",
    orderCode: order.order_id || order.id,
    orderId: order.order_id || order.id
  };

  const mappedCustomers = (customersData || []).map((c: any) => ({
    id: c.id,
    name: c.name,
    phone: c.phone || "",
    whatsapp: c.whatsapp || "",
    email: c.email || "",
    billingAddress: c.billing_address || "",
    shippingAddress: c.shipping_address || "",
    status: c.status || "Active",
  }));

  return (
    <InstallationOrderDetailClient
      order={mappedOrder}
      customers={mappedCustomers}
      installation={installationData}
    />
  );
}
