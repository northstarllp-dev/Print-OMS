import React from "react";
import { redirect } from "next/navigation";
import { getOrderById, getOrders } from "@/features/orders/actions/orderActions";
import { getCustomers } from "@/features/customers/actions/customerActions";
import { getEmployees } from "@/features/employees/actions/employeeActions";
import { getCurrentUser } from "@/features/auth/actions/authActions";
import { getProducts } from "@/features/products/actions/productActions";
import { getQuotationByOrderId, getSiteVisitMeasurementsForOrder } from "@/features/quotations/actions/quotationActions";
import { OrderDetailPageClient } from "./OrderDetailPageClient";

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const profile = await getCurrentUser();

  const order = await getOrderById(id);
  if (!order) {
    redirect("/admin/orders");
  }

  const [customersData, employeesData, allOrdersData, productsData, quotationData, siteVisitItemsData] = await Promise.all([
    getCustomers(),
    getEmployees(),
    getOrders(),
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

  const mappedCustomers = customersData?.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone || "",
    whatsapp: c.whatsapp || "",
    email: c.email || "",
    billingAddress: c.billing_address || "",
    shippingAddress: c.shipping_address || "",
    status: c.status || "Active",
    customerCode: c.customer_id || c.id,
    customerId: c.customer_id || c.id,
  })) || [];

  const mappedEmployees = employeesData
    ?.filter((e) => e.staff_role !== "Production")
    ?.map((e) => ({
      id: e.id,
      name: e.name,
      role: e.staff_role || "",
      phone: e.phone || "",
      email: e.email || "",
      status: e.status || "Active",
      rating: Number(e.rating) || 5.0,
      workload: Number(e.workload) || 0,
    })) || [];

  // All orders for the left panel sidebar
  const mappedAllOrders = (allOrdersData || []).map((o) => ({
    id: o.id,
    clientName: o.client_name,
    businessName: o.business_name || "",
    customerId: o.customer_id,
    customerName: o.business_name || "",
    stage: o.stage,
    health: o.health || "Active",
    dateCreated: o.date_created,
    orderCode: o.order_id || o.id,
    orderId: o.order_id || o.id,
    assignedEmployees: o.assigned_employees || [],
  }));

  const mappedProducts = (productsData || []).map((p: any) => ({
    id: p.id,
    product_id: p.product_id,
    name: p.name,
    category: p.category ?? null,
    pricing_type: p.pricing_type,
    is_active: p.is_active,
    price_per_sqft: p.price_per_sqft != null ? Number(p.price_per_sqft) : null,
    price_per_unit: p.price_per_unit != null ? Number(p.price_per_unit) : null,
    images: Array.isArray(p.images) ? p.images : [],
  }));

  return (
    <OrderDetailPageClient
      order={mappedOrder}
      customers={mappedCustomers}
      employees={mappedEmployees}
      allOrders={mappedAllOrders}
      role="Admin"
      currentEmployee={null}
      products={mappedProducts}
      initialQuotation={quotationData}
      siteVisitItems={siteVisitItemsData || []}
      companyId={profile?.company_id ?? null}
      openPaymentsTab={tab === "payments"}
    />
  );
}
