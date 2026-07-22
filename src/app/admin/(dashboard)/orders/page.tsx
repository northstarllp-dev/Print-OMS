import { OrdersManagementDashboard } from "@/features/orders/components/OrdersManagementDashboard";
import { getOrders } from "@/features/orders/actions/orderActions";
import { getCustomers } from "@/features/customers/actions/customerActions";
import { getEnquiries } from "@/features/enquiries/actions/enquiryActions";
import { getUserSession } from "@/features/auth/actions/authActions";
import { getEmployees } from "@/features/employees/actions/employeeActions";

export default async function OrdersPage() {
  // Fetch data on the server
  const orders = await getOrders();
  const customers = await getCustomers();
  const enquiries = await getEnquiries();
  const user = await getUserSession();
  const employeesData = await getEmployees();
  
  // Map database structures to frontend structures
  const mappedOrders = orders?.map(o => ({
    id: o.id,
    clientName: o.client_name,
    businessName: o.business_name || "",
    customerId: o.customer_id,
    stage: o.stage,
    stageStatus: o.stage_status || "Normal",
    health: o.health || "Active",
    productType: o.product_type,
    requirements: o.requirements,
    assignedEmployees: o.assigned_employees || [],
    assignedAdmins: o.assigned_admins || [],
    dateCreated: o.date_created,
    customerName: o.business_name || "",
    orderCode: o.order_id || o.id,
    orderId: o.order_id || o.id,
    siteVisitDetails: o.siteVisitDetails || null,
    workflow_type: o.workflow_type,
  })) || [];

  const mappedCustomers = customers?.map(c => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    customerCode: c.customer_id || c.id,
    customerId: c.customer_id || c.id
  })) || [];

  const mappedEmployees = employeesData
    ?.filter(e => e.staff_role !== "Production")
    ?.map(e => ({
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

  return (
    <OrdersManagementDashboard 
      initialOrders={mappedOrders}
      initialCustomers={mappedCustomers}
      initialEmployees={mappedEmployees}
      initialEnquiries={mappedEnquiries}
      userRole="Admin"
      currentEmployeeName=""
      currentUserId={user?.id}
    />
  );
}
