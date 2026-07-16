import { OrdersManagementDashboard } from "@/features/orders/components/OrdersManagementDashboard";
import { getOrders } from "@/features/orders/actions/orderActions";
import { getCustomers } from "@/features/customers/actions/customerActions";
import { getEnquiries } from "@/features/enquiries/actions/enquiryActions";
import { getCurrentUser } from "@/features/auth/actions/authActions";
import { getEmployees } from "@/features/employees/actions/employeeActions";
import { filterFloorQueueOrders } from "@/features/orders/workspace/shared/staffQueueStages";

export default async function InstallationSiteVisitPage() {
  const [orders, customers, enquiries, user, employeesData] = await Promise.all([
    getOrders(),
    getCustomers(),
    getEnquiries(),
    getCurrentUser(),
    getEmployees(),
  ]);

  const currentEmployee = employeesData?.find((e) => e.id === user?.id);
  const isAdmin = user?.role === "admin";

  // Floor portal: show all site-visit-relevant orders (no assignment filter).
  // Admins browsing from the installation portal were getting an empty list
  // because they are rarely in assigned_employees.
  const relevantOrders = filterFloorQueueOrders(orders, "site_visit");

  const mappedOrders = relevantOrders.map((o) => ({
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
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight">Site Visit Tasks</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage and execute your scheduled site audit checklist items.
        </p>
      </div>
      <OrdersManagementDashboard
        initialOrders={mappedOrders}
        initialCustomers={mappedCustomers}
        initialEmployees={mappedEmployees}
        initialEnquiries={mappedEnquiries}
        userRole={isAdmin ? "Admin" : "Employee"}
        currentEmployeeName={currentEmployee?.name || user?.name || ""}
        orderDetailBasePath="/installation/orders"
        entryStage="site_visit"
        hideTitle={true}
      />
    </div>
  );
}
