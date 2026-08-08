import React from "react";
import { redirect } from "next/navigation";
import { getOrderById } from "@/features/orders/actions/orderActions";
import { getCustomers } from "@/features/customers/actions/customerActions";
import { getEmployees } from "@/features/employees/actions/employeeActions";
import { getCurrentUser } from "@/features/auth/actions/authActions";
import { getProducts } from "@/features/products/actions/productActions";
import { getQuotationByOrderId, getSiteVisitMeasurementsForOrder } from "@/features/quotations/actions/quotationActions";
import { OrderDetailPageClient } from "@/app/admin/(dashboard)/orders/[id]/OrderDetailPageClient";

export default async function ProductionOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const profile = await getCurrentUser();
  if (!profile) {
    redirect("/production/login");
  }

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
    clientName: order.client_name,
    businessName: order.business_name || "",
    customerId: order.customer_id,
    stage: order.stage,
    productType: order.product_type,
    requirements: order.requirements,
    assignedEmployees: order.assigned_employees || [],
    dateCreated: order.date_created,
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
    orderId: order.order_id || order.id,
    health: order.health || "Active",
    lost_reason: order.lost_reason,
    workflow_type: (order.workflow_type as "quote_first" | "design_first") || "quote_first",
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

  const currentEmployee = profile.role === "admin" ? null : (mappedEmployees.find((e) => e.id === profile.id) || {
    id: profile.id,
    name: profile.name,
    role: profile.staff_role || "Production",
    phone: profile.phone || "",
    email: profile.email || "",
    status: profile.status || "Active",
    rating: Number(profile.rating) || 5.0,
    workload: Number(profile.workload) || 0
  });

  const mappedProducts = (productsData || []).map((p: any) => ({
    id: p.id,
    product_id: p.product_id,
    name: p.name,
    category: p.category ?? null,
    pricing_type: p.pricing_type,
    is_active: p.is_active,
    price_per_sqft: p.price_per_sqft != null ? Number(p.price_per_sqft) : null,
    price_per_unit: p.price_per_unit != null ? Number(p.price_per_unit) : null,
    unit_price_max_sqft: p.unit_price_max_sqft != null ? Number(p.unit_price_max_sqft) : null,
    pricing_type_below: p.pricing_type_below ?? null,
    pricing_type_above: p.pricing_type_above ?? null,
    images: Array.isArray(p.images) ? p.images : [],
    business_operations: Array.isArray(p.business_operations) ? p.business_operations : [],
  }));

  return (
    <OrderDetailPageClient
      order={mappedOrder}
      customers={mappedCustomers}
      employees={mappedEmployees}
      allOrders={[]}
      role={profile.role === "admin" ? "Admin" : "Employee"}
      currentEmployee={currentEmployee}
      products={mappedProducts}
      initialQuotation={quotationData}
      siteVisitItems={siteVisitItemsData || []}
      entryStage="production"
      backHref="/production/orders"
      companyId={profile?.company_id ?? null}
    />
  );
}
