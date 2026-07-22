import { getOrders } from "@/features/orders/actions/orderActions";
import { getCustomers } from "@/features/customers/actions/customerActions";
import { getEmployees } from "@/features/employees/actions/employeeActions";
import { CompanyCalendarView } from "@/features/calendar/components/CompanyCalendarView";

export const metadata = {
  title: "Calendar | Admin",
};

export default async function AdminCalendarPage() {
  const [ordersData, customersData, employeesData] = await Promise.all([
    getOrders(),
    getCustomers(),
    getEmployees(),
  ]);

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
    <div className="flex-1 bg-slate-50 min-h-screen">
      <CompanyCalendarView
        orders={mappedOrders}
        customers={mappedCustomers}
        employees={mappedEmployees}
        title="Company Calendar"
        subtitle="View all site visits, installations, and production deadlines across the team."
        orderDetailBasePath="/admin/orders"
        showEmployeeFilter
      />
    </div>
  );
}
