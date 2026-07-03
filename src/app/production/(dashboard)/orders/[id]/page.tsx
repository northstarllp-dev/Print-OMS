import React from "react";
import { redirect } from "next/navigation";
import { getOrderById } from "@/features/orders/actions/orderActions";
import { getCustomers } from "@/features/customers/actions/customerActions";
import { getEmployees } from "@/features/employees/actions/employeeActions";
import { getProducts } from "@/features/products/actions/productActions";
import { getQuotationByOrderId, getSiteVisitMeasurementsForOrder } from "@/features/quotations/actions/quotationActions";
import { ProductionOrderDetailClient } from "./ProductionOrderDetailClient";

export default async function ProductionOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const order = await getOrderById(id);
  if (!order) {
    redirect("/production/orders");
  }

  // Ensure order has crossed design stage
  const productionReadyStages = [
    "Design Approved",
    "Production",
    "Ready For Installation",
    "Installation Scheduled",
    "Completed",
    "Closed"
  ];
  if (!productionReadyStages.includes(order.stage)) {
    redirect("/production/orders");
  }

  const [customersData, employeesData, productsData, quotationData, siteVisitItemsData] = await Promise.all([
    getCustomers().catch(() => []),
    getEmployees().catch(() => []),
    getProducts().catch(() => []),
    getQuotationByOrderId(order.id).catch(() => null),
    getSiteVisitMeasurementsForOrder(order.id).catch(() => []),
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
    versionHistory: order.version_history || [],
    chatHistory: order.chat_history || [],
    siteVisitDetails: order.siteVisitDetails,
    design: order.design,
    productionDetails: order.productionDetails,
    installationDetails: order.installationDetails,
    stageStatus: order.stage_status,
    stageAdminNotes: order.stage_admin_notes,
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
    customerCode: c.customer_id || c.id,
    customerId: c.customer_id || c.id
  }));

  const mappedEmployees = (employeesData || []).map((e: any) => ({
    id: e.id,
    name: e.name,
    role: e.staff_role || "",
    phone: e.phone || "",
    email: e.email || "",
    status: e.status || "Active",
    rating: Number(e.rating) || 5.0,
    workload: Number(e.workload) || 0
  }));

  return (
    <ProductionOrderDetailClient
      order={mappedOrder}
      customers={mappedCustomers}
      employees={mappedEmployees}
      products={productsData || []}
      quotation={quotationData}
      siteVisitItems={siteVisitItemsData || []}
    />
  );
}
