import { redirect } from "next/navigation";
import { OrdersManagementDashboard } from "@/features/orders/components/OrdersManagementDashboard";
import { getOrders } from "@/features/orders/actions/orderActions";
import { getCustomers } from "@/features/customers/actions/customerActions";
import { getEnquiries } from "@/features/enquiries/actions/enquiryActions";
import { getCurrentUser } from "@/features/auth/actions/authActions";
import { getEmployees } from "@/features/employees/actions/employeeActions";
import { filterStaffQueueOrders } from "@/features/orders/workspace/shared/staffQueueStages";
import {
  getNavItemsForActor,
  getStaffHomePath,
} from "@/features/orders/workspace/shared/stageGrants";
import type { StageActor, OrderStage } from "@/features/orders/workspace/shared/types";

// Map URL slugs to internal OrderStages
const QUEUE_TO_STAGE_MAP: Record<string, OrderStage> = {
  "orders": "quotation",
  "site-visit": "site_visit",
  "design": "design",
  "production": "production",
  "installation": "installation",
};

const QUEUE_META: Record<string, { title: string; subtitle: string }> = {
  "orders": { title: "Quotations Queue", subtitle: "Manage initial requests and quotations" },
  "site-visit": { title: "Site Visit Queue", subtitle: "Track and update scheduled site visits" },
  "design": { title: "Design Queue", subtitle: "Manage design approvals and artwork" },
  "production": { title: "Fabrication Queue", subtitle: "Monitor and update active production orders" },
  "installation": { title: "Installation Queue", subtitle: "Manage on-site installations and completions" },
};

export default async function StaffDynamicQueuePage({
  params,
}: {
  params: Promise<{ queue: string }>;
}) {
  const { queue } = await params;
  
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
  const requestedUrl = `/staff/${queue}`;
  
  // Verify if the user's stageGrants allow them to access this specific queue
  const isAllowed = navItems.some(item => item.href === requestedUrl);
  if (!isAllowed) {
    redirect(getStaffHomePath(actor));
  }

  const entryStage = QUEUE_TO_STAGE_MAP[queue];
  if (!entryStage) {
    redirect(getStaffHomePath(actor));
  }

  // Fetch Data
  const [orders, customers, enquiries, employeesData] = await Promise.all([
    getOrders(),
    getCustomers(),
    getEnquiries(),
    getEmployees(),
  ]);
  
  const currentEmployee = employeesData?.find(e => e.id === user.id);
  const allottedOrders = filterStaffQueueOrders(orders, user.id, entryStage);
  
  const mappedOrders = allottedOrders.map(o => ({
    id: o.id,
    clientName: o.client_name,
    businessName: o.business_name || "",
    customerId: o.customer_id,
    stage: o.stage,
    health: o.health,
    productType: o.product_type,
    requirements: o.requirements,
    assignedEmployees: o.assigned_employees || [],
    dateCreated: o.date_created,
    customerName: o.business_name || "",
    orderCode: o.order_id || o.id,
    orderId: o.order_id || o.id,
    workflow_type: o.workflow_type ?? null,
    siteVisitDetails: o.siteVisitDetails ?? null,
  }));

  const mappedCustomers = customers?.map(c => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    customerCode: c.customer_id || c.id,
    customerId: c.customer_id || c.id
  })) || [];

  const mappedEmployees = employeesData?.map(e => ({
    id: e.id,
    name: e.name,
    role: e.staff_role,
    email: e.email
  })) || [];

  const mappedEnquiries = enquiries?.map(e => ({
    id: e.id,
    source: e.source,
    status: e.status
  })) || [];

  const meta = QUEUE_META[queue] || { title: "Orders", subtitle: "Manage Orders" };

  return (
    <OrdersManagementDashboard 
      initialOrders={mappedOrders}
      initialCustomers={mappedCustomers}
      initialEmployees={mappedEmployees}
      initialEnquiries={mappedEnquiries}
      userRole="Employee"
      currentEmployeeName={currentEmployee?.name || ""}
      orderDetailBasePath="/staff/orders"
      entryStage={entryStage}
      title={meta.title}
      subtitle={meta.subtitle}
    />
  );
}
