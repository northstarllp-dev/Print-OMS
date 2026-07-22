import React from "react";
import { redirect } from "next/navigation";
import { EmployeeCalendarView } from "@/features/employees/components/EmployeeCalendarView";
import { getOrders } from "@/features/orders/actions/orderActions";
import { getCustomers } from "@/features/customers/actions/customerActions";
import { getCurrentUser } from "@/features/auth/actions/authActions";
import { getEmployees } from "@/features/employees/actions/employeeActions";

export default async function StaffCalendarPage() {
  const profile = await getCurrentUser();
  if (!profile || (profile.role !== "staff" && profile.role !== "admin")) {
    redirect("/staff/login");
  }

  const [ordersData, customersData, employeesData] = await Promise.all([
    getOrders(),
    getCustomers(),
    getEmployees(),
  ]);

  const mappedEmployee = {
    id: profile.id,
    name: profile.name,
    role: profile.staff_role || "Field Agent",
  };

  const mappedOrders =
    ordersData?.map((o) => ({
      id: o.id,
      clientName: o.client_name,
      businessName: o.business_name || "",
      customerId: o.customer_id,
      stage: o.stage,
      assignedEmployees: o.assigned_employees || [],
      orderCode: o.order_id || o.id,
      orderId: o.order_id || o.id,
      siteVisitDetails: o.siteVisitDetails || null,
      installationDetails: o.installationDetails || null,
      productionDetails: o.productionDetails || null,
    })) || [];

  const mappedCustomers =
    customersData?.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone || "",
      shippingAddress: c.shipping_address || "",
    })) || [];

  const mappedEmployees =
    employeesData?.map((e) => ({
      id: e.id,
      name: e.name,
    })) || [];

  return (
    <EmployeeCalendarView
      orders={mappedOrders}
      customers={mappedCustomers}
      currentEmployee={mappedEmployee}
      employees={mappedEmployees}
    />
  );
}
