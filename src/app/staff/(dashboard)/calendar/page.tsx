import React from "react";
import { redirect } from "next/navigation";
import { EmployeeCalendarView } from "@/features/employees/components/EmployeeCalendarView";
import { getOrders } from "@/features/orders/actions/orderActions";
import { getCustomers } from "@/features/customers/actions/customerActions";
import { getCurrentUser } from "@/features/auth/actions/authActions";

export default async function StaffCalendarPage() {
  const profile = await getCurrentUser();

  const ordersData = await getOrders();
  const customersData = await getCustomers();

  const mappedEmployee = {
    id: profile.id,
    name: profile.name,
    role: profile.staff_role || "Field Agent",
    phone: profile.phone || "",
    email: profile.email || "",
    status: profile.status || "Active",
    rating: Number(profile.rating) || 5.0,
    workload: Number(profile.workload) || 0
  };

  const mappedOrders = ordersData?.map(o => ({
    id: o.id,
    clientName: o.client_name,
    businessName: o.business_name || "",
    customerId: o.customer_id,
    stage: o.stage,
    productType: o.product_type,
    requirements: o.requirements,
    assignedEmployees: o.assigned_employees || [],
    dateCreated: o.date_created,
    customerName: o.business_name || "",
        versionHistory: o.version_history || [],
    chatHistory: o.chat_history || [],
    orderCode: o.order_id || o.id,
    orderId: o.order_id || o.id
  })) || [];

  const mappedCustomers = customersData?.map(c => ({
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
  })) || [];

  return (
    <EmployeeCalendarView 
      orders={mappedOrders} 
      customers={mappedCustomers} 
      currentEmployee={mappedEmployee} 
    />
  );
}
