import { redirect } from "next/navigation";
import { OrdersManagementDashboard } from "@/features/orders/components/OrdersManagementDashboard";
import { getOrders } from "@/features/orders/actions/orderActions";
import { getCustomers } from "@/features/customers/actions/customerActions";
import { getEnquiries } from "@/features/enquiries/actions/enquiryActions";
import { getCurrentUser } from "@/features/auth/actions/authActions";
import { getEmployees } from "@/features/employees/actions/employeeActions";
import {
  countMyOrdersTabs,
  defaultMyOrdersTab,
  filterMyOrdersAssigned,
  parseMyOrdersTab,
} from "@/features/orders/workspace/shared/staffQueueStages";
import {
  getMyOrdersStages,
  getNavItemsForActor,
  getStaffHomePath,
  MY_ORDERS_NAV,
} from "@/features/orders/workspace/shared/stageGrants";
import type { StageActor } from "@/features/orders/workspace/shared/types";

export default async function StaffMyOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "staff" && user.role !== "admin")) {
    redirect("/staff/login");
  }

  const actor: StageActor = {
    role: user.role,
    staff_role: user.staff_role,
    company_id: user.company_id,
  };

  const navItems = getNavItemsForActor(actor);
  if (!navItems.some((item) => item.href === MY_ORDERS_NAV.href)) {
    redirect(getStaffHomePath(actor));
  }

  const allowedStages = getMyOrdersStages(actor);
  if (allowedStages.length === 0) {
    redirect(getStaffHomePath(actor));
  }

  const params = await searchParams;
  const tabFromQuery = parseMyOrdersTab(params.stage, allowedStages);

  const [orders, customers, enquiries, employeesData] = await Promise.all([
    getOrders(),
    getCustomers(),
    getEnquiries(),
    getEmployees(),
  ]);

  const currentEmployee = employeesData?.find((e) => e.id === user.id);
  const allottedOrders = filterMyOrdersAssigned(orders, user.id, allowedStages);
  const counts = countMyOrdersTabs(allottedOrders, allowedStages);
  const initialTab =
    tabFromQuery ?? defaultMyOrdersTab(allowedStages, counts) ?? "all";

  const mappedOrders = allottedOrders.map((o) => ({
    id: o.id,
    clientName: o.client_name,
    businessName: o.business_name || "",
    customerId: o.customer_id,
    stage: o.stage,
    stageStatus: o.stage_status || "Normal",
    health: o.health,
    productType: o.product_type,
    requirements: o.requirements,
    assignedEmployees: o.assigned_employees || [],
    dateCreated: o.date_created,
    customerName: o.business_name || "",
    orderCode: o.order_id || o.id,
    orderId: o.order_id || o.id,
    workflow_type: o.workflow_type ?? null,
    business_operation: o.business_operation ?? "signage",
    siteVisitDetails: o.siteVisitDetails ?? null,
    installationDetails: o.installationDetails ?? null,
  }));

  const mappedCustomers =
    customers?.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      customerCode: c.customer_id || c.id,
      customerId: c.customer_id || c.id,
    })) || [];

  const mappedEmployees =
    employeesData?.map((e) => ({
      id: e.id,
      name: e.name,
      role: e.staff_role,
      email: e.email,
    })) || [];

  const mappedEnquiries =
    enquiries?.map((e) => ({
      id: e.id,
      source: e.source,
      status: e.status,
    })) || [];

  return (
    <OrdersManagementDashboard
      initialOrders={mappedOrders}
      initialCustomers={mappedCustomers}
      initialEmployees={mappedEmployees}
      initialEnquiries={mappedEnquiries}
      userRole="Employee"
      currentEmployeeName={currentEmployee?.name || ""}
      orderDetailBasePath="/staff/orders"
      mode="my_orders"
      allowedStages={allowedStages}
      initialTab={initialTab}
      title="My Orders"
      subtitle="Orders assigned to you"
    />
  );
}
